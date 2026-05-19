export interface WheelSegment {
	label: string;
	multiplier: number;
	color: string;
}

export const SEGMENTS: WheelSegment[] = [
	{ label: 'x0', multiplier: 0, color: '#374151' },
	{ label: 'x2', multiplier: 2, color: '#3b82f6' },
	{ label: 'x0.5', multiplier: 0.5, color: '#6b7280' },
	{ label: 'x3', multiplier: 3, color: '#8b5cf6' },
	{ label: 'x1.5', multiplier: 1.5, color: '#3b82f6' },
	{ label: 'x0', multiplier: 0, color: '#374151' },
	{ label: 'x5', multiplier: 5, color: '#f59e0b' },
	{ label: 'x2', multiplier: 2, color: '#3b82f6' },
	{ label: 'x0.5', multiplier: 0.5, color: '#6b7280' },
	{ label: 'x3', multiplier: 3, color: '#8b5cf6' },
	{ label: 'x0', multiplier: 0, color: '#374151' },
	{ label: 'x10', multiplier: 10, color: '#ef4444' },
	{ label: 'x1.5', multiplier: 1.5, color: '#3b82f6' },
	{ label: 'x5', multiplier: 5, color: '#f59e0b' },
	{ label: 'x0', multiplier: 0, color: '#374151' },
	{ label: 'x2', multiplier: 2, color: '#8b5cf6' },
	{ label: 'x0.5', multiplier: 0.5, color: '#6b7280' },
	{ label: 'x15', multiplier: 15, color: '#dc2626' },
	{ label: 'x3', multiplier: 3, color: '#8b5cf6' },
	{ label: 'x1.5', multiplier: 1.5, color: '#3b82f6' },
];

export function biasedSpin(winRate: number, rareChance = 50): number {
	const shouldWin = Math.random() * 100 < winRate;

	if (shouldWin) {
		// rareChance controls how often high-multiplier segments appear
		// Higher rareChance = more likely to land on x5, x10
		const rareRoll = Math.random() * 100 < rareChance;
		if (rareRoll) {
			const bigWinners = SEGMENTS.map((s, i) => ({ s, i })).filter(({ s }) => s.multiplier >= 5);
			if (bigWinners.length > 0) {
				return bigWinners[Math.floor(Math.random() * bigWinners.length)].i;
			}
		}
		const winners = SEGMENTS.map((s, i) => ({ s, i })).filter(({ s }) => s.multiplier >= 1.5);
		const pick = winners[Math.floor(Math.random() * winners.length)];
		return pick.i;
	} else {
		// Pick a losing segment (multiplier <= 0.5)
		const losers = SEGMENTS.map((s, i) => ({ s, i })).filter(({ s }) => s.multiplier <= 0.5);
		const pick = losers[Math.floor(Math.random() * losers.length)];
		return pick.i;
	}
}
