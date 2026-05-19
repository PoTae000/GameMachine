import { json } from '@sveltejs/kit';
import { getUser, saveUser, getConfig, isDBConflict } from '$lib/server/db';
import { getEffectiveWinRate, trackMission, MAX_BET } from '$lib/server/gameHandler';
import { generateBiasedGrid, evaluateGrid } from '$lib/slotEngine';
import { getSession, createSession } from '$lib/server/gameSession';
import type { GameConfigEntry } from '$lib/server/db';

export const POST = async ({ request, locals, platform }: { request: Request; locals: App.Locals; platform: App.Platform | undefined }) => {
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
	const freeSpin = body.freeSpin === true;
	const fsMultiplier = freeSpin ? Math.min(2, Math.max(1, Number(body.freeSpinMultiplier) || 1)) : 1;

	// 3. Validate bet
	if (typeof bet !== 'number' || isNaN(bet) || bet < 1 || bet > MAX_BET) {
		return json({ error: 'Invalid bet' }, { status: 400 });
	}

	// 3.5. Validate free spin server-side
	if (freeSpin) {
		const fsSession = await getSession(locals.user.id, 'slot-freespin');
		if (!fsSession || !fsSession.state.spinsRemaining || fsSession.state.spinsRemaining <= 0) {
			return json({ error: 'No free spins remaining' }, { status: 400 });
		}
		// Decrement free spin count
		fsSession.state.spinsRemaining -= 1;
		await createSession(locals.user.id, 'slot-freespin', 0, fsSession.state);
	}

	// 4. Load user and config
	const [user, config] = await Promise.all([getUser(platform, locals.user.id), getConfig(platform)]);
	if (!user) {
		return json({ error: 'User not found' }, { status: 404 });
	}

	// 5. Deduct bet (skip for free spins — already paid at purchase)
	if (!freeSpin) {
		if (user.credit < bet) {
			return json({ error: 'Insufficient credit' }, { status: 400 });
		}
		user.credit -= bet;
	}

	// 6. Get effective win rate (server-side)
	const winRate = getEffectiveWinRate(user, config, 'slot');

	// 7. Get game config
	const gameConfig = (config.gameConfig as unknown as Record<string, GameConfigEntry>)['slot'] ?? { winRate: 45 };
	const scatterChance = gameConfig.scatterChance ?? 2.5;

	// 8. Generate grid and evaluate
	const grid = generateBiasedGrid(freeSpin, winRate, scatterChance);
	const spinResult = evaluateGrid(grid, bet);

	const won = spinResult.totalPayout > 0;
	const basePayout = Math.round(spinResult.totalPayout * 100) / 100;
	const payout = Math.round(basePayout * fsMultiplier * 100) / 100;

	// 9. Apply payout
	if (payout > 0) {
		user.credit += payout;
	}

	// 10. Update stats (free spins: only count winnings, no loss)
	if (freeSpin) {
		if (payout > 0) {
			user.stats.totalReceived += payout;
		}
	} else if (won) {
		const profit = payout - bet;
		if (profit > 0) {
			user.stats.totalReceived += profit;
		}
	} else {
		if (payout === 0) {
			user.stats.totalSpent += bet;
		} else {
			const loss = bet - payout;
			if (loss > 0) {
				user.stats.totalSpent += loss;
			}
		}
	}

	// 11. Mission tracking
	trackMission(user, 'slot', won);


	// 12. Save user
	try {
		await saveUser(platform, user);
	} catch (e) {
		if (isDBConflict(e)) return json({ error: 'Server busy, please retry' }, { status: 409 });
		throw e;
	}

	// 13. Return result
	return json({
		outcome: {
			grid,
			lineWins: spinResult.lineWins,
			scatterCount: spinResult.scatterCount,
			freeSpinsWon: spinResult.freeSpinsWon,
			totalPayout: payout
		},
		payout,
		won,
		newCredit: user.credit,
		stats: {
			totalSpent: user.stats.totalSpent,
			totalReceived: user.stats.totalReceived
		}
	});
};
