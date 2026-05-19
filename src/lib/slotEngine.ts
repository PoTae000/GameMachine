export interface Symbol {
	id: string;
	emoji: string;
	name: string;
	weight: number;
	pay3: number;
	pay4: number;
	pay5: number;
}

export const COLS = 5;
export const ROWS = 5;

export const SYMBOLS: Symbol[] = [
	{ id: 'cherry', emoji: '💠', name: 'ทับทิม', weight: 22, pay3: 4, pay4: 8, pay5: 18 },
	{ id: 'lemon', emoji: '🪙', name: 'เหรียญ', weight: 20, pay3: 7, pay4: 12, pay5: 25 },
	{ id: 'orange', emoji: '💚', name: 'มรกต', weight: 18, pay3: 8, pay4: 18, pay5: 35 },
	{ id: 'grape', emoji: '💜', name: 'อเมทิสต์', weight: 14, pay3: 12, pay4: 25, pay5: 50 },
	{ id: 'bell', emoji: '🔔', name: 'ระฆัง', weight: 10, pay3: 18, pay4: 38, pay5: 85 },
	{ id: 'diamond', emoji: '💎', name: 'เพชร', weight: 6, pay3: 25, pay4: 60, pay5: 125 },
	{ id: 'seven', emoji: '7️⃣', name: 'เซเว่น', weight: 3, pay3: 40, pay4: 100, pay5: 250 },
	{ id: 'star', emoji: '👑', name: 'มงกุฎ', weight: 2, pay3: 65, pay4: 170, pay5: 400 },
	{ id: 'scatter', emoji: '🔮', name: 'Scatter', weight: 5, pay3: 0, pay4: 0, pay5: 0 }
];

const REEL_SYMBOLS = SYMBOLS.filter((s) => s.id !== 'scatter');
const SCATTER = SYMBOLS.find((s) => s.id === 'scatter')!;

const TOTAL_WEIGHT = REEL_SYMBOLS.reduce((sum, s) => sum + s.weight, 0);

// 5 คอลัมน์ x 5 แถว — Paylines (row index per column, 0=top, 4=bot)
export const PAYLINES: number[][] = [
	// เส้นตรง (5 เส้น) — x1
	[0, 0, 0, 0, 0],
	[1, 1, 1, 1, 1],
	[2, 2, 2, 2, 2],
	[3, 3, 3, 3, 3],
	[4, 4, 4, 4, 4],
	// V/^ (2 เส้น) — x1.5
	[0, 1, 2, 1, 0],
	[4, 3, 2, 3, 4],
	// เฉียง (2 เส้น) — x2
	[0, 1, 2, 3, 4],
	[4, 3, 2, 1, 0],
];

// ตัวคูณโบนัสตามรูปแบบเส้น — ยิ่งเรียงยากยิ่งได้เยอะ
export const PAYLINE_MULTIPLIERS: number[] = [
	1, 1, 1, 1, 1,   // เส้นตรง x1
	1.5, 1.5,         // V/^ x1.5
	2, 2,             // เฉียง x2
];

export const PAYLINE_NAMES: string[] = [
	'แถว 1', 'แถว 2', 'แถว 3', 'แถว 4', 'แถว 5',
	'V', '^',
	'เฉียงลง', 'เฉียงขึ้น',
];

// Free spin ใช้ weight ที่ boost สัญลักษณ์หายาก (โอกาสชนะเยอะกว่า)
const BOOSTED_WEIGHTS: Record<string, number> = {
	cherry: 18,
	lemon: 17,
	orange: 16,
	grape: 15,
	bell: 13,
	diamond: 8,
	seven: 5,
	star: 3
};

const BOOSTED_TOTAL = Object.values(BOOSTED_WEIGHTS).reduce((a, b) => a + b, 0);

function pickSymbol(boosted = false, winRate = 50, scatterChance = 2.5): Symbol {
	// Scatter chance: ปกติ 2.5%, free spin ไม่มี scatter (ได้แล้ว)
	if (!boosted && Math.random() < (scatterChance / 100)) return SCATTER;

	if (boosted) {
		let rand = Math.random() * BOOSTED_TOTAL;
		for (const symbol of REEL_SYMBOLS) {
			rand -= BOOSTED_WEIGHTS[symbol.id] ?? symbol.weight;
			if (rand <= 0) return symbol;
		}
		return REEL_SYMBOLS[0];
	}

	// WinRate bias: higher winRate = boost rare symbols, lower = boost common symbols
	const biasMultiplier = winRate / 50;
	const adjustedWeights = REEL_SYMBOLS.map((s) => {
		const rarity = 1 - (s.weight / TOTAL_WEIGHT);
		const adjustment = 1 + (biasMultiplier - 1) * rarity * 2;
		return Math.max(0.5, s.weight * adjustment);
	});
	const adjustedTotal = adjustedWeights.reduce((a, b) => a + b, 0);

	let rand = Math.random() * adjustedTotal;
	for (let i = 0; i < REEL_SYMBOLS.length; i++) {
		rand -= adjustedWeights[i];
		if (rand <= 0) return REEL_SYMBOLS[i];
	}
	return REEL_SYMBOLS[0];
}

// Grid: grid[col][row] — 5 columns, 5 rows each
export type Grid = Symbol[][];

export function generateGrid(freeSpin = false, winRate = 50, scatterChance = 2.5): Grid {
	const grid: Grid = [];
	for (let col = 0; col < COLS; col++) {
		const column: Symbol[] = [];
		for (let row = 0; row < ROWS; row++) {
			column.push(pickSymbol(freeSpin, winRate, scatterChance));
		}
		grid.push(column);
	}
	return grid;
}

function hasPaylineWin(grid: Grid): boolean {
	for (const line of PAYLINES) {
		const firstSym = grid[0][line[0]];
		if (firstSym.id === 'scatter') continue;
		let count = 1;
		for (let col = 1; col < COLS; col++) {
			if (grid[col][line[col]].id === firstSym.id) count++;
			else break;
		}
		if (count >= 3) return true;
	}
	return false;
}

export function generateBiasedGrid(freeSpin = false, winRate = 50, scatterChance = 2.5): Grid {
	const shouldWin = Math.random() * 100 < winRate;

	for (let attempt = 0; attempt < 10; attempt++) {
		const grid = generateGrid(freeSpin, winRate, scatterChance);
		if (hasPaylineWin(grid) === shouldWin) return grid;
	}

	const centerRow = Math.floor(ROWS / 2);
	if (shouldWin) {
		const grid = generateGrid(freeSpin, winRate, scatterChance);
		const winSymbol = pickSymbol(freeSpin, winRate, scatterChance);
		if (winSymbol.id !== 'scatter' && winSymbol.pay3 > 0) {
			const matchCount = Math.random() < 0.3 ? 4 : 3;
			for (let col = 0; col < matchCount; col++) {
				grid[col][centerRow] = winSymbol;
			}
		} else {
			const cherry = REEL_SYMBOLS[0];
			grid[0][centerRow] = cherry;
			grid[1][centerRow] = cherry;
			grid[2][centerRow] = cherry;
		}
		return grid;
	} else {
		const grid = generateGrid(freeSpin, winRate, scatterChance);
		for (let attempt = 0; attempt < 50; attempt++) {
			if (!hasPaylineWin(grid)) return grid;
			for (let col = 0; col < COLS; col++) {
				grid[col][centerRow] = pickSymbol(freeSpin, 50, scatterChance);
			}
		}
		return grid;
	}
}

export interface LineWin {
	lineIndex: number;
	symbol: Symbol;
	count: number;
	patternMultiplier: number;
	patternName: string;
	payout: number;
}

export interface SpinResult {
	grid: Grid;
	lineWins: LineWin[];
	scatterCount: number;
	freeSpinsWon: number;
	totalPayout: number;
}

export function evaluateGrid(grid: Grid, bet: number): SpinResult {
	const betPerLine = bet / PAYLINES.length;
	const lineWins: LineWin[] = [];

	for (let li = 0; li < PAYLINES.length; li++) {
		const line = PAYLINES[li];
		const firstSym = grid[0][line[0]];

		if (firstSym.id === 'scatter') continue;

		let count = 1;
		for (let col = 1; col < COLS; col++) {
			if (grid[col][line[col]].id === firstSym.id) {
				count++;
			} else {
				break;
			}
		}

		if (count >= 3) {
			const basePayout =
				count === 5
					? firstSym.pay5 * betPerLine
					: count === 4
						? firstSym.pay4 * betPerLine
						: firstSym.pay3 * betPerLine;
			const patternMult = PAYLINE_MULTIPLIERS[li] ?? 1;
			const payout = basePayout * patternMult;

			lineWins.push({
				lineIndex: li,
				symbol: firstSym,
				count,
				patternMultiplier: patternMult,
				patternName: PAYLINE_NAMES[li] ?? '',
				payout
			});
		}
	}

	let scatterCount = 0;
	for (let col = 0; col < COLS; col++) {
		for (let row = 0; row < ROWS; row++) {
			if (grid[col][row].id === 'scatter') scatterCount++;
		}
	}

	const freeSpinsWon = scatterCount >= 4 ? 10 + (scatterCount - 4) * 5 : 0;
	const totalPayout = Math.round(lineWins.reduce((sum, w) => sum + w.payout, 0) * 100) / 100;

	return { grid, lineWins, scatterCount, freeSpinsWon, totalPayout };
}

export const BET_OPTIONS = [1, 5, 10, 20, 50, 100, 200, 500];

// ซื้อ Free Spin — จ่าย bet x multiplier แล้วได้ 10 รอบ
export const FREE_SPIN_COST_MULTIPLIER = 15;
