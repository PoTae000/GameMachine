// Lucky Box: 5 boxes with different multipliers
// Player picks 1, gets the hidden multiplier

export const BOX_COUNT = 5;

export const MULTIPLIERS = [0, 1.5, 2, 3, 5];

export interface LuckyBoxResult {
	chosenBox: number;
	multiplier: number;
	allBoxes: number[]; // reveal all after pick
}

export function biasedLuckyBox(chosenBox: number, winRate: number): LuckyBoxResult {
	// Shuffle multipliers into boxes
	const allBoxes = shuffleMultipliers();

	const shouldWin = Math.random() * 100 < winRate;

	if (shouldWin) {
		// Put a good multiplier (2, 3, or 5) in chosen box
		const goodMultipliers = [2, 3, 5];
		const weighted = Math.random();
		let pick: number;
		if (weighted < 0.5) pick = 2;        // 50% get x2
		else if (weighted < 0.85) pick = 3;  // 35% get x3
		else pick = 5;                        // 15% get x5

		// Swap: find where 'pick' is and put it in chosenBox
		const currentInChosen = allBoxes[chosenBox];
		const pickIndex = allBoxes.indexOf(pick);
		allBoxes[chosenBox] = pick;
		if (pickIndex >= 0) allBoxes[pickIndex] = currentInChosen;
	} else {
		// Put 0 (lose) in chosen box
		const currentInChosen = allBoxes[chosenBox];
		const zeroIndex = allBoxes.indexOf(0);
		if (zeroIndex !== chosenBox) {
			allBoxes[chosenBox] = 0;
			if (zeroIndex >= 0) allBoxes[zeroIndex] = currentInChosen;
		}
	}

	return {
		chosenBox,
		multiplier: allBoxes[chosenBox],
		allBoxes
	};
}

function shuffleMultipliers(): number[] {
	const arr = [...MULTIPLIERS];
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}
