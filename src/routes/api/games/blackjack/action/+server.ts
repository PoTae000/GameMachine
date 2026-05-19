import { json } from '@sveltejs/kit';
import { getUser, saveUser, isDBConflict } from '$lib/server/db';
import { getSession, deleteSession, updateSession } from '$lib/server/gameSession';
import { trackMission } from '$lib/server/gameHandler';
import { handValue, isBust, isBlackjack, evaluateBlackjack, getMultiplier, biasedDealerDraw, createDeck, type Card } from '$lib/games/blackjackEngine';

function runDealer(deck: Card[], playerValue: number, shouldWin: boolean, dealerBias: number, dealerHand: Card[]): Card[] {
	while (handValue(dealerHand) < 17) {
		if (deck.length < 10) deck.push(...createDeck());
		const { card, remaining } = biasedDealerDraw(deck, playerValue, shouldWin, dealerBias);
		dealerHand.push(card);
		deck.length = 0;
		deck.push(...remaining);
	}
	return dealerHand;
}

export async function POST({ request, locals, platform }) {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const session = await getSession(locals.user.id, 'blackjack');
	if (!session) return json({ error: 'No active game' }, { status: 400 });

	const { action } = await request.json();
	if (!['hit', 'stand', 'double'].includes(action)) {
		return json({ error: 'Invalid action' }, { status: 400 });
	}

	const { deck, playerHand, dealerHand, shouldWin, dealerBias } = session.state;
	let bet = session.bet;

	if (action === 'double') {
		// Check if player can double (must have exactly 2 cards)
		if (playerHand.length !== 2) return json({ error: 'Can only double on initial hand' }, { status: 400 });

		const user = await getUser(platform, locals.user.id);
		if (!user || user.credit < bet) return json({ error: 'Insufficient credit for double' }, { status: 400 });

		user.credit -= bet;
		session.bet = bet * 2;
		bet = session.bet;
		try {
			await saveUser(platform, user);
		} catch (e) {
			if (isDBConflict(e)) return json({ error: 'Server busy, please retry' }, { status: 409 });
			throw e;
		}

		// Draw one card
		if (deck.length < 10) deck.push(...createDeck());
		playerHand.push(deck.pop()!);

		if (isBust(playerHand)) {
			await deleteSession(locals.user.id, 'blackjack');
			// Re-fetch user since version incremented after saveUser
			const user2 = await getUser(platform, locals.user.id);
			if (user2) {
				user2.stats.totalSpent += bet;
				trackMission(user2, 'blackjack', false);
				try {
					await saveUser(platform, user2);
				} catch (e) {
					if (isDBConflict(e)) return json({ error: 'Server busy, please retry' }, { status: 409 });
					throw e;
				}
				return json({
					playerHand,
					dealerHand,
					phase: 'result',
					result: 'lose',
					payout: 0,
					won: false,
					newCredit: user2.credit,
					stats: { totalSpent: user2.stats.totalSpent, totalReceived: user2.stats.totalReceived }
				});
			}
		}

		// After double, stand automatically - run dealer
		const finalDealer = runDealer(deck, handValue(playerHand), shouldWin, dealerBias, dealerHand);
		const result = evaluateBlackjack(playerHand, finalDealer);
		const mult = getMultiplier(result);
		const payout = Math.round(bet * mult * 100) / 100;

		await deleteSession(locals.user.id, 'blackjack');

		// Re-fetch user since version incremented after saveUser
		const user2 = await getUser(platform, locals.user.id);
		if (user2) {
			if (payout > 0) user2.credit += payout;
			const net = payout - bet;
			if (net > 0) user2.stats.totalReceived += net;
			else if (net < 0) user2.stats.totalSpent += Math.abs(net);
			trackMission(user2, 'blackjack', payout > bet);
			try {
				await saveUser(platform, user2);
			} catch (e) {
				if (isDBConflict(e)) return json({ error: 'Server busy, please retry' }, { status: 409 });
				throw e;
			}
			return json({
				playerHand,
				dealerHand: finalDealer,
				phase: 'result',
				result,
				payout,
				won: payout > bet,
				newCredit: user2.credit,
				stats: { totalSpent: user2.stats.totalSpent, totalReceived: user2.stats.totalReceived }
			});
		}
	}

	if (action === 'hit') {
		if (deck.length < 10) deck.push(...createDeck());
		playerHand.push(deck.pop()!);

		if (isBust(playerHand)) {
			await deleteSession(locals.user.id, 'blackjack');
			const user = await getUser(platform, locals.user.id);
			if (user) {
				user.stats.totalSpent += bet;
				trackMission(user, 'blackjack', false);
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
					result: 'lose',
					payout: 0,
					won: false,
					newCredit: user.credit,
					stats: { totalSpent: user.stats.totalSpent, totalReceived: user.stats.totalReceived }
				});
			}
		}

		if (handValue(playerHand) === 21) {
			// Auto-stand at 21
			const finalDealer = runDealer(deck, handValue(playerHand), shouldWin, dealerBias, dealerHand);
			const result = evaluateBlackjack(playerHand, finalDealer);
			const mult = getMultiplier(result);
			const payout = Math.round(bet * mult * 100) / 100;

			await deleteSession(locals.user.id, 'blackjack');

			const user = await getUser(platform, locals.user.id);
			if (user) {
				if (payout > 0) user.credit += payout;
				const net = payout - bet;
				if (net > 0) user.stats.totalReceived += net;
				else if (net < 0) user.stats.totalSpent += Math.abs(net);
				trackMission(user, 'blackjack', payout > bet);
				try {
					await saveUser(platform, user);
				} catch (e) {
					if (isDBConflict(e)) return json({ error: 'Server busy, please retry' }, { status: 409 });
					throw e;
				}
				return json({
					playerHand,
					dealerHand: finalDealer,
					phase: 'result',
					result,
					payout,
					won: payout > bet,
					newCredit: user.credit,
					stats: { totalSpent: user.stats.totalSpent, totalReceived: user.stats.totalReceived }
				});
			}
		}

		// Update session state and persist to KV
		session.state.playerHand = playerHand;
		session.state.deck = deck;
		await updateSession(locals.user.id, 'blackjack', session);

		return json({
			playerHand,
			dealerHand: [dealerHand[0], null],
			phase: 'playing'
		});
	}

	if (action === 'stand') {
		const finalDealer = runDealer(deck, handValue(playerHand), shouldWin, dealerBias, dealerHand);
		const result = evaluateBlackjack(playerHand, finalDealer);
		const mult = getMultiplier(result);
		const payout = Math.round(bet * mult * 100) / 100;

		await deleteSession(locals.user.id, 'blackjack');

		const user = await getUser(platform, locals.user.id);
		if (user) {
			if (payout > 0) user.credit += payout;
			const net = payout - bet;
			if (net > 0) user.stats.totalReceived += net;
			else if (net < 0) user.stats.totalSpent += Math.abs(net);
			trackMission(user, 'blackjack', payout > bet);
			try {
				await saveUser(platform, user);
			} catch (e) {
				if (isDBConflict(e)) return json({ error: 'Server busy, please retry' }, { status: 409 });
				throw e;
			}
			return json({
				playerHand,
				dealerHand: finalDealer,
				phase: 'result',
				result,
				payout,
				won: payout > bet,
				newCredit: user.credit,
				stats: { totalSpent: user.stats.totalSpent, totalReceived: user.stats.totalReceived }
			});
		}
	}

	return json({ error: 'Unknown error' }, { status: 500 });
}
