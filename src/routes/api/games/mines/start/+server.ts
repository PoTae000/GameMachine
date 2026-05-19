import { json } from '@sveltejs/kit';
import { getUser, saveUser, getConfig, isDBConflict } from '$lib/server/db';
import { createSession, getSession, deleteSession } from '$lib/server/gameSession';
import { getEffectiveWinRate, MAX_BET } from '$lib/server/gameHandler';
import { createGame, MINE_COUNTS, GRID_SIZE } from '$lib/games/minesEngine';

export async function POST({ request, locals, platform }) {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const { bet, mineCount, force } = await request.json();

	const existing = await getSession(locals.user.id, 'mines');
	if (typeof bet !== 'number' || isNaN(bet) || bet < 1 || bet > MAX_BET) return json({ error: 'Invalid bet' }, { status: 400 });
	if (!MINE_COUNTS.includes(mineCount)) return json({ error: 'Invalid mine count' }, { status: 400 });

	const [user, config] = await Promise.all([getUser(platform, locals.user.id), getConfig(platform)]);
	if (!user) return json({ error: 'User not found' }, { status: 404 });

	// Refund existing session bet before starting new game
	if (existing) {
		user.credit += existing.bet;
		await deleteSession(locals.user.id, 'mines');
	}

	if (user.credit < bet) return json({ error: 'Insufficient credit' }, { status: 400 });

	user.credit -= bet;
	const winRate = getEffectiveWinRate(user, config, 'mines');
	const mineRelocate = config.gameConfig.mines?.mineRelocate ?? true;
	const game = createGame(mineCount, winRate);

	try {
		await saveUser(platform, user);
	} catch (e) {
		if (isDBConflict(e)) return json({ error: 'Server busy, please retry' }, { status: 409 });
		throw e;
	}

	// Store mine positions in session (hidden from client)
	await createSession(locals.user.id, 'mines', bet, {
		mines: [...game.mines],
		revealed: [],
		mineCount,
		gameOver: false,
		winRate,
		mineRelocate
	});

	return json({
		started: true,
		mineCount,
		newCredit: user.credit
	});
}
