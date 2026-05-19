import { createGameHandler } from '$lib/server/gameHandler';
import { biasedSpin, evaluateBet, getMultiplier, type BetType, type RouletteBet } from '$lib/games/rouletteEngine';

const VALID_BET_TYPES: BetType[] = ['red', 'black', 'odd', 'even', 'high', 'low', 'number'];

export const POST = createGameHandler('roulette', ({ bet, gameParams, winRate }) => {
	const betType: BetType = gameParams.betType;
	if (!VALID_BET_TYPES.includes(betType)) {
		throw new Error('Invalid bet type');
	}

	const betValue = betType === 'number' ? Number(gameParams.betValue) : undefined;
	if (betType === 'number' && (betValue === undefined || betValue < 0 || betValue > 36 || !Number.isInteger(betValue))) {
		throw new Error('Invalid number');
	}

	const rBet: RouletteBet = {
		type: betType,
		value: betValue,
		multiplier: getMultiplier(betType)
	};

	const resultNumber = biasedSpin(rBet, winRate);
	const won = evaluateBet(rBet, resultNumber);
	const payout = won ? Math.round(bet * rBet.multiplier * 100) / 100 : 0;

	return {
		outcome: { resultNumber },
		payout,
		won
	};
});
