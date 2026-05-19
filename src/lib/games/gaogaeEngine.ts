export interface Card {
	suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
	rank: number;
	display: string;
}

const SUITS: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANK_DISPLAY = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Suit strength for tiebreak: clubs < diamonds < hearts < spades
const SUIT_STRENGTH: Record<Card['suit'], number> = {
	clubs: 0,
	diamonds: 1,
	hearts: 2,
	spades: 3
};

export function createDeck(): Card[] {
	const deck: Card[] = [];
	for (const suit of SUITS) {
		for (let rank = 1; rank <= 13; rank++) {
			deck.push({ suit, rank, display: RANK_DISPLAY[rank] });
		}
	}
	return shuffle(deck);
}

function shuffle<T>(arr: T[]): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

export function cardPoints(card: Card): number {
	if (card.rank >= 10) return 0; // 10, J, Q, K = 0
	return card.rank; // A=1, 2-9 face value
}

export function handPoints(hand: Card[]): number {
	return hand.reduce((sum, c) => sum + cardPoints(c), 0) % 10;
}

// Hand types ranked from lowest to highest
export type HandType = 'normal' | 'flush' | 'straight' | 'sian' | 'straightflush' | 'trips';

export function isFaceCard(card: Card): boolean {
	return card.rank >= 11 && card.rank <= 13; // J, Q, K
}

export function isFlush(hand: Card[]): boolean {
	return hand[0].suit === hand[1].suit && hand[1].suit === hand[2].suit;
}

export function isStraight(hand: Card[]): boolean {
	const ranks = hand.map(c => c.rank).sort((a, b) => a - b);
	// Normal straights
	if (ranks[1] === ranks[0] + 1 && ranks[2] === ranks[1] + 1) return true;
	// Q-K-A wrap
	if (ranks[0] === 1 && ranks[1] === 12 && ranks[2] === 13) return true;
	// A-2-3
	if (ranks[0] === 1 && ranks[1] === 2 && ranks[2] === 3) return true;
	return false;
}

export function isSian(hand: Card[]): boolean {
	// 3 face cards (J/Q/K)
	return hand.every(c => isFaceCard(c));
}

export function isTrips(hand: Card[]): boolean {
	return hand[0].rank === hand[1].rank && hand[1].rank === hand[2].rank;
}

export function getHandType(hand: Card[]): HandType {
	if (isTrips(hand)) return 'trips';
	if (isFlush(hand) && isStraight(hand)) return 'straightflush';
	if (isSian(hand)) return 'sian';
	if (isStraight(hand)) return 'straight';
	if (isFlush(hand)) return 'flush';
	return 'normal';
}

const HAND_TYPE_RANK: Record<HandType, number> = {
	normal: 0,
	flush: 1,
	straight: 2,
	sian: 3,
	straightflush: 4,
	trips: 5
};

export function getHandMultiplier(type: HandType): number {
	switch (type) {
		case 'normal': return 2;
		case 'flush': return 2;
		case 'straight': return 3;
		case 'sian': return 3;
		case 'straightflush': return 5;
		case 'trips': return 5;
		default: return 2;
	}
}

export function handTypeName(type: HandType): string {
	switch (type) {
		case 'normal': return 'ธรรมดา';
		case 'flush': return 'สี';
		case 'straight': return 'เรียง';
		case 'sian': return 'เซียน';
		case 'straightflush': return 'สีเรียง';
		case 'trips': return 'ตอง';
		default: return '';
	}
}

function highestRank(hand: Card[]): number {
	return Math.max(...hand.map(c => c.rank === 1 ? 14 : c.rank)); // Ace is highest
}

function highestSuit(hand: Card[]): number {
	return Math.max(...hand.map(c => SUIT_STRENGTH[c.suit]));
}

export type GaoGaeResult = 'win' | 'lose' | 'draw';

export function compareHands(playerHand: Card[], dealerHand: Card[]): GaoGaeResult {
	const pType = getHandType(playerHand);
	const dType = getHandType(dealerHand);

	const pTypeRank = HAND_TYPE_RANK[pType];
	const dTypeRank = HAND_TYPE_RANK[dType];

	// Compare hand type first
	if (pTypeRank > dTypeRank) return 'win';
	if (pTypeRank < dTypeRank) return 'lose';

	// Same hand type: compare points
	const pp = handPoints(playerHand);
	const dp = handPoints(dealerHand);

	if (pp > dp) return 'win';
	if (pp < dp) return 'lose';

	// Same points: compare highest rank (special: trips of 3 beats everything)
	if (pType === 'trips' && playerHand[0].rank === 3) return 'win';
	if (dType === 'trips' && dealerHand[0].rank === 3) return 'lose';

	const pHigh = highestRank(playerHand);
	const dHigh = highestRank(dealerHand);
	if (pHigh > dHigh) return 'win';
	if (pHigh < dHigh) return 'lose';

	// Same highest rank: compare suit
	const pSuit = highestSuit(playerHand);
	const dSuit = highestSuit(dealerHand);
	if (pSuit > dSuit) return 'win';
	if (pSuit < dSuit) return 'lose';

	return 'draw';
}

// Combinations helper: generate all C(n,k) combinations
function combinations<T>(arr: T[], k: number): T[][] {
	if (k === 0) return [[]];
	if (arr.length < k) return [];
	const result: T[][] = [];
	const [first, ...rest] = arr;
	for (const combo of combinations(rest, k - 1)) {
		result.push([first, ...combo]);
	}
	for (const combo of combinations(rest, k)) {
		result.push(combo);
	}
	return result;
}

/**
 * Biased deal: deals 6 cards, tries all C(6,3)=20 splits to find
 * a result matching the desired outcome (shouldWin based on winRate).
 */
export function biasedDeal(winRate: number): { playerHand: Card[]; dealerHand: Card[] } {
	const shouldWin = Math.random() * 100 < winRate;

	for (let attempt = 0; attempt < 50; attempt++) {
		const deck = createDeck();
		const sixCards = deck.splice(0, 6);
		const playerCombos = combinations(sixCards, 3);

		for (const playerHand of playerCombos) {
			const dealerHand = sixCards.filter(c => !playerHand.includes(c));
			const result = compareHands(playerHand, dealerHand);

			if (shouldWin && result === 'win') {
				return { playerHand, dealerHand };
			}
			if (!shouldWin && result === 'lose') {
				return { playerHand, dealerHand };
			}
		}
	}

	// Fallback: random deal
	const deck = createDeck();
	return {
		playerHand: [deck[0], deck[1], deck[2]],
		dealerHand: [deck[3], deck[4], deck[5]]
	};
}

export function suitSymbol(suit: Card['suit']): string {
	switch (suit) {
		case 'hearts': return '\u2665';
		case 'diamonds': return '\u2666';
		case 'clubs': return '\u2663';
		case 'spades': return '\u2660';
	}
}

export function suitColor(suit: Card['suit']): string {
	return suit === 'hearts' || suit === 'diamonds' ? '#dc2626' : '#18181b';
}
