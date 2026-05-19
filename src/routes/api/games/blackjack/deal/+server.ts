import { json } from '@sveltejs/kit';
import { getUser, saveUser, getConfig, isDBConflict } from '$lib/server/db';
import { createSession, getSession, deleteSession } from '$lib/server/gameSession';
import { getEffectiveWinRate, MAX_BET } from '$lib/server/gameHandler';
import { biasedInitialDeal, isBlackjack, handValue, evaluateBlackjack, getMultiplier, createDeck } from '$lib/games/blackjackEngine';

export async function POST({ request, locals, platform }) {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const existing = await getSession(locals.user.id, 'blackjack');

	const { bet } = await request.json();
	if (typeof bet !== 'number' || isNaN(bet) || bet < 1 || bet > MAX_BET) return json({ error: 'Invalid bet' }, { status: 400 });

	const [user, config] = await Promise.all([getUser(platform, locals.user.id), getConfig(platform)]);
	if (!user) return json({ error: 'User not found' }, { status: 404 });

	// Refund existing session bet before starting new game
	if (existing) {
		user.credit += existing.bet;
		await deleteSession(locals.user.id, 'blackjack');
	}

	if (user.credit < bet) return json({ error: 'Insufficient credit' }, { status: 400 });

	user.credit -= bet;

	const winRate = getEffectiveWinRate(user, config, 'blackjack');
	const shouldWin = Math.random() * 100 < winRate;
	const deal = biasedInitialDeal(shouldWin);

	try {
		await saveUser(platform, user);
	} catch (e) {
		if (isDBConflict(e)) return json({ error: 'Server busy, please retry' }, { status: 409 });
		throw e;
	}

	const playerBJ = isBlackjack(deal.playerHand);
	const dealerBJ = isBlackjack(deal.dealerHand);

	// If either has blackjack, resolve immediately
	if (playerBJ || dealerBJ) {
		const result = evaluateBlackjack(deal.playerHand, deal.dealerHand);
		const mult = getMultiplier(result);
		const payout = Math.round(bet * mult * 100) / 100;

		// Re-fetch user since version incremented after first saveUser
		const user2 = await getUser(platform, locals.user.id);
		if (user2) {
			if (payout > 0) user2.credit += payout;
			const net = payout - bet;
			if (net > 0) user2.stats.totalReceived += net;
			else if (net < 0) user2.stats.totalSpent += Math.abs(net);
			try {
				await saveUser(platform, user2);
			} catch (e) {
				if (isDBConflict(e)) return json({ error: 'Server busy, please retry' }, { status: 409 });
				throw e;
			}

			return json({
				playerHand: deal.playerHand,
				dealerHand: deal.dealerHand,
				phase: 'result',
				result,
				payout,
				won: payout > bet,
				newCredit: user2.credit,
				stats: { totalSpent: user2.stats.totalSpent, totalReceived: user2.stats.totalReceived }
			});
		}
	}

	// Store game state in session
	await createSession(locals.user.id, 'blackjack', bet, {
		deck: deal.deck,
		playerHand: deal.playerHand,
		dealerHand: deal.dealerHand,
		shouldWin,
		dealerBias: config.gameConfig.blackjack?.dealerBias ?? 50
	});

	return json({
		playerHand: deal.playerHand,
		dealerHand: [deal.dealerHand[0], null], // Hide hole card
		phase: 'playing',
		newCredit: user.credit
	});
}
