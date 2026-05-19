import { createGameHandler } from '$lib/server/gameHandler';
import { createDeck, biasedDeal, evaluate, getMultiplier, type DTBet } from '$lib/games/dragonTigerEngine';

const VALID_BETS: DTBet[] = ['dragon', 'tiger', 'tie'];

export const POST = createGameHandler('dragontiger', ({ bet, gameParams, winRate, gameConfig }) => {
	const selectedBet: DTBet = gameParams.selectedBet;
	if (!VALID_BETS.includes(selectedBet)) {
		throw new Error('Invalid bet type');
	}

	const dealerBias = gameConfig.dealerBias ?? 50;
	const deck = createDeck();
	const { dragon, tiger } = biasedDeal(deck, selectedBet, winRate, dealerBias);
	const result = evaluate(dragon, tiger);

	let payout: number;
	let won: boolean;

	if (result === selectedBet) {
		const mult = getMultiplier(selectedBet);
		payout = Math.round(bet * mult * 100) / 100;
		won = true;
	} else if (result === 'tie' && selectedBet !== 'tie') {
		// Tie returns half bet for non-tie bets
		payout = Math.round(bet / 2 * 100) / 100;
		won = false;
	} else {
		payout = 0;
		won = false;
	}

	return {
		outcome: { dragon, tiger, result },
		payout,
		won
	};
});
