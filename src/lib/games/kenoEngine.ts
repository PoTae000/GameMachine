export const KENO_GRID = 40;
export const MAX_PICKS = 10;
export const DRAW_COUNT = 10;

// Payout table: [picks][matches] = multiplier
const PAYOUTS: Record<number, Record<number, number>> = {
	1: { 1: 3.5 },
	2: { 2: 9 },
	3: { 2: 2, 3: 25 },
	4: { 2: 1.5, 3: 5, 4: 50 },
	5: { 3: 3, 4: 15, 5: 100 },
	6: { 3: 2, 4: 5, 5: 30, 6: 200 },
	7: { 3: 1.5, 4: 3, 5: 12, 6: 75, 7: 400 },
	8: { 4: 2, 5: 8, 6: 30, 7: 150, 8: 800 },
	9: { 4: 1.5, 5: 5, 6: 15, 7: 75, 8: 300, 9: 1500 },
	10: { 5: 3, 6: 10, 7: 40, 8: 150, 9: 500, 10: 3000 },
};

export function getMultiplier(picks: number, matches: number): number {
	return PAYOUTS[picks]?.[matches] ?? 0;
}

export function drawNumbers(): number[] {
	const pool = Array.from({ length: KENO_GRID }, (_, i) => i + 1);
	const drawn: number[] = [];
	for (let i = 0; i < DRAW_COUNT; i++) {
		const idx = Math.floor(Math.random() * pool.length);
		drawn.push(pool[idx]);
		pool.splice(idx, 1);
	}
	return drawn.sort((a, b) => a - b);
}

export function biasedDraw(picks: number[], winRate: number, rareChance = 50): number[] {
	const shouldWin = Math.random() * 100 < winRate;
	const pickCount = picks.length;
	// rareChance: higher = more matches when winning
	const minMatchBoost = rareChance >= 70 ? 1 : 0;

	for (let attempt = 0; attempt < 100; attempt++) {
		const drawn = drawNumbers();
		const matches = picks.filter((p) => drawn.includes(p)).length;
		const mult = getMultiplier(pickCount, matches);

		if (shouldWin && mult > 0) return drawn;
		if (!shouldWin && mult === 0) return drawn;
	}

	// Force construct result
	if (shouldWin) {
		// Include enough picked numbers to guarantee a payout
		const minMatches = Math.min(pickCount, Math.ceil(pickCount / 2) + minMatchBoost);
		const included = picks.slice(0, minMatches);
		const pool = Array.from({ length: KENO_GRID }, (_, i) => i + 1).filter((n) => !picks.includes(n));
		const rest: number[] = [];
		for (let i = 0; rest.length < DRAW_COUNT - included.length && i < pool.length; i++) {
			const idx = Math.floor(Math.random() * pool.length);
			rest.push(pool[idx]);
			pool.splice(idx, 1);
		}
		return [...included, ...rest].sort((a, b) => a - b);
	}

	// Force lose: draw only from non-picked numbers
	const pool = Array.from({ length: KENO_GRID }, (_, i) => i + 1).filter((n) => !picks.includes(n));
	const drawn: number[] = [];
	for (let i = 0; drawn.length < DRAW_COUNT && pool.length > 0; i++) {
		const idx = Math.floor(Math.random() * pool.length);
		drawn.push(pool[idx]);
		pool.splice(idx, 1);
	}
	return drawn.sort((a, b) => a - b);
}

export function countMatches(picks: number[], drawn: number[]): number {
	return picks.filter((p) => drawn.includes(p)).length;
}
