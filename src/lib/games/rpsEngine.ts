export type RPSChoice = 'rock' | 'paper' | 'scissors';
export type RPSResult = 'win' | 'lose' | 'draw';

export interface RPSOutcome {
	houseChoice: RPSChoice;
	result: RPSResult;
}

export const RPS_WIN_MULTIPLIER = 2.7;
export const RPS_DRAW_MULTIPLIER = 1; // refund

const CHOICES: RPSChoice[] = ['rock', 'paper', 'scissors'];

const BEATS: Record<RPSChoice, RPSChoice> = {
	rock: 'scissors',
	paper: 'rock',
	scissors: 'paper'
};

const LOSES_TO: Record<RPSChoice, RPSChoice> = {
	rock: 'paper',
	paper: 'scissors',
	scissors: 'rock'
};

export function biasedRPS(playerChoice: RPSChoice, winRate: number): RPSOutcome {
	// 10% draw chance
	if (Math.random() < 0.10) {
		return { houseChoice: playerChoice, result: 'draw' };
	}

	const shouldWin = Math.random() * 100 < winRate;

	if (shouldWin) {
		// Player wins: house plays what player beats
		return { houseChoice: BEATS[playerChoice], result: 'win' };
	} else {
		// Player loses: house plays what beats player
		return { houseChoice: LOSES_TO[playerChoice], result: 'lose' };
	}
}
