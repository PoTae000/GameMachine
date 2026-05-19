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

export type DTBet = 'dragon' | 'tiger' | 'tie';
export type DTResult = 'dragon' | 'tiger' | 'tie';

export function evaluate(dragon: Card, tiger: Card): DTResult {
	if (dragon.rank > tiger.rank) return 'dragon';
	if (tiger.rank > dragon.rank) return 'tiger';
	return 'tie';
}

export function getMultiplier(bet: DTBet): number {
	if (bet === 'tie') return 8;
	return 2;
}

export function biasedDeal(deck: Card[], bet: DTBet, winRate: number, dealerBias = 50): { dragon: Card; tiger: Card; remaining: Card[] } {
	// dealerBias: higher = tie happens more often
	// If betting on tie, boost win chance; if not, boost tie occurrence to eat bets
	let effectiveWinRate = winRate;
	if (bet === 'tie') {
		effectiveWinRate = winRate + (dealerBias - 50) * 0.4;
	} else {
		// Higher tie bias = more ties = more losses for dragon/tiger bets
		effectiveWinRate = winRate - (dealerBias - 50) * 0.2;
	}
	effectiveWinRate = Math.max(0, Math.min(100, effectiveWinRate));
	const shouldWin = Math.random() * 100 < effectiveWinRate;

	for (let attempt = 0; attempt < 100; attempt++) {
		const d = createDeck();
		const dragon = d.pop()!;
		const tiger = d.pop()!;
		const result = evaluate(dragon, tiger);
		const won = result === bet;

		if ((shouldWin && won) || (!shouldWin && !won)) {
			return { dragon, tiger, remaining: d };
		}
	}

	const d = createDeck();
	return { dragon: d.pop()!, tiger: d.pop()!, remaining: d };
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
