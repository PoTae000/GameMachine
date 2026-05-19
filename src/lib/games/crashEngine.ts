export function generateCrashPoint(winRate: number, maxMultiplier = 15): number {
	const shouldWin = Math.random() * 100 < winRate;

	if (shouldWin) {
		// Win: crash at 1.5x-maxMultiplier, weighted towards lower multipliers
		const cap = Math.max(2, maxMultiplier);
		const r = Math.random();
		if (r < 0.40) {
			// 1.5x - 30% of cap (common)
			const hi = Math.max(2, cap * 0.2);
			return Math.round((1.5 + Math.random() * (hi - 1.5)) * 100) / 100;
		} else if (r < 0.70) {
			// 20%-40% of cap
			const lo = cap * 0.2;
			const hi = cap * 0.4;
			return Math.round((lo + Math.random() * (hi - lo)) * 100) / 100;
		} else if (r < 0.90) {
			// 40%-70% of cap
			const lo = cap * 0.4;
			const hi = cap * 0.7;
			return Math.round((lo + Math.random() * (hi - lo)) * 100) / 100;
		} else {
			// 70%-100% of cap (rare)
			const lo = cap * 0.7;
			return Math.round((lo + Math.random() * (cap - lo)) * 100) / 100;
		}
	} else {
		// Lose: crash at 1.0x-2.2x (gives player a chance to cash out small)
		const r = Math.random();
		if (r < 0.15) {
			return 1.0;
		} else if (r < 0.50) {
			// 1.1x - 1.5x
			return Math.round((1.1 + Math.random() * 0.4) * 100) / 100;
		} else {
			// 1.5x - 2.2x (decent window to cash out)
			return Math.round((1.5 + Math.random() * 0.7) * 100) / 100;
		}
	}
}
