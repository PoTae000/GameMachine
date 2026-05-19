import { json } from '@sveltejs/kit';
import { getUser, saveUser, getConfig, isDBConflict } from '$lib/server/db';
import { createSession, getSession, deleteSession } from '$lib/server/gameSession';
import { getEffectiveWinRate, MAX_BET } from '$lib/server/gameHandler';
import { biasedDeal, isPok, handPoints, evaluatePokDeng, getHandMultiplier, createDeck } from '$lib/games/pokdengEngine';

export async function POST({ request, locals, platform }) {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const existing = await getSession(locals.user.id, 'pokdeng');

	const { bet } = await request.json();
	if (typeof bet !== 'number' || isNaN(bet) || bet < 1 || bet > MAX_BET) return json({ error: 'Invalid bet' }, { status: 400 });

	const [user, config] = await Promise.all([getUser(platform, locals.user.id), getConfig(platform)]);
	if (!user) return json({ error: 'User not found' }, { status: 404 });

	// Refund existing session bet before starting new game
	if (existing) {
		user.credit += existing.bet;
		await deleteSession(locals.user.id, 'pokdeng');
	}

	if (user.credit < bet) return json({ error: 'Insufficient credit' }, { status: 400 });

	user.credit -= bet;

	const winRate = getEffectiveWinRate(user, config, 'pokdeng');
	const dealerBias = config.gameConfig.pokdeng?.dealerBias ?? 50;
	const deck = createDeck();
	const { playerHand, dealerHand, remaining } = biasedDeal(deck, winRate, dealerBias);

	// Check for immediate pok
	if (isPok(playerHand) || isPok(dealerHand)) {
		// Resolve immediately
		const result = evaluatePokDeng(playerHand, dealerHand);
		let payout = 0;
		if (result === 'win') {
			const mult = getHandMultiplier(playerHand);
			payout = Math.round(bet * mult * 100) / 100;
		} else if (result === 'draw') {
			payout = bet;
		}

		if (payout > 0) user.credit += payout;
		const net = payout - bet;
		if (net > 0) user.stats.totalReceived += net;
		else if (net < 0) user.stats.totalSpent += Math.abs(net);

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
			isPok: true,
			newCredit: user.credit,
			stats: { totalSpent: user.stats.totalSpent, totalReceived: user.stats.totalReceived }
		});
	}

	try {
		await saveUser(platform, user);
	} catch (e) {
		if (isDBConflict(e)) return json({ error: 'Server busy, please retry' }, { status: 409 });
		throw e;
	}

	await createSession(locals.user.id, 'pokdeng', bet, {
		playerHand,
		dealerHand,
		deck: remaining,
		winRate,
		dealerBias
	});

	return json({
		playerHand,
		dealerHandCount: dealerHand.length, // Don't reveal dealer hand
		phase: 'playing',
		newCredit: user.credit
	});
}
