import { json } from '@sveltejs/kit';
import { getUser, saveUser, isDBConflict } from '$lib/server/db';
import { getSession, deleteSession } from '$lib/server/gameSession';
import { trackMission } from '$lib/server/gameHandler';
import { getFloorMultiplier, type Difficulty } from '$lib/games/towerEngine';

export async function POST({ locals, platform }) {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const session = await getSession(locals.user.id, 'tower');
	if (!session) return json({ error: 'No active game' }, { status: 400 });
	if (session.state.gameOver) return json({ error: 'Game already over' }, { status: 400 });
	if (session.state.floorsCleared === 0) return json({ error: 'Must clear at least one floor' }, { status: 400 });

	const difficulty = session.state.difficulty as Difficulty;
	const multiplier = getFloorMultiplier(difficulty, session.state.floorsCleared);
	const payout = Math.round(session.bet * multiplier * 100) / 100;

	await deleteSession(locals.user.id, 'tower');

	const user = await getUser(platform, locals.user.id);
	if (!user) return json({ error: 'User not found' }, { status: 404 });

	user.credit += payout;
	const profit = payout - session.bet;
	if (profit > 0) user.stats.totalReceived += profit;
	trackMission(user, 'tower', true);

	try {
		await saveUser(platform, user);
	} catch (e) {
		if (isDBConflict(e)) return json({ error: 'Server busy, please retry' }, { status: 409 });
		throw e;
	}

	return json({
		payout,
		multiplier,
		won: true,
		floorsCleared: session.state.floorsCleared,
		newCredit: user.credit,
		stats: { totalSpent: user.stats.totalSpent, totalReceived: user.stats.totalReceived }
	});
}
