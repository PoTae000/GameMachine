import { json } from '@sveltejs/kit';
import { getUser, saveUser, isDBConflict } from '$lib/server/db';
import { getSession, deleteSession } from '$lib/server/gameSession';
import { trackMission } from '$lib/server/gameHandler';
import { handPoints, evaluatePokDeng, getHandMultiplier, cardPoints } from '$lib/games/pokdengEngine';

export async function POST({ request, locals, platform }) {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const session = await getSession(locals.user.id, 'pokdeng');
	if (!session) return json({ error: 'No active game' }, { status: 400 });

	const { action } = await request.json();
	if (action !== 'draw' && action !== 'stay') {
		return json({ error: 'Invalid action' }, { status: 400 });
	}

	let { playerHand, dealerHand, deck } = session.state;

	if (action === 'draw') {
		// Player draws third card
		if (playerHand.length >= 3) return json({ error: 'Already drew' }, { status: 400 });
		playerHand.push(deck.pop()!);
	}

	// Dealer logic: draw if < 5 points
	if (handPoints(dealerHand) < 5 && dealerHand.length < 3) {
		dealerHand.push(deck.pop()!);
	}

	// Evaluate
	const result = evaluatePokDeng(playerHand, dealerHand);
	let payout = 0;
	if (result === 'win') {
		const mult = getHandMultiplier(playerHand);
		payout = Math.round(session.bet * mult * 100) / 100;
	} else if (result === 'draw') {
		payout = session.bet;
	}

	await deleteSession(locals.user.id, 'pokdeng');

	const user = await getUser(platform, locals.user.id);
	if (!user) return json({ error: 'User not found' }, { status: 404 });

	if (payout > 0) user.credit += payout;
	const net = payout - session.bet;
	if (net > 0) user.stats.totalReceived += net;
	else if (net < 0) user.stats.totalSpent += Math.abs(net);
	trackMission(user, 'pokdeng', result === 'win');

	try {
		await saveUser(platform, user);
	} catch (e) {
		if (isDBConflict(e)) return json({ error: 'Server busy, please retry' }, { status: 409 });
		throw e;
	}

	return json({
		playerHand,
		dealerHand,
		phase: 'result',
		result,
		payout,
		won: result === 'win',
		newCredit: user.credit,
		stats: { totalSpent: user.stats.totalSpent, totalReceived: user.stats.totalReceived }
	});
}
