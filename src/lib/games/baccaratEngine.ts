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
	for (let i = deck.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[deck[i], deck[j]] = [deck[j], deck[i]];
	}
	return deck;
}

export function cardValue(card: Card): number {
	if (card.rank >= 10) return 0;
	return card.rank;
}

export function handTotal(hand: Card[]): number {
	return hand.reduce((s, c) => s + cardValue(c), 0) % 10;
}

export function playerDrawsThird(playerHand: Card[]): boolean {
	const total = handTotal(playerHand);
	return total <= 5;
}

export function bankerDrawsThird(bankerHand: Card[], playerThirdCard: Card | null): boolean {
	const bt = handTotal(bankerHand);
	if (bt >= 7) return false;
	if (bt <= 2) return true;
	if (!playerThirdCard) return bt <= 5;
	const pv = cardValue(playerThirdCard);
	if (bt === 3) return pv !== 8;
	if (bt === 4) return pv >= 2 && pv <= 7;
	if (bt === 5) return pv >= 4 && pv <= 7;
	if (bt === 6) return pv === 6 || pv === 7;
	return false;
}

export type BaccaratBet = 'player' | 'banker' | 'tie';
export type BaccaratResult = 'player' | 'banker' | 'tie';

export function evaluateBaccarat(playerHand: Card[], bankerHand: Card[]): BaccaratResult {
	const pt = handTotal(playerHand);
	const bt = handTotal(bankerHand);
	if (pt > bt) return 'player';
	if (bt > pt) return 'banker';
	return 'tie';
}

export function getMultiplier(bet: BaccaratBet): number {
	if (bet === 'player') return 2;
	if (bet === 'banker') return 1.95;
	return 8;
}

export function biasedDeal(deck: Card[], bet: BaccaratBet, winRate: number, dealerBias = 50): { playerHand: Card[]; bankerHand: Card[]; remaining: Card[] } {
	// dealerBias: higher = banker wins more often
	// Adjust effective winRate when betting on banker vs player
	let effectiveWinRate = winRate;
	if (bet === 'banker') {
		effectiveWinRate = winRate + (dealerBias - 50) * 0.3;
	} else if (bet === 'player') {
		effectiveWinRate = winRate - (dealerBias - 50) * 0.3;
	}
	effectiveWinRate = Math.max(0, Math.min(100, effectiveWinRate));
	const shouldWin = Math.random() * 100 < effectiveWinRate;

	for (let attempt = 0; attempt < 100; attempt++) {
		const d = createDeck();
		const cards = d.splice(0, 6);
		const pH = [cards[0], cards[1]];
		const bH = [cards[2], cards[3]];

		const pNat = handTotal(pH) >= 8;
		const bNat = handTotal(bH) >= 8;
		let playerThird: Card | null = null;

		if (!pNat && !bNat) {
			if (playerDrawsThird(pH)) {
				playerThird = cards[4];
				pH.push(playerThird);
			}
			if (bankerDrawsThird(bH, playerThird)) {
				bH.push(cards[5]);
			}
		}

		const result = evaluateBaccarat(pH, bH);
		const won = result === bet;

		if ((shouldWin && won) || (!shouldWin && !won)) {
			return { playerHand: pH, bankerHand: bH, remaining: d };
		}
	}

	// Final fallback with fresh deck
	const d = createDeck();
	const cards = d.splice(0, 6);
	const pH = [cards[0], cards[1]];
	const bH = [cards[2], cards[3]];
	const pNat = handTotal(pH) >= 8;
	const bNat = handTotal(bH) >= 8;
	if (!pNat && !bNat) {
		let playerThird: Card | null = null;
		if (playerDrawsThird(pH)) { playerThird = cards[4]; pH.push(playerThird); }
		if (bankerDrawsThird(bH, playerThird)) { bH.push(cards[5]); }
	}
	return { playerHand: pH, bankerHand: bH, remaining: d };
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
