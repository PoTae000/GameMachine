export type Difficulty = 'easy' | 'medium' | 'hard';

export interface DifficultyConfig {
	columns: number;
	traps: number;
	floors: number;
	baseMultiplier: number; // per-floor multiplier growth
}

export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
	easy: { columns: 4, traps: 1, floors: 10, baseMultiplier: 1.33 },
	medium: { columns: 3, traps: 1, floors: 8, baseMultiplier: 1.5 },
	hard: { columns: 2, traps: 1, floors: 6, baseMultiplier: 2.0 }
};

export interface TowerGame {
	difficulty: Difficulty;
	trapPositions: number[]; // trap column per floor (length = floors)
	floorsCleared: number;
	gameOver: boolean;
	cashedOut: boolean;
}

export function createTowerGame(difficulty: Difficulty): TowerGame {
	const config = DIFFICULTY_CONFIG[difficulty];
	const trapPositions: number[] = [];

	for (let i = 0; i < config.floors; i++) {
		trapPositions.push(Math.floor(Math.random() * config.columns));
	}

	return {
		difficulty,
		trapPositions,
		floorsCleared: 0,
		gameOver: false,
		cashedOut: false
	};
}

export function getFloorMultiplier(difficulty: Difficulty, floorsCleared: number): number {
	if (floorsCleared <= 0) return 1;
	const config = DIFFICULTY_CONFIG[difficulty];
	const mult = Math.pow(config.baseMultiplier, floorsCleared);
	return Math.floor(mult * 100) / 100;
}

export function biasedTowerReveal(
	game: TowerGame,
	column: number,
	winRate: number
): boolean {
	const currentFloor = game.floorsCleared;
	const config = DIFFICULTY_CONFIG[game.difficulty];

	if (column < 0 || column >= config.columns) return false;
	if (currentFloor >= config.floors) return false;

	const isTrap = game.trapPositions[currentFloor] === column;

	if (isTrap) {
		// Player picked the trap - maybe relocate based on winRate
		const shouldWin = Math.random() * 100 < winRate;
		if (shouldWin) {
			// Move trap to another column on this floor
			const candidates = [];
			for (let c = 0; c < config.columns; c++) {
				if (c !== column) candidates.push(c);
			}
			if (candidates.length > 0) {
				game.trapPositions[currentFloor] = candidates[Math.floor(Math.random() * candidates.length)];
				game.floorsCleared++;
				return true; // safe
			}
		}
		game.gameOver = true;
		return false; // hit trap
	} else {
		// Player picked safe - maybe convert to trap based on winRate
		const shouldLose = Math.random() * 100 >= winRate;
		if (shouldLose && game.floorsCleared >= 1) {
			// Move trap to this column
			game.trapPositions[currentFloor] = column;
			game.gameOver = true;
			return false; // hit trap
		}
		game.floorsCleared++;
		return true; // safe
	}
}
