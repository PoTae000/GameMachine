import { json } from '@sveltejs/kit';
import { getUser, saveUser, isDBConflict } from '$lib/server/db';
import { getSession, deleteSession } from '$lib/server/gameSession';
import { trackMission } from '$lib/server/gameHandler';
import { redraw, evaluateHand, PAYOUTS } from '$lib/games/videoPokerEngine';

export async function POST({ request, locals, platform }) {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const session = await getSession(locals.user.id, 'videopoker');
	if (!session) return json({ error: 'No active game' }, { status: 400 });

	const { holds } = await request.json();
	if (!Array.isArray(holds) || holds.length !== 5 || !holds.every(h => typeof h === 'boolean')) {
		return json({ error: 'Invalid holds' }, { status: 400 });
	}

	const { hand, deck, winRate, rareChance } = session.state;
	const newHand = redraw(hand, holds, deck, winRate, rareChance);
	const handRank = evaluateHand(newHand);
	const multiplier = PAYOUTS[handRank];
	const payout = multiplier > 0 ? Math.round(session.bet * multiplier * 100) / 100 : 0;
	const won = payout > 0;

	await deleteSession(locals.user.id, 'videopoker');

	const user = await getUser(platform, locals.user.id);
	if (!user) return json({ error: 'User not found' }, { status: 404 });

	if (payout > 0) user.credit += payout;
	const net = payout - session.bet;
	if (net > 0) user.stats.totalReceived += net;
	else if (net < 0) user.stats.totalSpent += Math.abs(net);
	trackMission(user, 'videopoker', won);

	try {
		await saveUser(platform, user);
	} catch (e) {
		if (isDBConflict(e)) return json({ error: 'Server busy, please retry' }, { status: 409 });
		throw e;
	}

	return json({
		hand: newHand,
		handRank,
		multiplier,
		payout,
		won,
		newCredit: user.credit,
		stats: { totalSpent: user.stats.totalSpent, totalReceived: user.stats.totalReceived }
	});
}
