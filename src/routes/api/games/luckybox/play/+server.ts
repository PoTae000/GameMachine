import { createGameHandler } from '$lib/server/gameHandler';
import { biasedLuckyBox, BOX_COUNT } from '$lib/games/luckyboxEngine';

export const POST = createGameHandler('luckybox', ({ bet, gameParams, winRate }) => {
	const box = gameParams.box as number;
	if (!Number.isInteger(box) || box < 0 || box >= BOX_COUNT) {
		return { outcome: { error: 'Invalid box' }, payout: bet, won: false };
	}

	const { chosenBox, multiplier, allBoxes } = biasedLuckyBox(box, winRate);
	const payout = Math.round(bet * multiplier * 100) / 100;
	const won = multiplier > 1;

	return {
		outcome: { chosenBox, multiplier, allBoxes },
		payout,
		won
	};
});
