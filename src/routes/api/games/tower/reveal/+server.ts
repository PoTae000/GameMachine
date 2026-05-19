import { json } from '@sveltejs/kit';
import { getUser, saveUser, isDBConflict } from '$lib/server/db';
import { getSession, deleteSession, updateSession } from '$lib/server/gameSession';
import { trackMission } from '$lib/server/gameHandler';
import { biasedTowerReveal, getFloorMultiplier, DIFFICULTY_CONFIG, type TowerGame, type Difficulty } from '$lib/games/towerEngine';

export async function POST({ request, locals, platform }) {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const session = await getSession(locals.user.id, 'tower');
	if (!session) return json({ error: 'No active game' }, { status: 400 });
	if (session.state.gameOver) return json({ error: 'Game already over' }, { status: 400 });

	const { column } = await request.json();
	const difficulty = session.state.difficulty as Difficulty;
	const config = DIFFICULTY_CONFIG[difficulty];

	if (!Number.isInteger(column) || column < 0 || column >= config.columns) {
		return json({ error: 'Invalid column' }, { status: 400 });
	}

	if (session.state.floorsCleared >= config.floors) {
		return json({ error: 'All floors cleared' }, { status: 400 });
	}

	// Reconstruct game object
	const game: TowerGame = {
		difficulty,
		trapPositions: session.state.trapPositions,
		floorsCleared: session.state.floorsCleared,
		gameOver: false,
		cashedOut: false
	};

	const safe = biasedTowerReveal(game, column, session.state.winRate);

	// Update session state
	session.state.trapPositions = game.trapPositions;
	session.state.floorsCleared = game.floorsCleared;

	if (!safe) {
		// Hit trap
		session.state.gameOver = true;
		await deleteSession(locals.user.id, 'tower');

		const user = await getUser(platform, locals.user.id);
		if (!user) return json({ error: 'User not found' }, { status: 404 });
		user.stats.totalSpent += session.bet;
		trackMission(user, 'tower', false);
		try {
			await saveUser(platform, user);
		} catch (e) {
			if (isDBConflict(e)) return json({ error: 'Server busy, please retry' }, { status: 409 });
			throw e;
		}

		return json({
			safe: false,
			column,
			floor: game.floorsCleared,
			trapPositions: game.trapPositions,
			multiplier: 0,
			payout: 0,
			newCredit: user.credit,
			stats: { totalSpent: user.stats.totalSpent, totalReceived: user.stats.totalReceived }
		});
	}

	const multiplier = getFloorMultiplier(difficulty, game.floorsCleared);
	await updateSession(locals.user.id, 'tower', session);

	return json({
		safe: true,
		column,
		floor: game.floorsCleared,
		multiplier,
		potentialPayout: Math.round(session.bet * multiplier * 100) / 100
	});
}
