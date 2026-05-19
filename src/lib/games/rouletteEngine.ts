export type BetType = 'red' | 'black' | 'odd' | 'even' | 'high' | 'low' | 'number';

export interface RouletteBet {
	type: BetType;
	value?: number; // for number bets
	multiplier: number;
}

export const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

export function getColor(n: number): 'red' | 'black' | 'green' {
	if (n === 0) return 'green';
	return RED_NUMBERS.includes(n) ? 'red' : 'black';
}

export function spin(): number {
	return Math.floor(Math.random() * 37); // 0-36
}

export function biasedSpin(bet: RouletteBet, winRate: number): number {
	const shouldWin = Math.random() * 100 < winRate;
	const allNumbers = Array.from({ length: 37 }, (_, i) => i);

	if (shouldWin) {
		// Pick a number that matches the bet
		const winners = allNumbers.filter((n) => evaluateBet(bet, n));
		if (winners.length > 0) return winners[Math.floor(Math.random() * winners.length)];
	} else {
		// Pick a number that does NOT match the bet
		const losers = allNumbers.filter((n) => !evaluateBet(bet, n));
		if (losers.length > 0) return losers[Math.floor(Math.random() * losers.length)];
	}
	return spin();
}

export function evaluateBet(bet: RouletteBet, result: number): boolean {
	switch (bet.type) {
		case 'red': return getColor(result) === 'red';
		case 'black': return getColor(result) === 'black';
		case 'odd': return result > 0 && result % 2 === 1;
		case 'even': return result > 0 && result % 2 === 0;
		case 'high': return result >= 19 && result <= 36;
		case 'low': return result >= 1 && result <= 18;
		case 'number': return result === bet.value;
		default: return false;
	}
}

export function getMultiplier(type: BetType): number {
	switch (type) {
		case 'red': case 'black': case 'odd': case 'even': case 'high': case 'low':
			return 2;
		case 'number':
			return 36;
	}
}

export const BET_TYPES: { type: BetType; label: string; multiplier: number }[] = [
	{ type: 'red', label: 'แดง', multiplier: 2 },
	{ type: 'black', label: 'ดำ', multiplier: 2 },
	{ type: 'odd', label: 'คี่', multiplier: 2 },
	{ type: 'even', label: 'คู่', multiplier: 2 },
	{ type: 'high', label: 'สูง (19-36)', multiplier: 2 },
	{ type: 'low', label: 'ต่ำ (1-18)', multiplier: 2 },
];
