import { createGameHandler } from '$lib/server/gameHandler';
import { createDeck, biasedDeal, evaluateBaccarat, getMultiplier, type BaccaratBet } from '$lib/games/baccaratEngine';

const VALID_BETS: BaccaratBet[] = ['player', 'banker', 'tie'];

export const POST = createGameHandler('baccarat', ({ bet, gameParams, winRate, gameConfig }) => {
	const selectedBet: BaccaratBet = gameParams.selectedBet;
	if (!VALID_BETS.includes(selectedBet)) {
		throw new Error('Invalid bet type');
	}

	const dealerBias = gameConfig.dealerBias ?? 50;
	const deck = createDeck();
	const { playerHand, bankerHand } = biasedDeal(deck, selectedBet, winRate, dealerBias);
	const result = evaluateBaccarat(playerHand, bankerHand);

	let payout: number;
	let won: boolean;

	if (result === selectedBet) {
		// Won
		const mult = getMultiplier(selectedBet);
		payout = Math.round(bet * mult * 100) / 100;
		won = true;
	} else if (result === 'tie' && selectedBet !== 'tie') {
		// Push on tie (non-tie bets get money back)
		payout = bet;
		won = false;
	} else {
		// Lost
		payout = 0;
		won = false;
	}

	return {
		outcome: { playerHand, bankerHand, result },
		payout,
		won
	};
});
