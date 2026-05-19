import { json } from '@sveltejs/kit';
import { getUser, saveUser, isDBConflict } from '$lib/server/db';
import { getSession, deleteSession } from '$lib/server/gameSession';
import { trackMission } from '$lib/server/gameHandler';

export async function POST({ request, locals, platform }) {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const session = await getSession(locals.user.id, 'crash');
	if (!session) return json({ error: 'No active game' }, { status: 400 });

	const { multiplier } = await request.json();
	if (typeof multiplier !== 'number' || multiplier < 1) {
		return json({ error: 'Invalid multiplier' }, { status: 400 });
	}

	const crashPoint = session.state.crashPoint;

	// Time-based multiplier validation: prevent clients from sending inflated multipliers
	const startedAt = session.state.startedAt;
	if (startedAt) {
		const elapsedMs = Date.now() - startedAt;
		const maxAllowedMultiplier = 1 + (elapsedMs / 1000) * 0.1; // grows 0.1x per second
		if (multiplier > maxAllowedMultiplier) {
			return json({ error: 'Invalid multiplier: exceeds time-based maximum' }, { status: 400 });
		}
	}

	// Verify the multiplier is valid (not past crash point)
	if (multiplier > crashPoint) {
		// Player crashed - no payout
		await deleteSession(locals.user.id, 'crash');
		const user = await getUser(platform, locals.user.id);
		if (!user) return json({ error: 'User not found' }, { status: 404 });
		user.stats.totalSpent += session.bet;
		trackMission(user, 'crash', false);
		try {
			await saveUser(platform, user);
		} catch (e) {
			if (isDBConflict(e)) return json({ error: 'Server busy, please retry' }, { status: 409 });
			throw e;
		}
		return json({
			crashed: true,
			crashPoint,
			payout: 0,
			won: false,
			newCredit: user.credit,
			stats: { totalSpent: user.stats.totalSpent, totalReceived: user.stats.totalReceived }
		});
	}

	// Valid cashout
	const payout = Math.round(session.bet * multiplier * 100) / 100;
	await deleteSession(locals.user.id, 'crash');

	const user = await getUser(platform, locals.user.id);
	if (!user) return json({ error: 'User not found' }, { status: 404 });

	user.credit += payout;
	const profit = payout - session.bet;
	if (profit > 0) user.stats.totalReceived += profit;
	trackMission(user, 'crash', true);

	try {
		await saveUser(platform, user);
	} catch (e) {
		if (isDBConflict(e)) return json({ error: 'Server busy, please retry' }, { status: 409 });
		throw e;
	}

	return json({
		crashed: false,
		cashoutMultiplier: multiplier,
		payout,
		won: true,
		newCredit: user.credit,
		stats: { totalSpent: user.stats.totalSpent, totalReceived: user.stats.totalReceived }
	});
}
