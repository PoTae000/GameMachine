export const LOTTERY_GRID = 36;
export const PICK_COUNT = 5;
export const DRAW_COUNT = 5;

const PAYOUTS: Record<number, number> = {
	2: 3,
	3: 15,
	4: 200,
	5: 1000
};

export function getMultiplier(matches: number): number {
	return PAYOUTS[matches] ?? 0;
}

export function drawNumbers(): number[] {
	const pool = Array.from({ length: LOTTERY_GRID }, (_, i) => i + 1);
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
	// rareChance: higher = more matches when winning
	const matchBoost = rareChance >= 70 ? 3 : rareChance >= 50 ? 2 : 2;

	for (let attempt = 0; attempt < 100; attempt++) {
		const drawn = drawNumbers();
		const matches = countMatches(picks, drawn);
		const mult = getMultiplier(matches);

		if (shouldWin && mult > 0) return drawn;
		if (!shouldWin && mult === 0) return drawn;
	}

	if (shouldWin) {
		// Include at least matchBoost picked numbers to guarantee a payout
		const shuffled = [...picks].sort(() => Math.random() - 0.5);
		const included = shuffled.slice(0, matchBoost);
		const pool = Array.from({ length: LOTTERY_GRID }, (_, i) => i + 1).filter((n) => !picks.includes(n));
		const rest: number[] = [];
		while (rest.length < DRAW_COUNT - included.length && pool.length > 0) {
			const idx = Math.floor(Math.random() * pool.length);
			rest.push(pool[idx]);
			pool.splice(idx, 1);
		}
		return [...included, ...rest].sort((a, b) => a - b);
	}

	// Force lose: draw only from non-picked numbers
	const pool = Array.from({ length: LOTTERY_GRID }, (_, i) => i + 1).filter((n) => !picks.includes(n));
	const drawn: number[] = [];
	while (drawn.length < DRAW_COUNT && pool.length > 0) {
		const idx = Math.floor(Math.random() * pool.length);
		drawn.push(pool[idx]);
		pool.splice(idx, 1);
	}
	return drawn.sort((a, b) => a - b);
}

export function countMatches(picks: number[], drawn: number[]): number {
	return picks.filter((p) => drawn.includes(p)).length;
}
