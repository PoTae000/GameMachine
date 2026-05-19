export interface Card {
	suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
	rank: number; // 1(A) - 13(K)
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

export function drawCard(deck: Card[]): { card: Card; remaining: Card[] } {
	const [card, ...remaining] = deck;
	return { card, remaining: remaining.length > 0 ? remaining : createDeck() };
}

export function biasedDraw(current: Card, guess: HiLoGuess, deck: Card[], winRate: number): { card: Card; remaining: Card[] } {
	const shouldWin = Math.random() * 100 < winRate;

	// Try to find a card in deck that matches the desired outcome
	for (let i = 0; i < deck.length; i++) {
		const candidate = deck[i];
		const wouldWin = evaluateHiLo(current, candidate, guess);
		if (wouldWin === shouldWin) {
			// Swap candidate to front and draw
			const newDeck = [...deck];
			[newDeck[0], newDeck[i]] = [newDeck[i], newDeck[0]];
			return drawCard(newDeck);
		}
	}
	// Fallback: just draw normally
	return drawCard(deck);
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

export type HiLoGuess = 'high' | 'low';

export function evaluateHiLo(current: Card, next: Card, guess: HiLoGuess): boolean {
	if (current.rank === next.rank) return false; // tie = lose
	if (guess === 'high') return next.rank > current.rank;
	return next.rank < current.rank;
}

export const HILO_MULTIPLIER = 1.8;
