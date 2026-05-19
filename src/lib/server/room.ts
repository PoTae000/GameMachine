import {
	getRoom as getRoomFromKV, saveRoom, deleteRoom, addRoomToIndex, getAllRoomCodes,
	getUser, saveUser,
	type Room, type RoomPlayer, type RoomGame, type RoomPhase, type StoredUser
} from './db';
import { createDeck as bjCreateDeck, handValue, isBust, isBlackjack, evaluateBlackjack, getMultiplier as bjMultiplier, type Card as BJCard } from '$lib/games/blackjackEngine';
import { createDeck as baccaratCreateDeck, handTotal as baccaratHandTotal, playerDrawsThird, bankerDrawsThird, evaluateBaccarat, getMultiplier as baccaratMultiplier, type Card as BacCard, type BaccaratBet } from '$lib/games/baccaratEngine';
import { createDeck as pdCreateDeck, evaluatePokDeng, getHandMultiplier as pokdengMultiplier, type Card as PDCard } from '$lib/games/pokdengEngine';
import { createDeck as dtCreateDeck, evaluate as dtEvaluate, getMultiplier as dtMultiplier, type DTBet } from '$lib/games/dragonTigerEngine';
import { createDeck as hiloCreateDeck, evaluateHiLo, HILO_MULTIPLIER, type HiLoGuess } from '$lib/games/hiloEngine';
import { evaluateHand as vpEvaluateHand, PAYOUTS as VP_PAYOUTS, dealHand as vpDealHand, type Card as VPCard } from '$lib/games/videoPokerEngine';
import { evaluateBet as rouletteEvaluateBet, getMultiplier as rouletteMultiplier, spin as rouletteSpin, type BetType as RouletteBetType, type RouletteBet, RED_NUMBERS } from '$lib/games/rouletteEngine';
import { createDeck as ggCreateDeck, compareHands as ggCompareHands, getHandType as ggGetHandType, getHandMultiplier as ggGetHandMultiplier, handPoints as ggHandPoints, handTypeName as ggHandTypeName, type Card as GGCard } from '$lib/games/gaogaeEngine';

const BOT_HOST_ID = '__bot__';
const BOT_RESULT_DELAY = 12000; // 12 seconds before auto-next-round (must be longer than card reveal animation ~7.5s)


const GAME_NAMES: Record<RoomGame, string> = {
	blackjack: 'แบล็คแจ็ค',
	baccarat: 'บาคาร่า',
	pokdeng: 'ป๊อกเด้ง',
	dragontiger: 'มังกรเสือ',
	hilo: 'ไฮโล',
	videopoker: 'วิดีโอโป๊กเกอร์',
	roulette: 'รูเล็ต',
	gaogae: 'เก้าเก'
};

function generateCode(): string {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let code = '';
	for (let i = 0; i < 6; i++) {
		code += chars[Math.floor(Math.random() * chars.length)];
	}
	return code;
}

// Helper: fetch a user, apply credit/stats mutation, save
async function updatePlayerCredit(platform: App.Platform | undefined, userId: string, creditDelta: number, statsDelta?: { received?: number; spent?: number }): Promise<void> {
	const user = await getUser(platform, userId);
	if (!user) return;
	user.credit += creditDelta;
	if (statsDelta?.received) user.stats.totalReceived += statsDelta.received;
	if (statsDelta?.spent) user.stats.totalSpent += statsDelta.spent;
	await saveUser(platform, user);
}

export async function createRoom(platform: App.Platform | undefined, creatorId: string, creatorUsername: string, game: RoomGame): Promise<Room> {
	const existingCodes = await getAllRoomCodes(platform);

	let code: string;
	do {
		code = generateCode();
	} while (existingCodes.includes(code));

	const room: Room = {
		code,
		hostId: BOT_HOST_ID, // bot is default dealer; anyone can claim
		game,
		gameName: GAME_NAMES[game],
		players: [{ userId: creatorId, username: creatorUsername, bet: 0, ready: false }],
		phase: 'betting',
		gameState: null,
		round: 1,
		createdAt: Date.now(),
		lastActivity: Date.now()
	};

	await saveRoom(platform, room);
	await addRoomToIndex(platform, code);
	return room;
}

export async function getRoom(platform: App.Platform | undefined, code: string): Promise<Room | undefined> {
	const room = await getRoomFromKV(platform, code);
	return room ?? undefined;
}

export async function joinRoom(platform: App.Platform | undefined, code: string, userId: string, username: string): Promise<Room | null> {
	const room = await getRoomFromKV(platform, code);
	if (!room) return null;
	if (room.phase !== 'waiting' && room.phase !== 'betting' && room.phase !== 'result') return null;

	if (room.players.some(p => p.userId === userId)) {
		room.lastActivity = Date.now();
		await saveRoom(platform, room);
		return room;
	}

	if (room.players.length >= 8) return null;

	room.players.push({ userId, username, bet: 0, ready: false });
	room.lastActivity = Date.now();
	await saveRoom(platform, room);
	return room;
}

export async function leaveRoom(platform: App.Platform | undefined, code: string, userId: string): Promise<boolean> {
	const room = await getRoomFromKV(platform, code);
	if (!room) return false;

	const isBotManaged = room.hostId === BOT_HOST_ID;

	// Human host leaves → revert to bot
	if (!isBotManaged && room.hostId === userId) {
		room.hostId = BOT_HOST_ID;
	}

	// Refund bet if player has placed one during betting phase
	const leavingPlayer = room.players.find(p => p.userId === userId);
	if (leavingPlayer && leavingPlayer.bet > 0 && (room.phase === 'betting' || room.phase === 'waiting')) {
		await updatePlayerCredit(platform, userId, leavingPlayer.bet);
	}

	room.players = room.players.filter(p => p.userId !== userId);

	// No players left → delete room
	if (room.players.length === 0) {
		await deleteRoom(platform, code);
	} else {
		room.lastActivity = Date.now();
		await saveRoom(platform, room);
	}

	return true;
}

export async function closeRoom(platform: App.Platform | undefined, code: string, userId: string): Promise<boolean> {
	const room = await getRoomFromKV(platform, code);
	if (!room) return false;

	// Bot-managed rooms: any player can close. Human-host rooms: only host can close.
	if (room.hostId === BOT_HOST_ID) {
		if (!room.players.some(p => p.userId === userId)) return false;
	} else {
		if (room.hostId !== userId) return false;
	}

	// Refund all players who have placed bets during betting/waiting phase
	if (room.phase === 'betting' || room.phase === 'waiting') {
		for (const p of room.players) {
			if (p.bet > 0) {
				await updatePlayerCredit(platform, p.userId, p.bet);
			}
		}
	}

	await deleteRoom(platform, code);
	return true;
}

export async function startBetting(platform: App.Platform | undefined, code: string, userId: string): Promise<Room | null> {
	const room = await getRoomFromKV(platform, code);
	if (!room) return null;
	if (room.hostId !== userId) return null;
	if (room.phase !== 'waiting' && room.phase !== 'result') return null;

	resetForNewRound(room);
	await saveRoom(platform, room);
	return room;
}

function resetForNewRound(room: Room) {
	room.phase = 'betting';
	room.round++;
	for (const p of room.players) {
		p.bet = 0;
		p.betChoice = undefined;
		p.result = undefined;
		p.payout = undefined;
		p.ready = false;
		p.hand = undefined;
		p.stood = undefined;
	}
	room.gameState = null;
	room.lastActivity = Date.now();
}

export async function placeBet(platform: App.Platform | undefined, code: string, userId: string, bet: number, betChoice?: string): Promise<Room | null> {
	const room = await getRoomFromKV(platform, code);
	if (!room) return null;
	if (room.phase !== 'betting') return null;
	if (room.hostId === userId) return null; // host can't bet (bot host = __bot__, so this is fine)

	const player = room.players.find(p => p.userId === userId);
	if (!player) return null;

	const user = await getUser(platform, userId);
	if (!user || user.credit < bet) return null;
	if (bet < 1) return null;

	if (room.game === 'baccarat' && !['player', 'banker', 'tie'].includes(betChoice || '')) return null;
	if (room.game === 'dragontiger' && !['dragon', 'tiger', 'tie'].includes(betChoice || '')) return null;
	if (room.game === 'hilo' && !['high', 'low'].includes(betChoice || '')) return null;
	if (room.game === 'roulette') {
		const bc = betChoice || '';
		const validSimple = ['red', 'black', 'odd', 'even', 'high', 'low'];
		if (!validSimple.includes(bc) && !bc.match(/^number:\d{1,2}$/)) return null;
		if (bc.startsWith('number:')) {
			const num = parseInt(bc.split(':')[1]);
			if (num < 0 || num > 36) return null;
		}
	}

	player.bet = bet;
	player.betChoice = betChoice;
	player.ready = true;
	user.credit -= bet;

	// Save user first, then room
	await saveUser(platform, user);
	room.lastActivity = Date.now();
	await saveRoom(platform, room);
	return room;
}

export async function dealCards(platform: App.Platform | undefined, code: string, userId: string): Promise<Room | null> {
	const room = await getRoomFromKV(platform, code);
	if (!room) return null;
	if (room.hostId !== userId) return null;
	if (room.phase !== 'betting') return null;

	const bettingPlayers = room.players.filter(p => p.userId !== room.hostId && p.ready && p.bet > 0);
	if (bettingPlayers.length === 0) return null;

	room.lastActivity = Date.now();

	switch (room.game) {
		case 'blackjack': return dealBlackjack(platform, room);
		case 'baccarat': return dealBaccarat(platform, room);
		case 'pokdeng': return dealPokdeng(platform, room);
		case 'dragontiger': return dealDragonTiger(platform, room);
		case 'hilo': return dealHiLo(platform, room);
		case 'videopoker': return dealVideoPoker(platform, room);
		case 'roulette': return dealRoulette(platform, room);
		case 'gaogae': return dealGaoGae(platform, room);
		default: return null;
	}
}

// Force start: deal even if not all players are ready (called when countdown expires)
export async function forceStart(platform: App.Platform | undefined, code: string): Promise<Room | null> {
	const room = await getRoomFromKV(platform, code);
	if (!room) return null;
	if (room.phase !== 'betting') return null;

	const bettingPlayers = room.players.filter(p => p.userId !== room.hostId && p.ready && p.bet > 0);
	if (bettingPlayers.length === 0) return null;

	room.lastActivity = Date.now();

	switch (room.game) {
		case 'blackjack': return dealBlackjack(platform, room);
		case 'baccarat': return dealBaccarat(platform, room);
		case 'pokdeng': return dealPokdeng(platform, room);
		case 'dragontiger': return dealDragonTiger(platform, room);
		case 'hilo': return dealHiLo(platform, room);
		case 'videopoker': return dealVideoPoker(platform, room);
		case 'roulette': return dealRoulette(platform, room);
		case 'gaogae': return dealGaoGae(platform, room);
		default: return null;
	}
}

// =============================================
// Bot dealer: auto-deal, auto-reveal, auto-next
// Called during polling for bot rooms
// =============================================

export async function checkBotAction(platform: App.Platform | undefined, code: string): Promise<void> {
	const room = await getRoomFromKV(platform, code);
	if (!room || room.hostId !== BOT_HOST_ID) return;

	const players = room.players;
	if (players.length === 0) return;

	if (room.phase === 'betting') {
		// Auto-deal when all players are ready
		const allReady = players.every(p => p.ready && p.bet > 0);
		if (!allReady) return;

		room.lastActivity = Date.now();
		switch (room.game) {
			case 'blackjack': await dealBlackjack(platform, room); return;
			case 'baccarat': await dealBaccarat(platform, room); return;
			case 'pokdeng': await dealPokdeng(platform, room); return;
			case 'dragontiger': await dealDragonTiger(platform, room); return;
			case 'hilo': await dealHiLo(platform, room); return;
			case 'videopoker': await dealVideoPoker(platform, room); return;
			case 'roulette': await dealRoulette(platform, room); return;
			case 'gaogae': await dealGaoGae(platform, room); return;
		}
	} else if (room.phase === 'playing' && room.game === 'blackjack') {
		// Auto-reveal dealer when all players stood
		const allStood = players.every(p => p.stood || (!p.ready || p.bet <= 0));
		if (!allStood) return;

		await resolveBlackjackDealer(platform, room);
		room.lastActivity = Date.now();
		await saveRoom(platform, room);
	} else if (room.phase === 'playing' && room.game === 'videopoker') {
		const allDrew = players.every(p => p.stood || (!p.ready || p.bet <= 0));
		if (!allDrew) return;
		room.phase = 'result';
		room.lastActivity = Date.now();
		await saveRoom(platform, room);
	} else if (room.phase === 'result') {
		// Auto-start next round after delay
		if (Date.now() - room.lastActivity < BOT_RESULT_DELAY) return;

		resetForNewRound(room);
		await saveRoom(platform, room);
	}
}

// =============================================
// Settle money between players and human dealer
// When a human is dealer, money flows to/from them
// =============================================

async function settleWithDealer(platform: App.Platform | undefined, room: Room): Promise<void> {
	if (room.hostId === BOT_HOST_ID) return; // bot rooms: no settlement
	const dealer = await getUser(platform, room.hostId);
	if (!dealer) return;

	for (const p of room.players) {
		if (p.userId === room.hostId) continue;
		if (!p.ready || p.bet <= 0) continue;
		if (p.result === undefined) continue;

		// dealerDelta = bet - payout
		// lose: +bet (dealer collects), win: -(payout-bet) (dealer pays), push: 0
		const dealerDelta = p.bet - (p.payout ?? 0);
		dealer.credit += dealerDelta;
		if (dealerDelta > 0) {
			dealer.stats.totalReceived += dealerDelta;
		} else if (dealerDelta < 0) {
			dealer.stats.totalSpent += Math.abs(dealerDelta);
		}
	}

	// Auto-release dealer if credit goes negative
	if (dealer.credit < 0) {
		room.hostId = BOT_HOST_ID;
	}

	await saveUser(platform, dealer);
}

// =============================================
// PURE RANDOM DEALING — no win rate bias
// =============================================

async function dealBlackjack(platform: App.Platform | undefined, room: Room): Promise<Room> {
	const deck = bjCreateDeck();
	const dealerHand = [deck.pop()!, deck.pop()!];

	for (const p of room.players) {
		if (p.userId === room.hostId) continue;
		if (!p.ready || p.bet <= 0) continue;
		const playerCards = [deck.pop()!, deck.pop()!];
		p.hand = playerCards;
		p.stood = false;
		if (isBlackjack(playerCards)) {
			p.stood = true;
		}
	}

	room.gameState = { deck, dealerHand, dealerRevealed: false };
	room.phase = 'playing';
	await saveRoom(platform, room);
	return room;
}

async function dealBaccarat(platform: App.Platform | undefined, room: Room): Promise<Room> {
	const deck = baccaratCreateDeck();
	const playerHand: BacCard[] = [deck.pop()!, deck.pop()!];
	const bankerHand: BacCard[] = [deck.pop()!, deck.pop()!];

	const pNat = baccaratHandTotal(playerHand) >= 8;
	const bNat = baccaratHandTotal(bankerHand) >= 8;

	if (!pNat && !bNat) {
		let playerThird: BacCard | null = null;
		if (playerDrawsThird(playerHand)) {
			playerThird = deck.pop()!;
			playerHand.push(playerThird);
		}
		if (bankerDrawsThird(bankerHand, playerThird)) {
			bankerHand.push(deck.pop()!);
		}
	}

	const result = evaluateBaccarat(playerHand, bankerHand);
	room.gameState = { playerHand, bankerHand, result };

	for (const p of room.players) {
		if (p.userId === room.hostId) continue;
		if (!p.ready || p.bet <= 0) continue;

		const won = result === p.betChoice;
		const isTie = result === 'tie';

		if (won) {
			const mult = baccaratMultiplier(p.betChoice as BaccaratBet);
			const payout = Math.round(p.bet * mult * 100) / 100;
			p.result = 'win';
			p.payout = payout;
			await updatePlayerCredit(platform, p.userId, payout, { received: payout - p.bet });
		} else if (isTie && p.betChoice !== 'tie') {
			p.result = 'push';
			p.payout = p.bet;
			await updatePlayerCredit(platform, p.userId, p.bet);
		} else {
			p.result = 'lose';
			p.payout = 0;
			await updatePlayerCredit(platform, p.userId, 0, { spent: p.bet });
		}
	}

	await settleWithDealer(platform, room);
	room.phase = 'result';
	await saveRoom(platform, room);
	return room;
}

async function dealPokdeng(platform: App.Platform | undefined, room: Room): Promise<Room> {
	const deck = pdCreateDeck();
	const dealerHand: PDCard[] = [deck.pop()!, deck.pop()!];

	room.gameState = { dealerHand };

	for (const p of room.players) {
		if (p.userId === room.hostId) continue;
		if (!p.ready || p.bet <= 0) continue;

		p.hand = [deck.pop()!, deck.pop()!];

		const outcome = evaluatePokDeng(p.hand, dealerHand);
		if (outcome === 'win') {
			const mult = pokdengMultiplier(p.hand);
			const payout = Math.round(p.bet * mult * 100) / 100;
			p.result = 'win';
			p.payout = payout;
			await updatePlayerCredit(platform, p.userId, payout, { received: payout - p.bet });
		} else if (outcome === 'draw') {
			p.result = 'push';
			p.payout = p.bet;
			await updatePlayerCredit(platform, p.userId, p.bet);
		} else {
			p.result = 'lose';
			p.payout = 0;
			await updatePlayerCredit(platform, p.userId, 0, { spent: p.bet });
		}
	}

	await settleWithDealer(platform, room);
	room.phase = 'result';
	await saveRoom(platform, room);
	return room;
}

async function dealGaoGae(platform: App.Platform | undefined, room: Room): Promise<Room> {
	const deck = ggCreateDeck();
	const dealerHand: GGCard[] = [deck.pop()!, deck.pop()!, deck.pop()!];

	room.gameState = { dealerHand, dealerType: ggGetHandType(dealerHand), dealerTypeName: ggHandTypeName(ggGetHandType(dealerHand)), dealerPoints: ggHandPoints(dealerHand) };

	for (const p of room.players) {
		if (p.userId === room.hostId) continue;
		if (!p.ready || p.bet <= 0) continue;

		p.hand = [deck.pop()!, deck.pop()!, deck.pop()!];

		const outcome = ggCompareHands(p.hand, dealerHand);
		const playerType = ggGetHandType(p.hand);

		if (outcome === 'win') {
			const mult = ggGetHandMultiplier(playerType);
			const payout = Math.round(p.bet * mult * 100) / 100;
			p.result = 'win';
			p.payout = payout;
			await updatePlayerCredit(platform, p.userId, payout, { received: payout - p.bet });
		} else if (outcome === 'draw') {
			p.result = 'push';
			p.payout = p.bet;
			await updatePlayerCredit(platform, p.userId, p.bet);
		} else {
			p.result = 'lose';
			p.payout = 0;
			await updatePlayerCredit(platform, p.userId, 0, { spent: p.bet });
		}

		(p as any).handType = playerType;
		(p as any).handTypeName = ggHandTypeName(playerType);
		(p as any).handPoints = ggHandPoints(p.hand);
	}

	await settleWithDealer(platform, room);
	room.phase = 'result';
	await saveRoom(platform, room);
	return room;
}

async function dealDragonTiger(platform: App.Platform | undefined, room: Room): Promise<Room> {
	const deck = dtCreateDeck();
	const dragon = deck.pop()!;
	const tiger = deck.pop()!;
	const outcome = dtEvaluate(dragon, tiger);

	room.gameState = { dragon, tiger, result: outcome };

	for (const p of room.players) {
		if (p.userId === room.hostId) continue;
		if (!p.ready || p.bet <= 0) continue;

		const won = outcome === p.betChoice;
		const isTie = outcome === 'tie';

		if (won) {
			const mult = dtMultiplier(p.betChoice as DTBet);
			const payout = Math.round(p.bet * mult * 100) / 100;
			p.result = 'win';
			p.payout = payout;
			await updatePlayerCredit(platform, p.userId, payout, { received: payout - p.bet });
		} else if (isTie && p.betChoice !== 'tie') {
			const returned = Math.round(p.bet / 2 * 100) / 100;
			p.result = 'lose';
			p.payout = returned;
			await updatePlayerCredit(platform, p.userId, returned, { spent: p.bet - returned });
		} else {
			p.result = 'lose';
			p.payout = 0;
			await updatePlayerCredit(platform, p.userId, 0, { spent: p.bet });
		}
	}

	await settleWithDealer(platform, room);
	room.phase = 'result';
	await saveRoom(platform, room);
	return room;
}

async function dealHiLo(platform: App.Platform | undefined, room: Room): Promise<Room> {
	const deck = hiloCreateDeck();
	const baseCard = deck.pop()!;
	const nextCard = deck.pop()!;

	room.gameState = { baseCard, nextCard };

	for (const p of room.players) {
		if (p.userId === room.hostId) continue;
		if (!p.ready || p.bet <= 0) continue;

		const won = evaluateHiLo(baseCard, nextCard, p.betChoice as HiLoGuess);

		if (won) {
			const payout = Math.round(p.bet * HILO_MULTIPLIER * 100) / 100;
			p.result = 'win';
			p.payout = payout;
			await updatePlayerCredit(platform, p.userId, payout, { received: payout - p.bet });
		} else if (baseCard.rank === nextCard.rank) {
			p.result = 'push';
			p.payout = p.bet;
			await updatePlayerCredit(platform, p.userId, p.bet);
		} else {
			p.result = 'lose';
			p.payout = 0;
			await updatePlayerCredit(platform, p.userId, 0, { spent: p.bet });
		}
	}

	await settleWithDealer(platform, room);
	room.phase = 'result';
	await saveRoom(platform, room);
	return room;
}

// =============================================
// VIDEO POKER
// =============================================

function vpCardToRoom(card: VPCard) {
	return { ...card, display: card.rank };
}

async function dealVideoPoker(platform: App.Platform | undefined, room: Room): Promise<Room> {
	const decks: Record<string, VPCard[]> = {};

	for (const p of room.players) {
		if (p.userId === room.hostId) continue;
		if (!p.ready || p.bet <= 0) continue;

		const { hand, deck } = vpDealHand();
		p.hand = hand.map(vpCardToRoom);
		p.stood = false;
		decks[p.userId] = deck;
	}

	room.gameState = { decks };
	room.phase = 'playing';
	await saveRoom(platform, room);
	return room;
}

export async function videoPokerDraw(platform: App.Platform | undefined, code: string, userId: string, holds: boolean[]): Promise<Room | null> {
	const room = await getRoomFromKV(platform, code);
	if (!room) return null;
	if (room.game !== 'videopoker') return null;
	if (room.phase !== 'playing') return null;

	const player = room.players.find(p => p.userId === userId);
	if (!player || !player.hand || player.stood) return null;
	if (!Array.isArray(holds) || holds.length !== 5) return null;

	const deck: VPCard[] = room.gameState?.decks?.[userId];
	if (!deck) return null;

	// Convert room cards back to VP cards for evaluation
	const vpHand: VPCard[] = player.hand.map((c: any) => ({ suit: c.suit, rank: c.rank }));

	// Replace non-held cards
	let drawIdx = 0;
	for (let i = 0; i < 5; i++) {
		if (!holds[i] && drawIdx < deck.length) {
			vpHand[i] = deck[drawIdx++];
		}
	}

	// Update hand
	player.hand = vpHand.map(vpCardToRoom);

	// Evaluate
	const handRank = vpEvaluateHand(vpHand);
	const multiplier = VP_PAYOUTS[handRank];

	if (multiplier > 1) {
		const payout = Math.round(player.bet * multiplier * 100) / 100;
		player.result = 'win';
		player.payout = payout;
		await updatePlayerCredit(platform, player.userId, payout, { received: payout - player.bet });
	} else if (multiplier === 1) {
		// Jacks or Better = push (1x = return bet)
		player.result = 'push';
		player.payout = player.bet;
		await updatePlayerCredit(platform, player.userId, player.bet);
	} else {
		player.result = 'lose';
		player.payout = 0;
		await updatePlayerCredit(platform, player.userId, 0, { spent: player.bet });
	}

	player.stood = true;
	(player as any).handRank = handRank;

	// Check if all players have drawn
	const activePlayers = room.players.filter(p => p.userId !== room.hostId && p.ready && p.bet > 0);
	const allDrew = activePlayers.every(p => p.stood);

	if (allDrew) {
		await settleWithDealer(platform, room);
		room.phase = 'result';
		delete room.gameState.decks;
	}

	room.lastActivity = Date.now();
	await saveRoom(platform, room);
	return room;
}

// =============================================
// ROULETTE
// =============================================

async function dealRoulette(platform: App.Platform | undefined, room: Room): Promise<Room> {
	const resultNumber = rouletteSpin();
	room.gameState = { resultNumber };

	for (const p of room.players) {
		if (p.userId === room.hostId) continue;
		if (!p.ready || p.bet <= 0) continue;

		const bc = p.betChoice || '';
		let betType: RouletteBetType;
		let betValue: number | undefined;

		if (bc.startsWith('number:')) {
			betType = 'number';
			betValue = parseInt(bc.split(':')[1]);
		} else {
			betType = bc as RouletteBetType;
		}

		const bet: RouletteBet = { type: betType, value: betValue, multiplier: rouletteMultiplier(betType) };
		const won = rouletteEvaluateBet(bet, resultNumber);

		if (won) {
			const mult = rouletteMultiplier(betType);
			const payout = Math.round(p.bet * mult * 100) / 100;
			p.result = 'win';
			p.payout = payout;
			await updatePlayerCredit(platform, p.userId, payout, { received: payout - p.bet });
		} else {
			p.result = 'lose';
			p.payout = 0;
			await updatePlayerCredit(platform, p.userId, 0, { spent: p.bet });
		}
	}

	await settleWithDealer(platform, room);
	room.phase = 'result';
	await saveRoom(platform, room);
	return room;
}

// Blackjack player action (hit/stand)
export async function playerAction(platform: App.Platform | undefined, code: string, userId: string, action: 'hit' | 'stand'): Promise<Room | null> {
	const room = await getRoomFromKV(platform, code);
	if (!room) return null;
	if (room.game !== 'blackjack') return null;
	if (room.phase !== 'playing') return null;

	const player = room.players.find(p => p.userId === userId);
	if (!player || !player.hand || player.stood) return null;

	if (action === 'stand') {
		player.stood = true;
	} else if (action === 'hit') {
		const gs = room.gameState;
		if (!gs.deck || gs.deck.length === 0) gs.deck = bjCreateDeck();
		const card = gs.deck.pop()!;
		player.hand.push(card);

		if (isBust(player.hand)) {
			player.stood = true;
			player.result = 'lose';
			player.payout = 0;
			await updatePlayerCredit(platform, player.userId, 0, { spent: player.bet });
		} else if (handValue(player.hand) === 21) {
			player.stood = true;
		}
	}

	const activePlayers = room.players.filter(p => p.userId !== room.hostId && p.ready && p.bet > 0);
	const allStood = activePlayers.every(p => p.stood);

	if (allStood) {
		await resolveBlackjackDealer(platform, room);
	}

	room.lastActivity = Date.now();
	await saveRoom(platform, room);
	return room;
}

export async function revealDealer(platform: App.Platform | undefined, code: string, userId: string): Promise<Room | null> {
	const room = await getRoomFromKV(platform, code);
	if (!room) return null;
	if (room.hostId !== userId) return null;
	if (room.game !== 'blackjack') return null;
	if (room.phase !== 'playing') return null;

	for (const p of room.players) {
		if (p.userId === room.hostId) continue;
		if (p.ready && p.bet > 0 && !p.stood) {
			p.stood = true;
		}
	}

	await resolveBlackjackDealer(platform, room);
	room.lastActivity = Date.now();
	await saveRoom(platform, room);
	return room;
}

async function resolveBlackjackDealer(platform: App.Platform | undefined, room: Room): Promise<void> {
	const gs = room.gameState;
	const dealerHand: BJCard[] = gs.dealerHand;
	let deck: BJCard[] = gs.deck;

	while (handValue(dealerHand) < 17) {
		if (!deck || deck.length === 0) deck = bjCreateDeck();
		dealerHand.push(deck.pop()!);
	}

	gs.dealerRevealed = true;
	gs.dealerHand = dealerHand;
	gs.deck = deck;

	for (const p of room.players) {
		if (p.userId === room.hostId) continue;
		if (!p.ready || p.bet <= 0) continue;
		if (p.result === 'lose') continue;

		const result = evaluateBlackjack(p.hand, dealerHand);
		const mult = bjMultiplier(result);
		const payout = Math.round(p.bet * mult * 100) / 100;

		if (result === 'win' || result === 'blackjack') {
			p.result = 'win';
			p.payout = payout;
			await updatePlayerCredit(platform, p.userId, payout, { received: payout - p.bet });
		} else if (result === 'push') {
			p.result = 'push';
			p.payout = p.bet;
			await updatePlayerCredit(platform, p.userId, p.bet);
		} else {
			p.result = 'lose';
			p.payout = 0;
			await updatePlayerCredit(platform, p.userId, 0, { spent: p.bet });
		}
	}

	await settleWithDealer(platform, room);
	room.phase = 'result';
}

export async function nextRound(platform: App.Platform | undefined, code: string, userId: string): Promise<Room | null> {
	return startBetting(platform, code, userId);
}

export async function claimHost(platform: App.Platform | undefined, code: string, userId: string): Promise<Room | null> {
	const room = await getRoomFromKV(platform, code);
	if (!room) return null;
	// Can only claim when bot is dealer
	if (room.hostId !== BOT_HOST_ID) return null;
	// Must be a player in the room
	const player = room.players.find(p => p.userId === userId);
	if (!player) return null;
	// Can only claim during betting or waiting or result
	if (room.phase === 'playing' || room.phase === 'dealing') return null;
	// Can't claim if credit is negative
	const claimUser = await getUser(platform, userId);
	if (!claimUser || claimUser.credit < 0) return null;

	// Refund bet if already placed (host can't bet)
	if (player.ready && player.bet > 0) {
		claimUser.credit += player.bet;
		await saveUser(platform, claimUser);
		player.bet = 0;
		player.betChoice = undefined;
		player.ready = false;
	}

	room.hostId = userId;
	room.lastActivity = Date.now();
	await saveRoom(platform, room);
	return room;
}

export async function releaseHost(platform: App.Platform | undefined, code: string, userId: string): Promise<Room | null> {
	const room = await getRoomFromKV(platform, code);
	if (!room) return null;
	if (room.hostId !== userId) return null;
	// Can only release during betting or waiting or result
	if (room.phase === 'playing' || room.phase === 'dealing') return null;

	room.hostId = BOT_HOST_ID;
	// If the player had a bet placed, unreset their ready state is fine
	room.lastActivity = Date.now();
	await saveRoom(platform, room);
	return room;
}

export async function cleanStaleRooms(platform: App.Platform | undefined): Promise<number> {
	const codes = await getAllRoomCodes(platform);
	const cutoff = Date.now() - 10 * 60 * 1000;
	let removed = 0;
	for (const code of codes) {
		const room = await getRoomFromKV(platform, code);
		if (room && room.lastActivity <= cutoff) {
			await deleteRoom(platform, code);
			removed++;
		}
	}
	return removed;
}

export async function getRoomForUser(platform: App.Platform | undefined, room: Room, userId: string): Promise<any> {
	const sanitized: any = { ...room };

	if (room.game === 'blackjack' && room.phase === 'playing' && room.gameState) {
		// Hide dealer hole card until revealed
		if (!room.gameState.dealerRevealed) {
			sanitized.gameState = {
				...room.gameState,
				dealerHand: [room.gameState.dealerHand[0], null],
				deck: undefined
			};
		} else {
			sanitized.gameState = { ...room.gameState, deck: undefined };
		}

		// Everyone only sees their own hand — other players' cards are hidden
		sanitized.players = room.players.map(p => {
			if (p.userId === userId) return p;
			if (p.userId === room.hostId) return p; // host has no hand
			return { ...p, hand: p.hand ? p.hand.map(() => null) : undefined };
		});
	} else if (room.game === 'videopoker' && room.phase === 'playing' && room.gameState) {
		sanitized.gameState = { ...room.gameState, decks: undefined };
		sanitized.players = room.players.map(p => {
			if (p.userId === userId) return p;
			if (p.userId === room.hostId) return p;
			return { ...p, hand: p.hand ? p.hand.map(() => null) : undefined };
		});
	} else {
		if (sanitized.gameState) {
			sanitized.gameState = { ...sanitized.gameState, deck: undefined, decks: undefined };
		}
	}

	// Include host's credit so players know their bet limit
	if (room.hostId !== BOT_HOST_ID) {
		const hostUser = await getUser(platform, room.hostId);
		sanitized.hostCredit = hostUser ? Math.round(hostUser.credit * 100) / 100 : 0;
	}

	return sanitized;
}
