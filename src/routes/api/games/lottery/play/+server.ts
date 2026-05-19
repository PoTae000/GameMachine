import { createGameHandler } from '$lib/server/gameHandler';
import { biasedDraw, countMatches, getMultiplier, LOTTERY_GRID, PICK_COUNT } from '$lib/games/lotteryEngine';

export const POST = createGameHandler('lottery', ({ bet, gameParams, winRate, gameConfig }) => {
	const picks: number[] = gameParams.picks;
	if (!Array.isArray(picks) || picks.length !== PICK_COUNT) {
		throw new Error('Invalid picks count');
	}
	for (const p of picks) {
		if (!Number.isInteger(p) || p < 1 || p > LOTTERY_GRID) {
			throw new Error('Invalid pick value');
		}
	}
	if (new Set(picks).size !== picks.length) {
		throw new Error('Duplicate picks');
	}

	const rareChance = gameConfig.rareChance ?? 50;
	const drawn = biasedDraw(picks, winRate, rareChance);
	const matches = countMatches(picks, drawn);
	const multiplier = getMultiplier(matches);
	const payout = multiplier > 0 ? Math.round(bet * multiplier * 100) / 100 : 0;
	const won = payout > 0;

	return {
		outcome: { drawn, matches, multiplier },
		payout,
		won
	};
});
