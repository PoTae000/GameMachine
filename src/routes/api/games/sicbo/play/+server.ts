import { createGameHandler } from '$lib/server/gameHandler';
import { biasedRoll, evaluateBet, getMultiplier, type SicboBet, type SicboBetType } from '$lib/games/sicboEngine';

const VALID_BET_TYPES: SicboBetType[] = ['high', 'low', 'total', 'triple'];

export const POST = createGameHandler('sicbo', ({ bet, gameParams, winRate, gameConfig }) => {
	const betType: SicboBetType = gameParams.betType;
	if (!VALID_BET_TYPES.includes(betType)) {
		throw new Error('Invalid bet type');
	}

	let totalValue: number | undefined;
	if (betType === 'total') {
		totalValue = Number(gameParams.totalValue);
		if (!Number.isInteger(totalValue) || totalValue < 3 || totalValue > 18) {
			throw new Error('Invalid total value');
		}
	}

	const sicboBet: SicboBet = { type: betType, value: totalValue };
	const rareChance = gameConfig.rareChance ?? 50;
	const result = biasedRoll(sicboBet, winRate, rareChance);
	const won = evaluateBet(sicboBet, result);
	const multiplier = getMultiplier(sicboBet);
	const payout = won ? Math.round(bet * multiplier * 100) / 100 : 0;

	return {
		outcome: { dice: result.dice, total: result.total },
		payout,
		won
	};
});
