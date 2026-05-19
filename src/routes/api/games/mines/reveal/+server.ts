import { json } from '@sveltejs/kit';
import { getUser, saveUser, isDBConflict } from '$lib/server/db';
import { getSession, deleteSession, updateSession } from '$lib/server/gameSession';
import { trackMission } from '$lib/server/gameHandler';
import { biasedReveal, getMultiplier, GRID_SIZE, type MinesGame } from '$lib/games/minesEngine';

export async function POST({ request, locals, platform }) {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const session = await getSession(locals.user.id, 'mines');
	if (!session) return json({ error: 'No active game' }, { status: 400 });
	if (session.state.gameOver) return json({ error: 'Game already over' }, { status: 400 });

	const { cell } = await request.json();
	if (!Number.isInteger(cell) || cell < 0 || cell >= GRID_SIZE) {
		return json({ error: 'Invalid cell' }, { status: 400 });
	}
	if (session.state.revealed.includes(cell)) {
		return json({ error: 'Cell already revealed' }, { status: 400 });
	}

	// Reconstruct MinesGame from session
	const game: MinesGame = {
		mines: new Set(session.state.mines),
		revealed: new Set(session.state.revealed),
		mineCount: session.state.mineCount,
		gameOver: false,
		cashedOut: false
	};

	const safe = biasedReveal(game, cell, session.state.winRate, session.state.mineRelocate);

	// Update session state
	session.state.mines = [...game.mines];
	session.state.revealed = [...game.revealed];

	if (!safe) {
		// Hit mine
		session.state.gameOver = true;
		await deleteSession(locals.user.id, 'mines');

		const user = await getUser(platform, locals.user.id);
		if (!user) return json({ error: 'User not found' }, { status: 404 });
		user.stats.totalSpent += session.bet;
		trackMission(user, 'mines', false);
		try {
			await saveUser(platform, user);
		} catch (e) {
			if (isDBConflict(e)) return json({ error: 'Server busy, please retry' }, { status: 409 });
			throw e;
		}

		return json({
			safe: false,
			cell,
			mines: [...game.mines],
			multiplier: 0,
			payout: 0,
			newCredit: user.credit,
			stats: { totalSpent: user.stats.totalSpent, totalReceived: user.stats.totalReceived }
		});
	}

	const multiplier = getMultiplier(session.state.mineCount, game.revealed.size);
	await updateSession(locals.user.id, 'mines', session);

	return json({
		safe: true,
		cell,
		multiplier,
		revealedCount: game.revealed.size,
		potentialPayout: Math.round(session.bet * multiplier * 100) / 100
	});
}
