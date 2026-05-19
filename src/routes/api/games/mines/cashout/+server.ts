import { json } from '@sveltejs/kit';
import { getUser, saveUser, isDBConflict } from '$lib/server/db';
import { getSession, deleteSession } from '$lib/server/gameSession';
import { trackMission } from '$lib/server/gameHandler';
import { getMultiplier } from '$lib/games/minesEngine';

export async function POST({ locals, platform }) {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const session = await getSession(locals.user.id, 'mines');
	if (!session) return json({ error: 'No active game' }, { status: 400 });
	if (session.state.gameOver) return json({ error: 'Game already over' }, { status: 400 });
	if (session.state.revealed.length === 0) return json({ error: 'Must reveal at least one cell' }, { status: 400 });

	const multiplier = getMultiplier(session.state.mineCount, session.state.revealed.length);
	const payout = Math.round(session.bet * multiplier * 100) / 100;

	await deleteSession(locals.user.id, 'mines');

	const user = await getUser(platform, locals.user.id);
	if (!user) return json({ error: 'User not found' }, { status: 404 });

	user.credit += payout;
	const profit = payout - session.bet;
	if (profit > 0) user.stats.totalReceived += profit;
	trackMission(user, 'mines', true);

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
		newCredit: user.credit,
		stats: { totalSpent: user.stats.totalSpent, totalReceived: user.stats.totalReceived }
	});
}
