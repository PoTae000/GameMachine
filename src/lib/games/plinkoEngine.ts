export const ROWS = 12;
export const BUCKETS = ROWS + 1; // 13 buckets

export type RiskLevel = 'low' | 'medium' | 'high';

const MULTIPLIERS: Record<RiskLevel, number[]> = {
	low:    [2, 1.5, 1.2, 1, 0.5, 0.3, 0.5, 1, 1.2, 1.5, 2, 3, 5],
	medium: [5, 3, 2, 1.2, 0.5, 0.2, 0.5, 1.2, 2, 3, 5, 10, 15],
	high:   [15, 8, 4, 1.5, 0.5, 0.1, 0.5, 1.5, 4, 8, 15, 30, 50],
};

export function getMultipliers(risk: RiskLevel): number[] {
	return MULTIPLIERS[risk];
}

export function simulateDrop(risk: RiskLevel, winRate: number, rareChance = 50): { path: number[]; bucket: number } {
	const shouldWin = Math.random() * 100 < winRate;
	const mults = MULTIPLIERS[risk];
	// rareChance: higher = more likely to land on high-multiplier buckets when winning
	const rareThreshold = shouldWin ? (rareChance >= 50 ? 3 : 1.5) : 1;

	// Try many random drops
	for (let attempt = 0; attempt < 100; attempt++) {
		const path: number[] = [0];
		let pos = 0;
		for (let row = 0; row < ROWS; row++) {
			pos += Math.random() < 0.5 ? 0 : 1;
			path.push(pos);
		}
		const bucket = pos;
		const mult = mults[bucket] ?? 0;

		if (shouldWin && mult >= rareThreshold) return { path, bucket };
		if (!shouldWin && mult <= 1) return { path, bucket };
	}

	// Force construct: pick a target bucket and build path to it
	let targetBucket: number;
	if (shouldWin) {
		const winBuckets = mults.map((m, i) => ({ m, i })).filter(({ m }) => m >= 1.5);
		targetBucket = winBuckets[Math.floor(Math.random() * winBuckets.length)].i;
	} else {
		const loseBuckets = mults.map((m, i) => ({ m, i })).filter(({ m }) => m <= 1);
		targetBucket = loseBuckets[Math.floor(Math.random() * loseBuckets.length)].i;
	}

	// Build a path that lands on targetBucket
	// After ROWS steps, pos = number of right moves. So we need exactly targetBucket right moves.
	const rights = targetBucket;
	const lefts = ROWS - rights;
	const moves: number[] = [];
	for (let i = 0; i < rights; i++) moves.push(1);
	for (let i = 0; i < lefts; i++) moves.push(0);
	// Shuffle moves for natural-looking path
	for (let i = moves.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[moves[i], moves[j]] = [moves[j], moves[i]];
	}

	const path: number[] = [0];
	let pos = 0;
	for (const move of moves) {
		pos += move;
		path.push(pos);
	}
	return { path, bucket: pos };
}
