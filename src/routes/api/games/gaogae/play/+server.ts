import { createGameHandler } from '$lib/server/gameHandler';
import { biasedDeal, compareHands, getHandType, getHandMultiplier, handPoints, handTypeName } from '$lib/games/gaogaeEngine';

export const POST = createGameHandler('gaogae', ({ bet, winRate }) => {
	const { playerHand, dealerHand } = biasedDeal(winRate);
	const result = compareHands(playerHand, dealerHand);

	const playerType = getHandType(playerHand);
	const dealerType = getHandType(dealerHand);

	let payout: number;
	let won: boolean;

	if (result === 'win') {
		const mult = getHandMultiplier(playerType);
		payout = Math.round(bet * mult * 100) / 100;
		won = true;
	} else if (result === 'draw') {
		// Push: return bet
		payout = bet;
		won = false;
	} else {
		payout = 0;
		won = false;
	}

	return {
		outcome: {
			playerHand,
			dealerHand,
			result,
			playerPoints: handPoints(playerHand),
			dealerPoints: handPoints(dealerHand),
			playerType,
			dealerType,
			playerTypeName: handTypeName(playerType),
			dealerTypeName: handTypeName(dealerType),
			multiplier: result === 'win' ? getHandMultiplier(playerType) : 0
		},
		payout,
		won
	};
});
