import { createGameHandler } from '$lib/server/gameHandler';
import { biasedSpin, SEGMENTS } from '$lib/games/wheelEngine';

export const POST = createGameHandler('wheel', ({ bet, winRate, gameConfig }) => {
	const rareChance = gameConfig.rareChance ?? 50;
	const segmentIndex = biasedSpin(winRate, rareChance);
	const segment = SEGMENTS[segmentIndex];
	const payout = Math.round(bet * segment.multiplier * 100) / 100;
	const won = segment.multiplier >= 1.5;

	return {
		outcome: { segmentIndex, multiplier: segment.multiplier, label: segment.label },
		payout,
		won
	};
});
