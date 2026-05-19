export type CoinSide = 'heads' | 'tails';

export function flipCoin(): CoinSide {
	return Math.random() < 0.5 ? 'heads' : 'tails';
}

export function biasedFlip(guess: CoinSide, winRate: number): CoinSide {
	const shouldWin = Math.random() * 100 < winRate;
	if (shouldWin) return guess;
	return guess === 'heads' ? 'tails' : 'heads';
}

export function evaluateCoinFlip(guess: CoinSide, result: CoinSide): boolean {
	return guess === result;
}

export const COINFLIP_MULTIPLIER = 1.9;
