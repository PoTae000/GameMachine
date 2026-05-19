import { createGameHandler } from '$lib/server/gameHandler';
import { biasedDraw, countMatches, getMultiplier, KENO_GRID, MAX_PICKS } from '$lib/games/kenoEngine';

export const POST = createGameHandler('keno', ({ bet, gameParams, winRate, gameConfig }) => {
	const picks: number[] = gameParams.picks;
	if (!Array.isArray(picks) || picks.length < 1 || picks.length > MAX_PICKS) {
		throw new Error('Invalid picks');
	}
	// Validate all picks are valid numbers within grid
	for (const p of picks) {
		if (!Number.isInteger(p) || p < 1 || p > KENO_GRID) {
			throw new Error('Invalid pick value');
		}
	}
	// Check for duplicates
	if (new Set(picks).size !== picks.length) {
		throw new Error('Duplicate picks');
	}

	const rareChance = gameConfig.rareChance ?? 50;
	const drawn = biasedDraw(picks, winRate, rareChance);
	const matches = countMatches(picks, drawn);
	const multiplier = getMultiplier(picks.length, matches);
	const payout = multiplier > 0 ? Math.round(bet * multiplier * 100) / 100 : 0;
	const won = payout > 0;

	return {
		outcome: { drawn, matches, multiplier },
		payout,
		won
	};
});
