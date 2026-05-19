import { createGameHandler } from '$lib/server/gameHandler';
import { biasedFlip, evaluateCoinFlip, COINFLIP_MULTIPLIER, type CoinSide } from '$lib/games/coinflipEngine';

export const POST = createGameHandler('coinflip', ({ bet, gameParams, winRate }) => {
	const guess: CoinSide = gameParams.guess;
	if (guess !== 'heads' && guess !== 'tails') {
		throw new Error('Invalid guess');
	}

	const result = biasedFlip(guess, winRate);
	const won = evaluateCoinFlip(guess, result);
	const payout = won ? Math.round(bet * COINFLIP_MULTIPLIER * 100) / 100 : 0;

	return {
		outcome: { result },
		payout,
		won
	};
});
