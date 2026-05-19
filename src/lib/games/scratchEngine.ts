export type SymbolType = 'diamond' | 'crown' | 'heart' | 'star' | 'circle';

export interface ScratchCard {
	grid: SymbolType[][];
	result: ScratchResult;
}

export interface ScratchResult {
	won: boolean;
	matchSymbol: SymbolType | null;
	matchCount: number;
	multiplier: number;
}

const SYMBOLS: SymbolType[] = ['diamond', 'crown', 'heart', 'star', 'circle'];

const SYMBOL_MULTIPLIERS: Record<SymbolType, number> = {
	diamond: 15,
	crown: 8,
	heart: 4,
	star: 2.5,
	circle: 1.5
};

function randomSymbol(): SymbolType {
	return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

function countSymbols(grid: SymbolType[][]): Record<SymbolType, number> {
	const counts: Record<string, number> = {};
	for (const row of grid) {
		for (const s of row) {
			counts[s] = (counts[s] || 0) + 1;
		}
	}
	return counts as Record<SymbolType, number>;
}

function evaluateGrid(grid: SymbolType[][]): ScratchResult {
	const counts = countSymbols(grid);
	let bestSymbol: SymbolType | null = null;
	let bestCount = 0;
	let bestValue = 0;

	for (const sym of SYMBOLS) {
		const c = counts[sym] || 0;
		if (c >= 3) {
			const value = SYMBOL_MULTIPLIERS[sym] * (c >= 5 ? 3 : c >= 4 ? 2 : 1);
			if (value > bestValue) {
				bestSymbol = sym;
				bestCount = c;
				bestValue = value;
			}
		}
	}

	if (bestSymbol) {
		return { won: true, matchSymbol: bestSymbol, matchCount: bestCount, multiplier: bestValue };
	}
	return { won: false, matchSymbol: null, matchCount: 0, multiplier: 0 };
}

function generateRandomGrid(): SymbolType[][] {
	return Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => randomSymbol()));
}

function generateWinGrid(rareChance = 50): SymbolType[][] {
	// Pick a symbol to match — rareChance boosts high-value symbols
	const boost = rareChance / 50; // >1 = more rare, <1 = more common
	const weights = [1 * boost * boost, 2 * boost, 3, 4 / boost, 5 / (boost * boost)]; // diamond boosted at high rareChance
	const totalWeight = weights.reduce((a, b) => a + b, 0);
	let r = Math.random() * totalWeight;
	let symIdx = 0;
	for (let i = 0; i < weights.length; i++) {
		r -= weights[i];
		if (r <= 0) { symIdx = i; break; }
	}
	const sym = SYMBOLS[symIdx];

	// How many matches (3, 4, or 5) — weighted towards 3
	const matchRoll = Math.random();
	const matchCount = matchRoll < 0.7 ? 3 : matchRoll < 0.95 ? 4 : 5;

	// Place matches in random positions
	const positions = Array.from({ length: 9 }, (_, i) => i);
	const shuffled = positions.sort(() => Math.random() - 0.5);
	const matchPositions = new Set(shuffled.slice(0, matchCount));

	const grid: SymbolType[][] = [[], [], []];
	for (let i = 0; i < 9; i++) {
		const row = Math.floor(i / 3);
		if (matchPositions.has(i)) {
			grid[row].push(sym);
		} else {
			// Fill with other symbols (avoid creating another 3-match)
			const others = SYMBOLS.filter((s) => s !== sym);
			grid[row].push(others[Math.floor(Math.random() * others.length)]);
		}
	}
	return grid;
}

function generateLoseGrid(): SymbolType[][] {
	for (let attempt = 0; attempt < 100; attempt++) {
		const grid = generateRandomGrid();
		const result = evaluateGrid(grid);
		if (!result.won) return grid;
	}
	// Fallback: guaranteed no 3-match
	return [
		['diamond', 'crown', 'heart'],
		['star', 'circle', 'diamond'],
		['crown', 'heart', 'star']
	];
}

export function generateCard(winRate: number, rareChance = 50): ScratchCard {
	const shouldWin = Math.random() * 100 < winRate;

	// rareChance: higher = more likely to get high-value symbols (diamond, crown)
	const grid = shouldWin ? generateWinGrid(rareChance) : generateLoseGrid();
	const result = evaluateGrid(grid);

	// If we wanted a win but got a lose (shouldn't happen often), retry
	if (shouldWin && !result.won) {
		const retryGrid = generateWinGrid();
		return { grid: retryGrid, result: evaluateGrid(retryGrid) };
	}

	return { grid, result };
}

export { SYMBOL_MULTIPLIERS, SYMBOLS };
