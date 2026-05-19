import { json } from '@sveltejs/kit';
import { getUser, saveUser, isDBConflict } from '$lib/server/db';
import { getSession, deleteSession } from '$lib/server/gameSession';
import { trackMission } from '$lib/server/gameHandler';

export async function POST({ locals, platform }) {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const session = await getSession(locals.user.id, 'hilo');
	if (!session) return json({ error: 'No active game' }, { status: 400 });

	// Require at least one guess before cashing out
	if (!session.state.streak || session.state.streak < 1) {
		return json({ error: 'Must guess at least once before cashing out' }, { status: 400 });
	}

	const payout = session.state.potentialWin;
	await deleteSession(locals.user.id, 'hilo');

	const user = await getUser(platform, locals.user.id);
	if (!user) return json({ error: 'User not found' }, { status: 404 });

	user.credit += payout;
	const profit = payout - session.bet;
	if (profit > 0) user.stats.totalReceived += profit;
	trackMission(user, 'hilo', true);

	try {
		await saveUser(platform, user);
	} catch (e) {
		if (isDBConflict(e)) return json({ error: 'Server busy, please retry' }, { status: 409 });
		throw e;
	}

	return json({
		payout,
		won: true,
		newCredit: user.credit,
		stats: { totalSpent: user.stats.totalSpent, totalReceived: user.stats.totalReceived }
	});
}
