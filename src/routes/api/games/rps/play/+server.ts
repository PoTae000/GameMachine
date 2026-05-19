import { createGameHandler } from '$lib/server/gameHandler';
import { biasedRPS, RPS_WIN_MULTIPLIER, RPS_DRAW_MULTIPLIER, type RPSChoice } from '$lib/games/rpsEngine';

const VALID_CHOICES: RPSChoice[] = ['rock', 'paper', 'scissors'];

export const POST = createGameHandler('rps', ({ bet, gameParams, winRate }) => {
	const playerChoice = gameParams.choice as RPSChoice;
	if (!VALID_CHOICES.includes(playerChoice)) {
		return { outcome: { error: 'Invalid choice' }, payout: bet, won: false };
	}

	const { houseChoice, result } = biasedRPS(playerChoice, winRate);

	let payout = 0;
	let won = false;

	if (result === 'win') {
		payout = Math.round(bet * RPS_WIN_MULTIPLIER * 100) / 100;
		won = true;
	} else if (result === 'draw') {
		payout = bet; // refund
		won = false;
	}
	// lose: payout = 0

	return {
		outcome: { playerChoice, houseChoice, result },
		payout,
		won
	};
});
