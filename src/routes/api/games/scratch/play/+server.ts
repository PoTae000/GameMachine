import { createGameHandler } from '$lib/server/gameHandler';
import { generateCard } from '$lib/games/scratchEngine';

export const POST = createGameHandler('scratch', ({ bet, winRate, gameConfig }) => {
	const rareChance = gameConfig.rareChance ?? 50;
	const card = generateCard(winRate, rareChance);

	const payout = card.result.won ? Math.round(bet * card.result.multiplier * 100) / 100 : 0;

	return {
		outcome: {
			grid: card.grid,
			result: card.result
		},
		payout,
		won: card.result.won
	};
});
