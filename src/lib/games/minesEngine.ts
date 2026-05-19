export const GRID_SIZE = 25; // 5x5

export interface MinesGame {
	mines: Set<number>;
	revealed: Set<number>;
	mineCount: number;
	gameOver: boolean;
	cashedOut: boolean;
}

export function getMultiplier(mineCount: number, revealed: number): number {
	// Provably fair multiplier based on remaining safe tiles
	const totalTiles = GRID_SIZE;
	let mult = 1;
	for (let i = 0; i < revealed; i++) {
		mult *= (totalTiles - mineCount - i) > 0
			? totalTiles - i
			: totalTiles - i;
		mult /= (totalTiles - mineCount - i) > 0
			? (totalTiles - mineCount - i)
			: 1;
	}
	return Math.floor(mult * 100) / 100;
}

export function createGame(mineCount: number, winRate: number): MinesGame {
	const mines = new Set<number>();
	while (mines.size < mineCount) {
		mines.add(Math.floor(Math.random() * GRID_SIZE));
	}
	return {
		mines,
		revealed: new Set(),
		mineCount,
		gameOver: false,
		cashedOut: false
	};
}

export function biasedReveal(game: MinesGame, cell: number, winRate: number, mineRelocate = true): boolean {
	// If mine relocate is disabled, use unbiased reveal
	if (!mineRelocate) {
		if (game.mines.has(cell)) {
			game.gameOver = true;
			return false;
		}
		game.revealed.add(cell);
		return true;
	}

	// If cell was already determined to be a mine
	if (game.mines.has(cell)) {
		// Bias: maybe move the mine away
		const shouldWin = Math.random() * 100 < winRate;
		if (shouldWin) {
			// Move mine to an unrevealed, unselected cell
			const candidates: number[] = [];
			for (let i = 0; i < GRID_SIZE; i++) {
				if (i !== cell && !game.revealed.has(i) && !game.mines.has(i)) {
					candidates.push(i);
				}
			}
			if (candidates.length > 0) {
				const newPos = candidates[Math.floor(Math.random() * candidates.length)];
				game.mines.delete(cell);
				game.mines.add(newPos);
				game.revealed.add(cell);
				return true; // safe
			}
		}
		game.gameOver = true;
		return false; // hit mine
	}

	// Cell is safe, but bias might make it a mine
	const shouldLose = Math.random() * 100 >= winRate;
	if (shouldLose && game.revealed.size >= 2) {
		// Move a mine to this cell
		const mineArr = [...game.mines];
		if (mineArr.length > 0) {
			const oldMine = mineArr[Math.floor(Math.random() * mineArr.length)];
			// Find a safe unrevealed cell to move the old mine to
			const candidates: number[] = [];
			for (let i = 0; i < GRID_SIZE; i++) {
				if (i !== cell && !game.revealed.has(i) && !game.mines.has(i) && i !== oldMine) {
					candidates.push(i);
				}
			}
			if (candidates.length > 0) {
				const newPos = candidates[Math.floor(Math.random() * candidates.length)];
				game.mines.delete(oldMine);
				game.mines.add(cell);
				game.mines.add(newPos);
				// Keep mine count consistent
				if (game.mines.size > game.mineCount) {
					game.mines.delete(newPos);
				}
				game.gameOver = true;
				return false; // hit mine
			}
		}
	}

	game.revealed.add(cell);
	return true; // safe
}

export const MINE_COUNTS = [1, 3, 5, 10, 15, 20];
