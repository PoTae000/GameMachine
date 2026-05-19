import { json } from '@sveltejs/kit';
import { getUser, saveUser, getConfig, isDBConflict } from './db';
import type { StoredUser, StoredConfig, GameConfigEntry } from './db';
import { getTodayDateString } from './eventHelpers';

export interface GameExecutorParams {
	bet: number;
	gameParams: Record<string, any>;
	winRate: number;
	gameConfig: GameConfigEntry;
}

export interface GameExecutorResult {
	outcome: Record<string, any>;
	payout: number;
	won: boolean;
}

export type GameExecutor = (params: GameExecutorParams) => GameExecutorResult;

export const MAX_BET = 10_000;

export function getEffectiveWinRate(user: StoredUser, config: StoredConfig, game: string): number {
	// Per-user custom win rate override (highest priority)
	if (user.role === 'player' && typeof user.customWinRate === 'number') {
		return user.customWinRate;
	}

	// Admin-configured game win rate
	const gameConf = (config.gameConfig as unknown as Record<string, GameConfigEntry>)[game];
	return gameConf?.winRate ?? 45;
}

export function createGameHandler(game: string, executor: GameExecutor) {
	return async ({ request, locals, platform }: { request: Request; locals: App.Locals; platform: App.Platform | undefined }) => {
		// 1. Auth check
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// 2. Parse body
		let body: any;
		try {
			body = await request.json();
		} catch {
			return json({ error: 'Invalid JSON' }, { status: 400 });
		}

		const bet = body.bet;

		// 3. Validate bet
		if (typeof bet !== 'number' || isNaN(bet) || bet < 1 || bet > MAX_BET) {
			return json({ error: 'Invalid bet' }, { status: 400 });
		}

		// 4. Fetch user + config in parallel
		const [user, config] = await Promise.all([
			getUser(platform, locals.user.id),
			getConfig(platform)
		]);

		if (!user) {
			return json({ error: 'User not found' }, { status: 404 });
		}

		if (user.credit < bet) {
			return json({ error: 'Insufficient credit' }, { status: 400 });
		}

		// 5. Deduct bet
		user.credit -= bet;

		// 6. Get effective win rate (server-side)
		// Admin cheat mode: if admin sends cheat=true, force 100% win
		const isAdminCheat = user.role === 'admin' && body.cheat === true;
		const winRate = isAdminCheat ? 100 : getEffectiveWinRate(user, config, game);

		// 7. Get game config
		const gameConfig = (config.gameConfig as unknown as Record<string, GameConfigEntry>)[game] ?? { winRate: 45 };

		// 8. Run executor
		const { gameParams, ...rest } = body;
		const result = executor({
			bet,
			gameParams: { ...body, ...gameParams },
			winRate,
			gameConfig
		});

		// 9. Apply payout
		if (result.payout > 0) {
			user.credit += result.payout;
		}

		// 10. Update stats
		if (result.won) {
			const profit = result.payout - bet;
			if (profit > 0) {
				user.stats.totalReceived += profit;
			}
		} else {
			if (result.payout === 0) {
				user.stats.totalSpent += bet;
			} else {
				// Partial loss (e.g. push returns bet)
				const loss = bet - result.payout;
				if (loss > 0) {
					user.stats.totalSpent += loss;
				}
			}
		}

		// 11. Mission tracking
		const today = getTodayDateString();
		if (!user.missions || user.missions.date !== today) {
			user.missions = { date: today, played: 0, won: 0, gamesPlayed: [], claimed: [false, false, false] };
		}
		user.missions.played += 1;
		if (result.won) user.missions.won += 1;
		if (!user.missions.gamesPlayed.includes(game)) user.missions.gamesPlayed.push(game);

		// 12. Save user (per-user optimistic lock)
		try {
			await saveUser(platform, user);
		} catch (e: any) {
			if (isDBConflict(e)) {
				return json({ error: 'Server busy, please retry' }, { status: 409 });
			}
			throw e;
		}

		// 13. Return result
		return json({
			outcome: result.outcome,
			payout: result.payout,
			won: result.won,
			newCredit: user.credit,
			stats: {
				totalSpent: user.stats.totalSpent,
				totalReceived: user.stats.totalReceived
			}
		});
	};
}

// Track mission progress for multi-step games
export function trackMission(user: { missions?: import('./db').UserMissions }, game: string, won: boolean) {
	const today = getTodayDateString();
	if (!user.missions || user.missions.date !== today) {
		user.missions = { date: today, played: 0, won: 0, gamesPlayed: [], claimed: [false, false, false] };
	}
	user.missions.played += 1;
	if (won) user.missions.won += 1;
	if (!user.missions.gamesPlayed.includes(game)) user.missions.gamesPlayed.push(game);
}
