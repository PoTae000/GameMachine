export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;

export type Suit = (typeof SUITS)[number];
export type Rank = (typeof RANKS)[number];

export interface Card {
	suit: Suit;
	rank: Rank;
}

export type HandRank =
	| 'Royal Flush'
	| 'Straight Flush'
	| 'Four of a Kind'
	| 'Full House'
	| 'Flush'
	| 'Straight'
	| 'Three of a Kind'
	| 'Two Pair'
	| 'Jacks or Better'
	| 'No Win';

export const PAYOUTS: Record<HandRank, number> = {
	'Royal Flush': 250,
	'Straight Flush': 50,
	'Four of a Kind': 25,
	'Full House': 9,
	'Flush': 6,
	'Straight': 4,
	'Three of a Kind': 3,
	'Two Pair': 2,
	'Jacks or Better': 1,
	'No Win': 0
};

export const HAND_RANKS: HandRank[] = [
	'Royal Flush',
	'Straight Flush',
	'Four of a Kind',
	'Full House',
	'Flush',
	'Straight',
	'Three of a Kind',
	'Two Pair',
	'Jacks or Better',
	'No Win'
];

function rankValue(rank: Rank): number {
	const idx = RANKS.indexOf(rank);
	return idx + 2; // 2=2, 3=3, ..., A=14
}

function createDeck(): Card[] {
	const deck: Card[] = [];
	for (const suit of SUITS) {
		for (const rank of RANKS) {
			deck.push({ suit, rank });
		}
	}
	return deck;
}

function shuffleDeck(deck: Card[]): Card[] {
	const d = [...deck];
	for (let i = d.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[d[i], d[j]] = [d[j], d[i]];
	}
	return d;
}

export function evaluateHand(hand: Card[]): HandRank {
	const values = hand.map((c) => rankValue(c.rank)).sort((a, b) => a - b);
	const suits = hand.map((c) => c.suit);

	const isFlush = suits.every((s) => s === suits[0]);

	// Check straight
	let isStraight = false;
	const unique = [...new Set(values)];
	if (unique.length === 5) {
		if (unique[4] - unique[0] === 4) {
			isStraight = true;
		}
		// A-2-3-4-5 (wheel)
		if (unique[0] === 2 && unique[1] === 3 && unique[2] === 4 && unique[3] === 5 && unique[4] === 14) {
			isStraight = true;
		}
	}

	// Count ranks
	const counts: Record<number, number> = {};
	for (const v of values) {
		counts[v] = (counts[v] || 0) + 1;
	}
	const countValues = Object.values(counts).sort((a, b) => b - a);

	// Royal Flush
	if (isFlush && isStraight && values[0] === 10) return 'Royal Flush';
	if (isFlush && isStraight) return 'Straight Flush';
	if (countValues[0] === 4) return 'Four of a Kind';
	if (countValues[0] === 3 && countValues[1] === 2) return 'Full House';
	if (isFlush) return 'Flush';
	if (isStraight) return 'Straight';
	if (countValues[0] === 3) return 'Three of a Kind';
	if (countValues[0] === 2 && countValues[1] === 2) return 'Two Pair';
	if (countValues[0] === 2) {
		// Jacks or Better: pair of J, Q, K, or A
		const pairValue = Number(Object.entries(counts).find(([, c]) => c === 2)?.[0] ?? 0);
		if (pairValue >= 11) return 'Jacks or Better'; // J=11, Q=12, K=13, A=14
	}

	return 'No Win';
}

export function dealHand(): { hand: Card[]; deck: Card[] } {
	const deck = shuffleDeck(createDeck());
	const hand = deck.splice(0, 5);
	return { hand, deck };
}

export function redraw(hand: Card[], holds: boolean[], deck: Card[], winRate: number, rareChance = 50): Card[] {
	const shouldWin = Math.random() * 100 < winRate;
	// rareChance: higher = when winning, more likely to get better hands
	const minPayout = rareChance >= 70 ? 3 : rareChance >= 50 ? 1 : 0;

	// Try multiple redraws to bias outcome
	for (let attempt = 0; attempt < 50; attempt++) {
		const reshuffled = shuffleDeck([...deck]);
		let drawIdx = 0;
		const newHand = hand.map((card, i) => {
			if (holds[i]) return card;
			return reshuffled[drawIdx++];
		});

		const handRank = evaluateHand(newHand);
		const payout = PAYOUTS[handRank];

		if (shouldWin && payout >= minPayout && payout > 0) return newHand;
		if (!shouldWin && payout === 0) return newHand;
	}

	// Fallback: just do a normal redraw
	const reshuffled = shuffleDeck([...deck]);
	let drawIdx = 0;
	return hand.map((card, i) => {
		if (holds[i]) return card;
		return reshuffled[drawIdx++];
	});
}
