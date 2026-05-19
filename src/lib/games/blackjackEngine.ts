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

export function cardValue(card: Card): number {
	if (card.rank >= 10) return 10;
	return card.rank; // A=1 initially, handled in handValue
}

export function handValue(hand: Card[]): number {
	let total = 0;
	let aces = 0;
	for (const c of hand) {
		if (c.rank === 1) {
			aces++;
			total += 11;
		} else {
			total += cardValue(c);
		}
	}
	while (total > 21 && aces > 0) {
		total -= 10;
		aces--;
	}
	return total;
}

export function isBlackjack(hand: Card[]): boolean {
	return hand.length === 2 && handValue(hand) === 21;
}

export function isBust(hand: Card[]): boolean {
	return handValue(hand) > 21;
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

export type GameResult = 'blackjack' | 'win' | 'push' | 'lose';

export function evaluateBlackjack(playerHand: Card[], dealerHand: Card[]): GameResult {
	const pv = handValue(playerHand);
	const dv = handValue(dealerHand);
	const pBJ = isBlackjack(playerHand);
	const dBJ = isBlackjack(dealerHand);

	if (pBJ && dBJ) return 'push';
	if (pBJ) return 'blackjack';
	if (dBJ) return 'lose';
	if (pv > 21) return 'lose';
	if (dv > 21) return 'win';
	if (pv > dv) return 'win';
	if (pv === dv) return 'push';
	return 'lose';
}

export function getMultiplier(result: GameResult): number {
	switch (result) {
		case 'blackjack': return 2.5;
		case 'win': return 2;
		case 'push': return 1;
		case 'lose': return 0;
	}
}

/**
 * Biased initial deal: create a deck and deal 4 cards with bias.
 * shouldPlayerWin = true: give player strong hand, dealer weak
 * shouldPlayerWin = false: give dealer strong hand, player weak
 */
export function biasedInitialDeal(shouldPlayerWin: boolean): { deck: Card[]; playerHand: Card[]; dealerHand: Card[] } {
	for (let attempt = 0; attempt < 50; attempt++) {
		const deck = createDeck();
		const p1 = deck.pop()!;
		const d1 = deck.pop()!;
		const p2 = deck.pop()!;
		const d2 = deck.pop()!;
		const playerHand = [p1, p2];
		const dealerHand = [d1, d2];
		const pv = handValue(playerHand);
		const dv = handValue(dealerHand);

		if (shouldPlayerWin) {
			// Player has higher value or blackjack, dealer doesn't have blackjack
			if (pv >= dv && !isBlackjack(dealerHand)) return { deck, playerHand, dealerHand };
		} else {
			// Dealer has higher value or player has low hand
			if (dv >= pv && !isBlackjack(playerHand)) return { deck, playerHand, dealerHand };
		}
	}

	const deck = createDeck();
	return { deck, playerHand: [deck.pop()!, deck.pop()!], dealerHand: [deck.pop()!, deck.pop()!] };
}

/**
 * Biased dealer draw: picks a card from deck that helps or hurts dealer.
 * Uses a pre-determined shouldPlayerWin decision (made once per round).
 */
export function biasedDealerDraw(deck: Card[], playerValue: number, shouldPlayerWin: boolean, dealerBias = 50): { card: Card; remaining: Card[] } {
	// dealerBias: higher = more likely dealer busts (favors player)
	const biasStrength = dealerBias / 50; // 1.0 = normal, >1 = bust more, <1 = bust less
	const bustThreshold = shouldPlayerWin ? Math.max(5, Math.floor(7 * biasStrength)) : Math.min(8, Math.ceil(6 / biasStrength));

	for (let i = 0; i < deck.length; i++) {
		const candidate = deck[i];
		const cv = cardValue(candidate);

		if (shouldPlayerWin) {
			// Give dealer a high card that might bust them
			if (cv >= bustThreshold) {
				const newDeck = [...deck];
				newDeck.splice(i, 1);
				return { card: candidate, remaining: newDeck };
			}
		} else {
			// Give dealer a card that helps them beat player
			if (cv <= bustThreshold) {
				const newDeck = [...deck];
				newDeck.splice(i, 1);
				return { card: candidate, remaining: newDeck };
			}
		}
	}

	// Fallback: draw normally
	const [card, ...remaining] = deck;
	return { card, remaining: remaining.length > 0 ? remaining : createDeck() };
}
