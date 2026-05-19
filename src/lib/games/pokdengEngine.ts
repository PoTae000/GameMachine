export interface Card {
	suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
	rank: number;
	display: string;
}

const SUITS: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANK_DISPLAY = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

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

export function isPok(hand: Card[]): boolean {
	return hand.length === 2 && handPoints(hand) >= 8;
}

export function getHandMultiplier(hand: Card[]): number {
	// Pok 9 = 3x, Pok 8 = 2x
	if (hand.length === 2) {
		const pts = handPoints(hand);
		if (pts === 9) return 3;
		if (pts === 8) return 2;
		// Same suit pair = 2x
		if (hand[0].suit === hand[1].suit) return 2;
		// Same rank pair = 2x
		if (hand[0].rank === hand[1].rank) return 2;
	}
	return 1.5;
}

export type PokDengResult = 'win' | 'lose' | 'draw';

export function evaluatePokDeng(playerHand: Card[], dealerHand: Card[]): PokDengResult {
	const pp = handPoints(playerHand);
	const dp = handPoints(dealerHand);

	if (pp > dp) return 'win';
	if (pp < dp) return 'lose';

	// tie: compare card count (fewer = better)
	if (playerHand.length < dealerHand.length) return 'win';
	if (playerHand.length > dealerHand.length) return 'lose';

	return 'draw';
}

/**
 * Biased deal: deals 4 cards (2 player + 2 dealer) with bias.
 * Tries multiple fresh deck shuffles to find a favorable deal.
 */
export function biasedDeal(deck: Card[], winRate: number, dealerBias = 50): { playerHand: Card[]; dealerHand: Card[]; remaining: Card[] } {
	// dealerBias: higher = dealer pok more often (harder for player)
	const pokBoost = dealerBias / 50; // >1 = dealer gets pok more, <1 = less
	const shouldWin = Math.random() * 100 < winRate;
	// Adjust attempts: if dealer bias is high, try harder to find dealer-pok deals when !shouldWin
	const maxAttempts = Math.round(50 * pokBoost);

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const d = createDeck();
		const cards = [d.pop()!, d.pop()!, d.pop()!, d.pop()!];

		// Try all arrangements of these 4 cards
		const arrangements = [
			{ player: [cards[0], cards[1]], dealer: [cards[2], cards[3]] },
			{ player: [cards[0], cards[2]], dealer: [cards[1], cards[3]] },
			{ player: [cards[0], cards[3]], dealer: [cards[1], cards[2]] },
			{ player: [cards[2], cards[3]], dealer: [cards[0], cards[1]] },
			{ player: [cards[1], cards[3]], dealer: [cards[0], cards[2]] },
			{ player: [cards[1], cards[2]], dealer: [cards[0], cards[3]] },
		];

		for (const arr of arrangements) {
			const result = evaluatePokDeng(arr.player, arr.dealer);
			if (shouldWin && result === 'win') {
				return { playerHand: arr.player, dealerHand: arr.dealer, remaining: d };
			}
			if (!shouldWin && result === 'lose') {
				return { playerHand: arr.player, dealerHand: arr.dealer, remaining: d };
			}
		}
	}

	// Fallback: construct a guaranteed result
	if (shouldWin) {
		// Give player high points, dealer low points
		const d = createDeck();
		const sorted = d.sort((a, b) => (cardPoints(b) - cardPoints(a)));
		// Player gets two high-value cards, dealer gets two face cards (0 points)
		const highCards = sorted.filter(c => cardPoints(c) >= 4);
		const lowCards = sorted.filter(c => cardPoints(c) === 0);
		if (highCards.length >= 2 && lowCards.length >= 2) {
			return { playerHand: [highCards[0], highCards[1]], dealerHand: [lowCards[0], lowCards[1]], remaining: d };
		}
	}

	const d = createDeck();
	return { playerHand: [d.pop()!, d.pop()!], dealerHand: [d.pop()!, d.pop()!], remaining: d };
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
