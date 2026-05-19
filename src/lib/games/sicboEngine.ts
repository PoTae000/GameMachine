export interface SicboResult {
	dice: [number, number, number];
	total: number;
}

export type SicboBetType = 'high' | 'low' | 'total' | 'triple';

export interface SicboBet {
	type: SicboBetType;
	value?: number;
}

export function rollDice(): SicboResult {
	const dice: [number, number, number] = [
		Math.floor(Math.random() * 6) + 1,
		Math.floor(Math.random() * 6) + 1,
		Math.floor(Math.random() * 6) + 1
	];
	return { dice, total: dice[0] + dice[1] + dice[2] };
}

function isTriple(result: SicboResult): boolean {
	return result.dice[0] === result.dice[1] && result.dice[1] === result.dice[2];
}

export function evaluateBet(bet: SicboBet, result: SicboResult): boolean {
	switch (bet.type) {
		case 'high':
			return result.total >= 11 && result.total <= 17 && !isTriple(result);
		case 'low':
			return result.total >= 4 && result.total <= 10 && !isTriple(result);
		case 'total':
			return result.total === bet.value;
		case 'triple':
			return isTriple(result);
		default:
			return false;
	}
}

export function getMultiplier(bet: SicboBet): number {
	switch (bet.type) {
		case 'high':
		case 'low':
			return 2;
		case 'triple':
			return 30;
		case 'total': {
			const v = bet.value ?? 10;
			if (v === 3 || v === 18) return 60;
			if (v === 4 || v === 17) return 50;
			if (v === 5 || v === 16) return 30;
			if (v === 6 || v === 15) return 18;
			if (v === 7 || v === 14) return 12;
			if (v === 8 || v === 13) return 8;
			if (v === 9 || v === 12) return 7;
			if (v === 10 || v === 11) return 6;
			return 6;
		}
	}
}

export function biasedRoll(bet: SicboBet, winRate: number, rareChance = 50): SicboResult {
	// rareChance: higher = more triple outcomes
	// If betting on triple and rareChance is high, boost the chance
	let effectiveWinRate = winRate;
	if (bet.type === 'triple') {
		effectiveWinRate = winRate + (rareChance - 50) * 0.5;
		effectiveWinRate = Math.max(0, Math.min(100, effectiveWinRate));
	}
	const shouldWin = Math.random() * 100 < effectiveWinRate;

	for (let attempt = 0; attempt < 100; attempt++) {
		const result = rollDice();
		const won = evaluateBet(bet, result);
		if (won === shouldWin) return result;
	}

	if (shouldWin) {
		return forceWin(bet);
	}
	return forceLose(bet);
}

function forceWin(bet: SicboBet): SicboResult {
	if (bet.type === 'triple') {
		const v = Math.floor(Math.random() * 6) + 1;
		return { dice: [v, v, v], total: v * 3 };
	}
	if (bet.type === 'total') {
		const target = bet.value ?? 10;
		for (let i = 0; i < 1000; i++) {
			const result = rollDice();
			if (result.total === target) return result;
		}
	}
	for (let i = 0; i < 1000; i++) {
		const result = rollDice();
		if (evaluateBet(bet, result)) return result;
	}
	return rollDice();
}

function forceLose(bet: SicboBet): SicboResult {
	for (let i = 0; i < 100; i++) {
		const result = rollDice();
		if (!evaluateBet(bet, result)) return result;
	}
	return rollDice();
}
