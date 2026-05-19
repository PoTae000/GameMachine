<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { currentUser, loadCredit, wallet, revealBlocking } from '$lib/store.svelte';
	import { renderCard, renderCardBack } from '$lib/cardSvg';
	import { playCardDeal, playCardFlip, playBet, playWin, playLose, playClick, playSuspense, playHeartbeat, playRevealBig, playBigWin, playCardShuffle } from '$lib/sounds';
	import { RED_NUMBERS } from '$lib/games/rouletteEngine';
	import RouletteWheel from '$lib/RouletteWheel.svelte';

	let { data } = $props();

	let room: any = $state(data.room ?? null);
	let error = $state('');
	let loading = $state(!data.room);
	let polling = $state(true);
	let leaving = false;
	let betAmount = $state(50);
	let betChoice = $state('');
	let actionLoading = $state(false);
	let copied = $state(false);
	let showCloseConfirm = $state(false);

	// Anti-flicker: track when cards actually change
	let lastRound = $state(0);
	let lastPhase = $state('');
	let cardsJustDealt = $state(false);

	// Card reveal sequence for suspense
	let revealStep = $state(99);
	let revealTimers: ReturnType<typeof setTimeout>[] = [];
	let revealInProgress = $state(false);
	let deckPhase: 'idle' | 'riffle' | 'wash' | 'riffle2' | 'cut' = $state('idle');
	let glowingDealerBack = $state(false);
	let lastDealerHeartbeat = $state(false);

	// Video Poker state
	let vpHolds = $state([false, false, false, false, false]);

	// Roulette state
	const RED_NUMBERS_SET = new Set(RED_NUMBERS);
	let rouletteNumber: number | null = $state(null);
	let rouletteWheelResult: number | null = $state(null);
	let rouletteSpinning = $state(false);

	function clearRevealTimers() {
		revealTimers.forEach(t => clearTimeout(t));
		revealTimers = [];
	}

	function startRevealSequence(game: string, toPhase: string) {
		clearRevealTimers();
		revealStep = 0;
		revealInProgress = true;
		revealBlocking.value = true;
		frozenHostCredit = Math.floor(room?.hostCredit ?? 0);
		glowingDealerBack = false;
		lastDealerHeartbeat = false;

		// Multi-phase deck shuffle animation (matching solo play) — skip for roulette
		const isRoulette = game === 'roulette';
		if (!isRoulette) {
			deckPhase = 'riffle';
			playCardShuffle();
			revealTimers.push(setTimeout(() => { deckPhase = 'wash'; }, 500));
			revealTimers.push(setTimeout(() => { deckPhase = 'riffle2'; }, 1100));
			revealTimers.push(setTimeout(() => { deckPhase = 'cut'; }, 1600));
			revealTimers.push(setTimeout(() => { deckPhase = 'idle'; }, 2050));
		} else {
			deckPhase = 'idle';
		}

		const S = 2200; // offset after shuffle ends

		if (game === 'baccarat') {
			// Card-by-card dealing then flip sequence
			revealTimers.push(setTimeout(() => { revealStep = 1; playCardDeal(); }, S));
			revealTimers.push(setTimeout(() => { revealStep = 1.1; playCardDeal(); }, S + 350));
			revealTimers.push(setTimeout(() => { revealStep = 2; playCardFlip(); }, S + 1600));
			revealTimers.push(setTimeout(() => { playHeartbeat(); }, S + 2800));
			revealTimers.push(setTimeout(() => { lastDealerHeartbeat = true; glowingDealerBack = true; playSuspense(); }, S + 3200));
			revealTimers.push(setTimeout(() => { lastDealerHeartbeat = false; glowingDealerBack = false; revealStep = 4; playRevealBig(); }, S + 4300));
			revealTimers.push(setTimeout(() => { revealStep = 5; revealInProgress = false; revealBlocking.value = false; frozenHostCredit = null; loadCredit(); }, S + 5600));
		} else if (game === 'dragontiger') {
			revealTimers.push(setTimeout(() => { revealStep = 1; playCardDeal(); }, S));
			revealTimers.push(setTimeout(() => { revealStep = 1.1; playCardDeal(); }, S + 400));
			revealTimers.push(setTimeout(() => { revealStep = 2; playCardFlip(); }, S + 1600));
			revealTimers.push(setTimeout(() => { playHeartbeat(); }, S + 2800));
			revealTimers.push(setTimeout(() => { lastDealerHeartbeat = true; glowingDealerBack = true; playSuspense(); }, S + 3200));
			revealTimers.push(setTimeout(() => { lastDealerHeartbeat = false; glowingDealerBack = false; revealStep = 4; playRevealBig(); }, S + 4300));
			revealTimers.push(setTimeout(() => { revealStep = 5; revealInProgress = false; revealBlocking.value = false; frozenHostCredit = null; loadCredit(); }, S + 5600));
		} else if (game === 'hilo') {
			revealTimers.push(setTimeout(() => { revealStep = 1; playCardDeal(); }, S));
			revealTimers.push(setTimeout(() => { revealStep = 1.1; playCardDeal(); }, S + 400));
			revealTimers.push(setTimeout(() => { revealStep = 2; playCardFlip(); }, S + 1600));
			revealTimers.push(setTimeout(() => { playHeartbeat(); }, S + 2800));
			revealTimers.push(setTimeout(() => { lastDealerHeartbeat = true; glowingDealerBack = true; playSuspense(); }, S + 3200));
			revealTimers.push(setTimeout(() => { lastDealerHeartbeat = false; glowingDealerBack = false; revealStep = 4; playRevealBig(); }, S + 4300));
			revealTimers.push(setTimeout(() => { revealStep = 5; revealInProgress = false; revealBlocking.value = false; frozenHostCredit = null; loadCredit(); }, S + 5600));
		} else if (game === 'blackjack') {
			if (toPhase === 'playing') {
				revealTimers.push(setTimeout(() => { revealStep = 1; playCardDeal(); }, S));
				revealTimers.push(setTimeout(() => { revealStep = 1.5; playCardDeal(); }, S + 400));
				revealTimers.push(setTimeout(() => { revealStep = 2; playCardFlip(); }, S + 1300));
				revealTimers.push(setTimeout(() => { revealStep = 99; revealInProgress = false; revealBlocking.value = false; frozenHostCredit = null; loadCredit(); }, S + 2000));
			} else {
				revealTimers.push(setTimeout(() => { glowingDealerBack = true; lastDealerHeartbeat = true; playHeartbeat(); }, S));
				revealTimers.push(setTimeout(() => { playHeartbeat(); }, S + 800));
				revealTimers.push(setTimeout(() => { playSuspense(); }, S + 1400));
				revealTimers.push(setTimeout(() => { glowingDealerBack = false; lastDealerHeartbeat = false; revealStep = 1; playRevealBig(); }, S + 2200));
				revealTimers.push(setTimeout(() => { revealStep = 99; revealInProgress = false; revealBlocking.value = false; frozenHostCredit = null; loadCredit(); }, S + 2900));
			}
		} else if (game === 'pokdeng') {
			// Card-by-card dealing with dealer heartbeat/glow suspense
			revealTimers.push(setTimeout(() => { revealStep = 1; playCardDeal(); }, S));
			revealTimers.push(setTimeout(() => { revealStep = 1.1; playCardDeal(); }, S + 300));
			revealTimers.push(setTimeout(() => { revealStep = 1.2; playCardDeal(); }, S + 600));
			revealTimers.push(setTimeout(() => { revealStep = 1.3; playCardDeal(); }, S + 900));
			revealTimers.push(setTimeout(() => { revealStep = 2; playCardFlip(); }, S + 1400));
			revealTimers.push(setTimeout(() => { playHeartbeat(); }, S + 2500));
			revealTimers.push(setTimeout(() => { playSuspense(); }, S + 3200));
			revealTimers.push(setTimeout(() => { revealStep = 4; playCardFlip(); }, S + 3800));
			revealTimers.push(setTimeout(() => { lastDealerHeartbeat = true; glowingDealerBack = true; playHeartbeat(); }, S + 4300));
			revealTimers.push(setTimeout(() => { lastDealerHeartbeat = false; glowingDealerBack = false; revealStep = 5; playRevealBig(); }, S + 5500));
			revealTimers.push(setTimeout(() => { revealStep = 6; revealInProgress = false; revealBlocking.value = false; frozenHostCredit = null; loadCredit(); }, S + 6800));
		} else if (game === 'gaogae') {
			// 3 cards each: deal alternating, flip player, suspense dealer last card
			revealTimers.push(setTimeout(() => { revealStep = 1; playCardDeal(); }, S));
			revealTimers.push(setTimeout(() => { revealStep = 1.1; playCardDeal(); }, S + 300));
			revealTimers.push(setTimeout(() => { revealStep = 1.2; playCardDeal(); }, S + 600));
			revealTimers.push(setTimeout(() => { revealStep = 1.3; playCardDeal(); }, S + 900));
			revealTimers.push(setTimeout(() => { revealStep = 1.4; playCardDeal(); }, S + 1200));
			revealTimers.push(setTimeout(() => { revealStep = 1.5; playCardDeal(); }, S + 1500));
			revealTimers.push(setTimeout(() => { revealStep = 2; playCardFlip(); }, S + 2000));
			revealTimers.push(setTimeout(() => { playHeartbeat(); }, S + 3000));
			revealTimers.push(setTimeout(() => { playSuspense(); }, S + 3500));
			revealTimers.push(setTimeout(() => { revealStep = 4; playCardFlip(); }, S + 4000));
			revealTimers.push(setTimeout(() => { lastDealerHeartbeat = true; glowingDealerBack = true; playHeartbeat(); }, S + 4500));
			revealTimers.push(setTimeout(() => { lastDealerHeartbeat = false; glowingDealerBack = false; revealStep = 5; playRevealBig(); }, S + 5700));
			revealTimers.push(setTimeout(() => { revealStep = 6; revealInProgress = false; revealBlocking.value = false; frozenHostCredit = null; loadCredit(); }, S + 7000));
		} else if (game === 'videopoker') {
			// Deal 5 cards staggered, then enter playing
			revealTimers.push(setTimeout(() => { revealStep = 1; playCardDeal(); }, S));
			revealTimers.push(setTimeout(() => { revealStep = 1.5; playCardDeal(); }, S + 200));
			revealTimers.push(setTimeout(() => { revealStep = 2; playCardDeal(); }, S + 400));
			revealTimers.push(setTimeout(() => { revealStep = 2.5; playCardDeal(); }, S + 600));
			revealTimers.push(setTimeout(() => { revealStep = 3; playCardDeal(); }, S + 800));
			revealTimers.push(setTimeout(() => { revealStep = 99; revealInProgress = false; revealBlocking.value = false; frozenHostCredit = null; loadCredit(); }, S + 1200));
		} else if (game === 'roulette') {
			deckPhase = 'idle'; // skip card shuffle
			rouletteSpinning = true;
			rouletteWheelResult = room.gameState?.resultNumber ?? null;
			revealStep = 1;
			// RouletteWheel component handles timing/sounds, calls onRouletteAnimComplete when done
		} else {
			deckPhase = 'idle';
			revealStep = 99;
			revealInProgress = false; revealBlocking.value = false; frozenHostCredit = null;
		}
	}

	function onRouletteAnimComplete() {
		rouletteSpinning = false;
		revealStep = 99;
		playRevealBig();
		revealInProgress = false;
		revealBlocking.value = false;
		frozenHostCredit = null;
		loadCredit();
	}

	// Betting countdown timer — starts when some players ready but not all
	let countdown = $state(0);
	let countdownKey = $state(0);
	let countdownTimer: ReturnType<typeof setInterval>;
	let countdownActive = $state(false);
	const COUNTDOWN_SEC = 8;

	function startCountdown() {
		if (countdownActive) return;
		clearInterval(countdownTimer);
		countdownActive = true;
		countdown = COUNTDOWN_SEC;
		countdownKey++;
		countdownTimer = setInterval(() => {
			countdown--;
			if (countdown <= 3 && countdown > 0) playClick();
			if (countdown <= 0) {
				clearInterval(countdownTimer);
				countdown = 0;
				countdownActive = false;
				forceStartGame();
			}
		}, 1000);
	}

	function stopCountdown() {
		clearInterval(countdownTimer);
		countdown = 0;
		countdownActive = false;
	}

	async function forceStartGame() {
		if (!isHost) return; // Only the host can force-start
		try {
			const res = await fetch(`/api/room/${code}/forcestart`, { method: 'POST' });
			const data = await res.json();
			if (res.ok && data.room) {
				applyRoomUpdate(data.room);
			}
			if (!revealInProgress) loadCredit();
		} catch { /* ignore */ }
		setTimeout(() => fetchRoom(), 200);
	}

	let code = $derived($page.params.code);
	let isBotDealer = $derived(room?.hostId === '__bot__');
	let isHost = $derived(!isBotDealer && room?.hostId === currentUser.value?.id);
	let myPlayer = $derived(room?.players?.find((p: any) => p.userId === currentUser.value?.id));
	let otherPlayers = $derived(
		isBotDealer
			? (room?.players ?? [])
			: (room?.players?.filter((p: any) => p.userId !== room?.hostId) ?? [])
	);
	let allPlayersReady = $derived(otherPlayers.length > 0 && otherPlayers.every((p: any) => p.ready));
	let needsBetChoice = $derived(room?.game === 'baccarat' || room?.game === 'dragontiger' || room?.game === 'hilo' || room?.game === 'roulette');
	let useArcLayout = $derived(otherPlayers.length >= 2);

	let bjAllStood = $derived(
		room?.game === 'blackjack' && room?.phase === 'playing' &&
		otherPlayers.every((p: any) => p.stood)
	);
	let myBjHand = $derived(myPlayer?.hand ?? []);
	let myBjValue = $derived(calcHandValue(myBjHand));

	let isPlayer = $derived(isBotDealer || !isHost);
	let canClaimHost = $derived(isBotDealer && !!myPlayer && room?.phase !== 'playing' && room?.phase !== 'dealing');
	let canReleaseHost = $derived(isHost && room?.phase !== 'playing' && room?.phase !== 'dealing');
	let frozenHostCredit = $state<number | null>(null);
	let hostCredit = $derived(frozenHostCredit !== null ? frozenHostCredit : Math.floor(room?.hostCredit ?? 0));

	function shortNum(n: number): string {
		const prefix = n < 0 ? '-' : '';
		const abs = Math.abs(n);
		if (abs >= 1_000_000) return prefix + (abs / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M';
		if (abs >= 1_000) return prefix + (abs / 1_000).toFixed(2).replace(/\.?0+$/, '') + 'K';
		return prefix + String(abs);
	}

	function calcHandValue(hand: any[]): number {
		if (!hand || hand.length === 0) return 0;
		let total = 0, aces = 0;
		for (const c of hand) {
			if (!c) continue;
			if (c.rank === 1) { aces++; total += 11; }
			else if (c.rank >= 10) total += 10;
			else total += c.rank;
		}
		while (total > 21 && aces > 0) { total -= 10; aces--; }
		return total;
	}

	function baccaratPoints(hand: any[]): number {
		if (!hand) return 0;
		return hand.reduce((s: number, c: any) => s + (c.rank >= 10 ? 0 : c.rank), 0) % 10;
	}

	function seatOffset(index: number, total: number): number {
		if (total <= 1) return 0;
		const normalized = (index / (total - 1)) * 2 - 1;
		return Math.round((1 - normalized * normalized) * 24);
	}

	// Player color assignment for visual distinction
	const PLAYER_COLORS = ['#8b5cf6', '#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#ec4899', '#06b6d4', '#f97316'];
	function playerColor(index: number): string {
		return PLAYER_COLORS[index % PLAYER_COLORS.length];
	}

	let pollTimer: ReturnType<typeof setInterval>;
	let fetching = $state(false);
	let pollBackoff = $state(0);

	function getPollInterval(): number {
		if (!room) return 800;
		switch (room.phase) {
			case 'playing': return 400;
			case 'result': return 800;
			case 'betting': return 700;
			default: return 1500;
		}
	}

	function schedulePoll() {
		clearTimeout(pollTimer);
		const delay = pollBackoff > 0 ? pollBackoff : getPollInterval();
		pollTimer = setTimeout(async () => {
			if (polling) {
				await fetchRoom();
				schedulePoll();
			}
		}, delay);
	}

	onMount(() => {
		// Server already loaded room data via +page.server.ts; start polling immediately
		if (room) {
			lastRound = room.round ?? 0;
			lastPhase = room.phase ?? '';
			schedulePoll();
		} else {
			fetchRoom().then(() => schedulePoll());
		}
		return () => { clearTimeout(pollTimer); clearRevealTimers(); clearInterval(countdownTimer); };
	});

	async function fetchRoom() {
		if (fetching || leaving) return;
		fetching = true;
		try {
			const res = await fetch(`/api/room/${code}`);
			const data = await res.json();
			if (!res.ok) {
				if (res.status === 429) {
					// Rate limited — back off but keep room state intact
					pollBackoff = Math.min((pollBackoff || 2000) * 2, 10000);
					loading = false;
					fetching = false;
					return;
				}
				if (data.closed) {
					error = 'ห้องถูกปิดแล้ว';
					polling = false;
				} else {
					error = data.error || 'โหลดข้อมูลห้องไม่ได้';
				}
				room = null;
				loading = false;
				fetching = false;
				return;
			}
			pollBackoff = 0;
			applyRoomUpdate(data.room);
		} catch {
			error = 'เชื่อมต่อไม่ได้';
		}
		loading = false;
		fetching = false;
	}

	function applyRoomUpdate(newRoom: any) {
		const phaseChanged = newRoom.phase !== lastPhase;
		const roundChanged = newRoom.round !== lastRound;

		// Guard: don't let polling overwrite the UI while card reveal is still in progress
		if (revealInProgress && phaseChanged && newRoom.phase === 'betting' && (lastPhase === 'result' || lastPhase === 'playing')) {
			return; // skip this poll — next poll after reveal finishes will apply
		}

		// When moving from result to betting, clean up reveal state
		if (phaseChanged && lastPhase === 'result' && newRoom.phase === 'betting') {
			clearRevealTimers();
			revealStep = 99;
			deckPhase = 'idle';
			glowingDealerBack = false;
			lastDealerHeartbeat = false;
			revealInProgress = false; revealBlocking.value = false; frozenHostCredit = null;
			vpHolds = [false, false, false, false, false];
			rouletteNumber = null;
			rouletteWheelResult = null;
			rouletteSpinning = false;
		}

		// Start/stop countdown timer
		if (phaseChanged && newRoom.phase !== 'betting') {
			stopCountdown();
		}
		if (newRoom.phase === 'betting') {
			const players = newRoom.players?.filter((p: any) => p.userId !== newRoom.hostId) ?? [];
			const someReady = players.some((p: any) => p.ready);
			const allReady = players.length > 0 && players.every((p: any) => p.ready);
			if (someReady && !allReady && players.length >= 2 && !countdownActive) {
				startCountdown();
			}
		}

		// Trigger reveal sequence when cards are dealt
		if (phaseChanged && newRoom.gameState) {
			if (lastPhase === 'betting' && (newRoom.phase === 'playing' || newRoom.phase === 'result')) {
				startRevealSequence(newRoom.game, newRoom.phase);
				// Fix: set roulette result from newRoom (room hasn't been updated yet)
				if (newRoom.game === 'roulette') {
					rouletteWheelResult = newRoom.gameState?.resultNumber ?? null;
				}
				cardsJustDealt = true;
				setTimeout(() => { cardsJustDealt = false; }, 800);
			} else if (lastPhase === 'playing' && newRoom.phase === 'result' && newRoom.game === 'blackjack') {
				startRevealSequence(newRoom.game, newRoom.phase);
			}
		}

		// Play win/lose sounds after reveal completes
		if (phaseChanged && lastPhase) {
			if (newRoom.phase === 'result') {
				const delay = newRoom.game === 'blackjack' && lastPhase === 'playing' ? 5100
					: newRoom.game === 'pokdeng' ? 9000
					: newRoom.game === 'gaogae' ? 9200
					: newRoom.game === 'roulette' ? 9500
					: newRoom.game === 'videopoker' ? 3500
					: 7800;
				setTimeout(() => {
					const me = newRoom.players?.find((p: any) => p.userId === currentUser.value?.id);
					if (me?.result === 'win') playWin();
					else if (me?.result === 'lose') playLose();
					else if (newRoom.hostId === currentUser.value?.id) {
						playCardFlip();
					}
				}, delay);
			}
		}

		lastRound = newRoom.round;
		lastPhase = newRoom.phase;
		room = newRoom;
		error = '';
	}

	async function apiPost(endpoint: string, body: any = {}) {
		actionLoading = true;
		try {
			const res = await fetch(`/api/room/${code}/${endpoint}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			const data = await res.json();
			if (!res.ok) {
				error = data.error || 'เกิดข้อผิดพลาด';
			} else {
				if (data.room) {
					applyRoomUpdate(data.room);
				}
				error = '';
			}
			if (!revealInProgress && endpoint !== 'bet') loadCredit();
		} catch {
			error = 'เชื่อมต่อไม่ได้';
		}
		actionLoading = false;
		setTimeout(() => fetchRoom(), 200);
	}

	function startRound() { playClick(); apiPost('next'); }
	function deal() { playCardDeal(); apiPost('deal'); }
	function doBet() { playBet(); apiPost('bet', { bet: betAmount, betChoice: needsBetChoice ? betChoice : undefined }); }
	function vpDraw() { playClick(); apiPost('action', { action: 'draw', holds: vpHolds }); }
	function hit() { playClick(); apiPost('action', { action: 'hit' }); }
	function stand() { playClick(); apiPost('action', { action: 'stand' }); }
	function revealDealer() { playCardFlip(); apiPost('action', { action: 'reveal' }); }
	function claimHostRole() { playClick(); apiPost('host', { action: 'claim' }); }
	function releaseHostRole() { playClick(); apiPost('host', { action: 'release' }); }

	async function leaveRoom() {
		leaving = true;
		polling = false;
		clearTimeout(pollTimer);
		await apiPost('leave');
		goto('/room');
	}

	async function closeRoomAction() {
		leaving = true;
		polling = false;
		clearTimeout(pollTimer);
		await fetch(`/api/room/${code}/close`, { method: 'POST' });
		goto('/room');
	}

	function copyCode() {
		if (code) navigator.clipboard.writeText(code);
		copied = true;
		setTimeout(() => { copied = false; }, 1500);
	}

	function resultLabel(r: string | undefined): string {
		if (r === 'win') return 'ชนะ';
		if (r === 'lose') return 'แพ้';
		if (r === 'push') return 'เสมอ';
		return '';
	}

	function resultColor(r: string | undefined): string {
		if (r === 'win') return 'text-emerald-500';
		if (r === 'lose') return 'text-red-500';
		return 'text-slot-muted';
	}

	function resultBg(r: string | undefined): string {
		if (r === 'win') return 'bg-emerald-500/20 text-emerald-500 ring-1 ring-emerald-500/30';
		if (r === 'lose') return 'bg-red-500/20 text-red-500 ring-1 ring-red-500/30';
		return 'bg-slot-bg text-slot-muted';
	}

	function phaseLabel(phase: string): string {
		switch (phase) {
			case 'waiting': return 'รอผู้เล่น';
			case 'betting': return 'วางเดิมพัน';
			case 'dealing': return 'กำลังแจก';
			case 'playing': return 'กำลังเล่น';
			case 'result': return 'ผลลัพธ์';
			default: return phase;
		}
	}

	// Results only visible after reveal animation completes
	let revealDone = $derived(
		room?.game === 'blackjack' ? revealStep >= 99 :
		room?.game === 'pokdeng' ? revealStep >= 6 :
		room?.game === 'gaogae' ? revealStep >= 6 :
		room?.game === 'videopoker' ? revealStep >= 99 :
		room?.game === 'roulette' ? revealStep >= 99 :
		revealStep >= 5
	);

	let dealClass = $derived(cardsJustDealt ? 'animate-deal' : '');
</script>

{#snippet cardEl(card: any, w: number, h: number)}
	{#if card}
		<div class="card-wrapper {dealClass}" style="width:{w}px;height:{h}px;--deal-x:50px;--deal-y:-30px">
			{@html renderCard(card.suit, card.display, w, h)}
		</div>
	{:else}
		<div class="card-wrapper {dealClass}" style="width:{w}px;height:{h}px;--deal-x:50px;--deal-y:-30px">
			{@html renderCardBack(w, h)}
		</div>
	{/if}
{/snippet}

{#snippet cardStatic(card: any, w: number, h: number)}
	{#if card}
		<div class="card-wrapper" style="width:{w}px;height:{h}px">
			{@html renderCard(card.suit, card.display, w, h)}
		</div>
	{:else}
		<div class="card-wrapper" style="width:{w}px;height:{h}px">
			{@html renderCardBack(w, h)}
		</div>
	{/if}
{/snippet}

{#snippet deckShuffleOverlay()}
	<div class="shuffle-overlay">
		<div class="relative h-20 w-14 sm:h-24 sm:w-[4.2rem]">
			<div class="absolute inset-0 {deckPhase === 'riffle' ? 'animate-shuffle-left' : ''} {deckPhase === 'wash' ? 'animate-shuffle-wash' : ''} {deckPhase === 'riffle2' ? 'animate-shuffle-left' : ''}">
				<div class="absolute inset-0 rounded-lg" style="transform: rotate(-3deg) translate(-3px, -4px)">{@html renderCardBack(48, 68)}</div>
				<div class="absolute inset-0 rounded-lg" style="transform: rotate(-1.5deg) translate(-1.5px, -2px)">{@html renderCardBack(48, 68)}</div>
			</div>
			<div class="absolute inset-0 {deckPhase === 'riffle' ? 'animate-shuffle-right' : ''} {deckPhase === 'wash' ? 'animate-shuffle-fan' : ''} {deckPhase === 'riffle2' ? 'animate-shuffle-right' : ''} {deckPhase === 'cut' ? 'animate-shuffle-cut' : ''}">
				<div class="absolute inset-0 rounded-lg" style="transform: rotate(0deg) translate(0.5px, -0.5px)">{@html renderCardBack(48, 68)}</div>
				<div class="absolute inset-0 rounded-lg">{@html renderCardBack(48, 68)}</div>
			</div>
		</div>
		<p class="mt-3 text-xs font-bold text-white/50 animate-pulse">สับไพ่...</p>
	</div>
{/snippet}

{#snippet playerSeat(player: any, index: number, total: number, gameType: string)}
	{@const pColor = playerColor(room?.players?.indexOf(player) ?? index)}
	<div class="arc-seat" style="margin-top: {seatOffset(index, total)}px">
		<div class="arc-seat-inner {player.userId === currentUser.value?.id ? 'arc-seat-me' : ''} {revealDone && player.result === 'win' ? 'arc-seat-win' : revealDone && player.result === 'lose' ? 'arc-seat-lose' : ''}">
			<!-- Avatar + name -->
			<div class="flex items-center justify-center gap-1 mb-1">
				<span class="inline-flex h-4 w-4 items-center justify-center rounded-full text-[7px] font-black text-white" style="background:{pColor}">{player.username.charAt(0)}</span>
				<span class="arc-seat-name">{player.username}</span>
			</div>

			<!-- Cards -->
			{#if gameType === 'blackjack' && player.hand}
				<div class="flex justify-center gap-0.5 flex-wrap">
					{#each player.hand as card}
						{@render cardStatic(card, 34, 48)}
					{/each}
				</div>
				<p class="arc-seat-value">{calcHandValue(player.hand.filter((c: any) => c))}
					{#if player.stood && !player.result}<span class="text-white/30 ml-0.5">S</span>{/if}
				</p>
			{:else if gameType === 'pokdeng' && player.hand}
				<div class="flex justify-center gap-0.5">
					{#each player.hand as card}
						{@render cardStatic(card, 34, 48)}
					{/each}
				</div>
				<p class="arc-seat-value">{baccaratPoints(player.hand)} แต้ม</p>
			{:else if gameType === 'gaogae' && player.hand}
				<div class="flex justify-center gap-0.5">
					{#each player.hand as card}
						{@render cardStatic(card, 34, 48)}
					{/each}
				</div>
				<p class="arc-seat-value">{baccaratPoints(player.hand)} แต้ม
					{#if player.handTypeName && player.handType !== 'normal'}
						<span class="text-amber-400 text-[7px] ml-0.5">{player.handTypeName}</span>
					{/if}
				</p>
			{/if}

			<!-- Result badge -->
			{#if player.result && revealDone}
				<div class="mt-1">
					<span class="inline-block rounded-full px-1.5 py-0.5 text-[8px] font-bold {resultBg(player.result)}">
						{resultLabel(player.result)}
					</span>
				</div>
			{/if}

			<!-- Bet & payout -->
			<p class="arc-seat-bet">
				&#3647;{player.bet}
				{#if player.payout !== undefined && player.result && revealDone}
					<span class="{player.payout > player.bet ? 'text-emerald-400' : player.payout < player.bet ? 'text-red-400' : 'text-white/40'}">
						({player.payout > player.bet ? '+' : ''}{player.payout - player.bet})
					</span>
				{/if}
			</p>
		</div>
	</div>
{/snippet}

<svelte:head>
	<title>ห้อง {code} - BUNG TAE DUBAI</title>
</svelte:head>

<!-- Close room confirmation -->
{#if showCloseConfirm}
	<div class="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
		<div class="room-modal w-full max-w-xs p-5 text-center">
			<p class="mb-1 text-sm font-bold text-slot-text">ออกจากห้อง?</p>
			<p class="mb-4 text-[11px] text-slot-muted">คุณจะออกจากห้องนี้</p>
			<div class="flex gap-2">
				<button onclick={() => (showCloseConfirm = false)} class="flex-1 cursor-pointer rounded-xl border border-slot-border px-4 py-2 text-xs font-medium text-slot-muted transition hover:bg-slot-bg">ยกเลิก</button>
				<button onclick={() => { showCloseConfirm = false; leaveRoom(); }} class="flex-1 cursor-pointer rounded-xl bg-red-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-400">ยืนยัน</button>
			</div>
		</div>
	</div>
{/if}

{#if loading}
	<div class="flex min-h-[40vh] items-center justify-center">
		<div class="text-center space-y-3">
			<div class="loading-spinner mx-auto"></div>
			<p class="text-sm text-slot-muted">กำลังโหลดห้อง...</p>
		</div>
	</div>
{:else if !room}
	<div class="mx-auto max-w-md space-y-4 text-center">
		<p class="text-lg font-bold text-red-400">{error || 'ไม่พบห้อง'}</p>
		<button onclick={() => goto('/room')} class="cursor-pointer rounded-xl bg-slot-accent px-6 py-2.5 text-sm font-bold text-white transition hover:brightness-110">
			กลับหน้าห้อง
		</button>
	</div>
{:else}
	<div class="mx-auto max-w-2xl space-y-3">
		<!-- Header bar -->
		<div class="room-header">
			<div class="flex items-center gap-3">
				<button onclick={copyCode} class="room-code-btn" title="คัดลอกรหัส">
					{copied ? '✓ คัดลอกแล้ว' : code}
				</button>
				<div>
					<span class="text-sm font-bold text-slot-text">{room.gameName}</span>
					<div class="flex items-center gap-1.5 text-[10px] text-slot-muted">
						<span class="flex items-center gap-1"><span class="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span> {room.players.length} คน</span>
						<span class="opacity-40">|</span>
						<span>R{room.round}</span>
						<span class="opacity-40">|</span>
						{#if isBotDealer}
							<span class="text-cyan-500">BOT</span>
						{:else}
							<span class="text-amber-500">{room.players.find((p: any) => p.userId === room.hostId)?.username ?? ''}</span>
						{/if}
					</div>
				</div>
			</div>
			<div class="flex items-center gap-2">
				{#if isHost}
					<span class="room-badge room-badge-host">เจ้ามือ</span>
				{/if}
				<span class="room-badge
					{room.phase === 'waiting' ? 'room-badge-wait' : ''}
					{room.phase === 'betting' ? 'room-badge-bet' : ''}
					{room.phase === 'playing' || room.phase === 'dealing' ? 'room-badge-play' : ''}
					{room.phase === 'result' ? 'room-badge-result' : ''}">
					{phaseLabel(room.phase)}
				</span>
			</div>
		</div>

		<!-- Player list (betting phase) -->
		{#if room.phase === 'betting'}
			<div class="flex items-center gap-1.5 px-1 overflow-x-auto">
				{#each room.players as player, i}
					{@const pColor = playerColor(i)}
					<div class="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium whitespace-nowrap
						{player.ready ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20' : 'bg-slot-bg text-slot-muted'}">
						<span class="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7px] font-black text-white" style="background:{pColor}">{player.username.charAt(0)}</span>
						{player.username}
						{#if player.ready}<span class="text-emerald-400">&#10003;</span>{/if}
					</div>
				{/each}
			</div>
		{/if}

		<!-- Error -->
		{#if error}
			<div class="room-error">{error}</div>
		{/if}

		<!-- Game Table -->
		{#if room.phase !== 'waiting'}
			<div class="casino-table {useArcLayout ? 'casino-table-arc' : ''}">
				<div class="casino-felt {room?.game === 'roulette' ? 'casino-felt-roulette' : ''}">
					<div class="casino-felt-inner-border"></div>
					<div class="casino-felt-shine"></div>

					<!-- Dealer info & claim/release -->
					{#if !isBotDealer}
						<div class="mb-2 text-center">
							<span class="inline-flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1 text-[10px] text-amber-300/80">
								<span class="font-bold">{room.players.find((p: any) => p.userId === room.hostId)?.username ?? ''}</span>
								<span class="text-white/30">|</span>
								<span class={hostCredit < 0 ? 'text-red-400' : ''}>&#3647;{shortNum(hostCredit)}</span>
							</span>
						</div>
					{/if}
					{#if canClaimHost && room.phase === 'betting'}
						{#if wallet.credit < 0}
							<div class="mb-2 text-center text-[9px] text-red-400">เงินติดลบ ไม่สามารถเป็นเจ้ามือได้</div>
						{:else}
							<div class="mb-2 text-center">
								<button onclick={claimHostRole} disabled={actionLoading}
									class="claim-host-btn">
									ขอเป็นเจ้ามือ
								</button>
							</div>
						{/if}
					{/if}
					{#if canReleaseHost}
						<div class="mb-2 text-center">
							<button onclick={releaseHostRole} disabled={actionLoading}
								class="cursor-pointer rounded-full border border-slot-border bg-slot-surface px-3 py-1 text-[9px] text-slot-muted transition hover:text-slot-text hover:bg-slot-surface/80 active:scale-[0.97] disabled:opacity-40">
								ปล่อยให้บอทเป็นเจ้ามือ
							</button>
						</div>
					{/if}

					<!-- ========== BLACKJACK ========== -->
					{#if room.game === 'blackjack' && room.gameState}
						{#if revealStep === 0 && deckPhase !== 'idle'}
							{@render deckShuffleOverlay()}
						{:else}
						<div class="text-center pb-3 sm:pb-4 {revealStep >= 1 || room.phase === 'playing' ? 'animate-card-reveal' : ''}">
							<p class="dealer-label mb-2">
								{isBotDealer ? 'BOT DEALER' : 'DEALER'}
								{room.gameState.dealerRevealed ? ` — ${calcHandValue(room.gameState.dealerHand)}` : ''}
							</p>
							<div class="flex justify-center gap-2 sm:gap-3">
								{#each room.gameState.dealerHand as card}
									{#if card}
										{@render cardEl(card, useArcLayout ? 48 : 56, useArcLayout ? 68 : 80)}
									{:else}
										<div class="card-wrapper {dealClass} {lastDealerHeartbeat ? 'animate-heartbeat' : ''} {glowingDealerBack ? 'animate-glow' : ''}"
											style="width:{useArcLayout ? 48 : 56}px;height:{useArcLayout ? 68 : 80}px;--deal-x:50px;--deal-y:-30px{glowingDealerBack ? ';--glow-color:#eab308' : ''}">
											{@html renderCardBack(useArcLayout ? 48 : 56, useArcLayout ? 68 : 80)}
										</div>
									{/if}
								{/each}
							</div>
						</div>

						<div class="table-divider"></div>

						{#if revealStep >= 2 || room.phase === 'playing'}
						{#if useArcLayout}
							<div class="flex justify-around items-start pt-3 px-1 sm:px-3 gap-1 animate-card-reveal">
								{#each otherPlayers as player, i}
									{#if player.hand}
										{@render playerSeat(player, i, otherPlayers.length, 'blackjack')}
									{/if}
								{/each}
							</div>
						{:else}
							<div class="space-y-2.5 pt-3 animate-card-reveal">
								{#each otherPlayers as player, idx}
									{#if player.hand}
										{@const pColor = playerColor(room?.players?.indexOf(player) ?? idx)}
										<div class="player-card-row {revealDone && player.result === 'win' ? 'player-card-win' : revealDone && player.result === 'lose' ? 'player-card-lose' : ''}">
											<div class="mb-2 flex items-center justify-between">
												<div class="flex items-center gap-1.5">
													<span class="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black text-white" style="background:{pColor}">{player.username.charAt(0)}</span>
													<span class="text-xs font-bold text-white/80">{player.username}</span>
													<span class="text-[10px] text-white/30">&#3647;{player.bet}</span>
												</div>
												<div class="flex items-center gap-1.5">
													<span class="text-xs font-bold text-white/90">{calcHandValue(player.hand.filter((c: any) => c))}</span>
													{#if player.stood && !player.result}<span class="text-[9px] text-white/30">หยุด</span>{/if}
													{#if player.result && revealDone}
														<span class="rounded-full px-2 py-0.5 text-[10px] font-bold {resultBg(player.result)}">{resultLabel(player.result)}</span>
													{/if}
												</div>
											</div>
											<div class="flex gap-1.5">
												{#each player.hand as card}
													{@render cardStatic(card, 48, 68)}
												{/each}
											</div>
										</div>
									{/if}
								{/each}
							</div>
						{/if}
						{/if}
						{/if}

					<!-- ========== BACCARAT ========== -->
					{:else if room.game === 'baccarat' && room.gameState}
						{#if revealStep === 0}
							{@render deckShuffleOverlay()}
						{:else}
							<div class="grid grid-cols-2 gap-4 pb-3">
								<!-- PLAYER side -->
								<div class="text-center">
									<p class="dealer-label mb-2 !text-blue-300">PLAYER</p>
									<div class="flex justify-center gap-2">
										{#each room.gameState.playerHand as card, ci}
											{#if revealStep >= 2}
												<div class="card-wrapper animate-card-flip" style="width:52px;height:74px;animation-delay:{ci * 0.15}s">
													{@html renderCard(card.suit, card.display, 52, 74)}
												</div>
											{:else if revealStep >= 1 + ci * 0.2}
												<div class="card-wrapper animate-deal" style="width:52px;height:74px;--deal-x:50px;--deal-y:-30px">
													{@html renderCardBack(52, 74)}
												</div>
											{/if}
										{/each}
									</div>
									{#if revealStep >= 2}
										<p class="mt-2 text-2xl font-black text-white">{baccaratPoints(room.gameState.playerHand)}</p>
									{:else}
										<p class="mt-2 text-2xl font-black text-white/20">?</p>
									{/if}
								</div>
								<!-- BANKER side -->
								<div class="text-center">
									<p class="dealer-label mb-2 !text-red-300">BANKER</p>
									<div class="flex justify-center gap-2">
										{#each room.gameState.bankerHand as card, ci}
											{#if revealStep >= 4}
												<div class="card-wrapper animate-card-flip" style="width:52px;height:74px;animation-delay:{ci * 0.15}s">
													{@html renderCard(card.suit, card.display, 52, 74)}
												</div>
											{:else if revealStep >= 1.1 + ci * 0.2}
												<div class="card-wrapper animate-deal {ci === room.gameState.bankerHand.length - 1 && lastDealerHeartbeat ? 'animate-heartbeat' : ''} {ci === room.gameState.bankerHand.length - 1 && glowingDealerBack ? 'animate-glow' : ''}"
													style="width:52px;height:74px;--deal-x:-50px;--deal-y:-30px{ci === room.gameState.bankerHand.length - 1 && glowingDealerBack ? ';--glow-color:#eab308' : ''}">
													{@html renderCardBack(52, 74)}
												</div>
											{/if}
										{/each}
									</div>
									{#if revealStep >= 4}
										<p class="mt-2 text-2xl font-black text-white">{baccaratPoints(room.gameState.bankerHand)}</p>
									{:else}
										<p class="mt-2 text-2xl font-black text-white/20">?</p>
									{/if}
								</div>
							</div>
							<!-- Who bet what -->
							{#if revealStep >= 1}
								<div class="bets-bar">
									{#each otherPlayers as player}
										{@const choiceLabel = player.betChoice === 'player' ? 'Player' : player.betChoice === 'banker' ? 'Banker' : 'Tie'}
										{@const choiceColor = player.betChoice === 'player' ? '!text-blue-300' : player.betChoice === 'banker' ? '!text-red-300' : '!text-amber-300'}
										<span class="bets-bar-item">
											<span class="text-white/50">{player.username}</span>
											<span class="font-bold {choiceColor}">{choiceLabel}</span>
											<span class="text-white/25">&#3647;{player.bet}</span>
										</span>
									{/each}
								</div>
							{/if}
							{#if room.phase === 'result' && revealDone}
								<p class="result-announce
									{room.gameState.result === 'player' ? '!text-blue-300' : room.gameState.result === 'banker' ? '!text-red-300' : '!text-amber-300'}">
									{room.gameState.result === 'player' ? 'Player ชนะ!' : room.gameState.result === 'banker' ? 'Banker ชนะ!' : 'เสมอ (Tie)'}
								</p>
							{/if}
						{/if}
						{#if useArcLayout && room.phase === 'result' && revealDone}
							<div class="table-divider"></div>
							<div class="flex justify-around pt-3 px-2">
								{#each otherPlayers as player, i}
									<div class="arc-seat" style="margin-top: {seatOffset(i, otherPlayers.length)}px">
										<div class="arc-seat-inner {player.userId === currentUser.value?.id ? 'arc-seat-me' : ''} {player.result === 'win' ? 'arc-seat-win' : player.result === 'lose' ? 'arc-seat-lose' : ''}">
											<p class="arc-seat-name">{player.username}</p>
											<p class="arc-seat-bet">
												{player.betChoice === 'player' ? 'P' : player.betChoice === 'banker' ? 'B' : 'T'} &#3647;{player.bet}
											</p>
											{#if player.result}
												<span class="inline-block mt-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold {resultBg(player.result)}">
													{resultLabel(player.result)} {player.payout !== undefined ? (player.payout > player.bet ? '+' : '') + (player.payout - player.bet) : ''}
												</span>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						{/if}

					<!-- ========== DRAGON TIGER ========== -->
					{:else if room.game === 'dragontiger' && room.gameState}
						{#if revealStep === 0}
							{@render deckShuffleOverlay()}
						{:else}
							<div class="flex items-center justify-center gap-6 sm:gap-10 pb-3">
								<!-- DRAGON -->
								<div class="text-center">
									<p class="dealer-label mb-2 !text-blue-300">DRAGON</p>
									{#if revealStep >= 2}
										<div class="card-wrapper animate-card-flip" style="width:72px;height:102px">
											{@html renderCard(room.gameState.dragon.suit, room.gameState.dragon.display, 72, 102)}
										</div>
									{:else}
										<div class="card-wrapper animate-deal" style="width:72px;height:102px;--deal-x:60px;--deal-y:-30px">
											{@html renderCardBack(72, 102)}
										</div>
									{/if}
								</div>
								<span class="vs-text">VS</span>
								<!-- TIGER -->
								<div class="text-center">
									<p class="dealer-label mb-2 !text-red-300">TIGER</p>
									{#if revealStep >= 4}
										<div class="card-wrapper animate-card-flip" style="width:72px;height:102px">
											{@html renderCard(room.gameState.tiger.suit, room.gameState.tiger.display, 72, 102)}
										</div>
									{:else if revealStep >= 1.1}
										<div class="card-wrapper animate-deal {lastDealerHeartbeat ? 'animate-heartbeat' : ''} {glowingDealerBack ? 'animate-glow' : ''}"
											style="width:72px;height:102px;--deal-x:-60px;--deal-y:-30px{glowingDealerBack ? ';--glow-color:#eab308' : ''}">
											{@html renderCardBack(72, 102)}
										</div>
									{/if}
								</div>
							</div>
							<!-- Who bet what -->
							{#if revealStep >= 1}
								<div class="bets-bar">
									{#each otherPlayers as player}
										{@const choiceLabel = player.betChoice === 'dragon' ? 'Dragon' : player.betChoice === 'tiger' ? 'Tiger' : 'Tie'}
										{@const choiceColor = player.betChoice === 'dragon' ? '!text-blue-300' : player.betChoice === 'tiger' ? '!text-red-300' : '!text-amber-300'}
										<span class="bets-bar-item">
											<span class="text-white/50">{player.username}</span>
											<span class="font-bold {choiceColor}">{choiceLabel}</span>
											<span class="text-white/25">&#3647;{player.bet}</span>
										</span>
									{/each}
								</div>
							{/if}
							{#if room.phase === 'result' && revealDone}
								<p class="result-announce
									{room.gameState.result === 'dragon' ? '!text-blue-300' : room.gameState.result === 'tiger' ? '!text-red-300' : '!text-amber-300'}">
									{room.gameState.result === 'dragon' ? 'Dragon ชนะ!' : room.gameState.result === 'tiger' ? 'Tiger ชนะ!' : 'เสมอ (Tie)'}
								</p>
							{/if}
						{/if}
						{#if useArcLayout && room.phase === 'result' && revealDone}
							<div class="table-divider"></div>
							<div class="flex justify-around pt-3 px-2">
								{#each otherPlayers as player, i}
									<div class="arc-seat" style="margin-top: {seatOffset(i, otherPlayers.length)}px">
										<div class="arc-seat-inner {player.userId === currentUser.value?.id ? 'arc-seat-me' : ''} {player.result === 'win' ? 'arc-seat-win' : player.result === 'lose' ? 'arc-seat-lose' : ''}">
											<p class="arc-seat-name">{player.username}</p>
											<p class="arc-seat-bet">
												{player.betChoice === 'dragon' ? 'D' : player.betChoice === 'tiger' ? 'T' : '='} &#3647;{player.bet}
											</p>
											{#if player.result}
												<span class="inline-block mt-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold {resultBg(player.result)}">
													{resultLabel(player.result)} {player.payout !== undefined ? (player.payout > player.bet ? '+' : '') + (player.payout - player.bet) : ''}
												</span>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						{/if}

					<!-- ========== HI-LO ========== -->
					{:else if room.game === 'hilo' && room.gameState}
						{#if revealStep === 0}
							{@render deckShuffleOverlay()}
						{:else}
							<div class="flex items-center justify-center gap-5 sm:gap-10 pb-3">
								<!-- BASE card -->
								<div class="text-center">
									<p class="dealer-label mb-2">BASE</p>
									{#if revealStep >= 2}
										<div class="card-wrapper animate-card-flip" style="width:72px;height:102px">
											{@html renderCard(room.gameState.baseCard.suit, room.gameState.baseCard.display, 72, 102)}
										</div>
									{:else}
										<div class="card-wrapper animate-deal" style="width:72px;height:102px;--deal-x:60px;--deal-y:-30px">
											{@html renderCardBack(72, 102)}
										</div>
									{/if}
								</div>
								<div class="flex flex-col items-center gap-1">
									<span class="text-3xl text-white/15">&#10132;</span>
								</div>
								<!-- DRAW card -->
								<div class="text-center">
									<p class="dealer-label mb-2">DRAW</p>
									{#if revealStep >= 4}
										<div class="card-wrapper animate-card-flip" style="width:72px;height:102px">
											{@html renderCard(room.gameState.nextCard.suit, room.gameState.nextCard.display, 72, 102)}
										</div>
									{:else if revealStep >= 1.1}
										<div class="card-wrapper animate-deal {lastDealerHeartbeat ? 'animate-heartbeat' : ''} {glowingDealerBack ? 'animate-glow' : ''}"
											style="width:72px;height:102px;--deal-x:-60px;--deal-y:-30px{glowingDealerBack ? ';--glow-color:#eab308' : ''}">
											{@html renderCardBack(72, 102)}
										</div>
									{/if}
								</div>
							</div>
							<!-- Who bet what -->
							{#if revealStep >= 1}
								<div class="bets-bar">
									{#each otherPlayers as player}
										{@const choiceLabel = player.betChoice === 'high' ? 'High' : 'Low'}
										{@const choiceColor = player.betChoice === 'high' ? '!text-emerald-300' : '!text-rose-300'}
										<span class="bets-bar-item">
											<span class="text-white/50">{player.username}</span>
											<span class="font-bold {choiceColor}">{choiceLabel}</span>
											<span class="text-white/25">&#3647;{player.bet}</span>
										</span>
									{/each}
								</div>
							{/if}
							{#if room.phase === 'result' && revealDone}
								<p class="result-announce">
									{room.gameState.nextCard.rank > room.gameState.baseCard.rank ? 'สูง (High)' : room.gameState.nextCard.rank < room.gameState.baseCard.rank ? 'ต่ำ (Low)' : 'เท่ากัน (Tie)'}
								</p>
							{/if}
						{/if}
						{#if useArcLayout && room.phase === 'result' && revealDone}
							<div class="table-divider"></div>
							<div class="flex justify-around pt-3 px-2">
								{#each otherPlayers as player, i}
									<div class="arc-seat" style="margin-top: {seatOffset(i, otherPlayers.length)}px">
										<div class="arc-seat-inner {player.userId === currentUser.value?.id ? 'arc-seat-me' : ''} {player.result === 'win' ? 'arc-seat-win' : player.result === 'lose' ? 'arc-seat-lose' : ''}">
											<p class="arc-seat-name">{player.username}</p>
											<p class="arc-seat-bet">
												{player.betChoice === 'high' ? 'HI' : 'LO'} &#3647;{player.bet}
											</p>
											{#if player.result}
												<span class="inline-block mt-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold {resultBg(player.result)}">
													{resultLabel(player.result)} {player.payout !== undefined ? (player.payout > player.bet ? '+' : '') + (player.payout - player.bet) : ''}
												</span>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						{/if}

					<!-- ========== POKDENG ========== -->
					{:else if room.game === 'pokdeng' && room.gameState}
						{#if revealStep === 0}
							{@render deckShuffleOverlay()}
						{:else}
						<!-- Dealer hand -->
						<div class="text-center pb-3 sm:pb-4">
							<p class="dealer-label mb-2">
								{isBotDealer ? 'BOT DEALER' : 'DEALER'}
								{#if revealStep >= 5}
									— {baccaratPoints(room.gameState.dealerHand)} แต้ม
									{#if baccaratPoints(room.gameState.dealerHand) >= 8}
										<span class="!text-amber-400 font-black">ป็อก!</span>
									{/if}
								{/if}
							</p>
							<div class="flex justify-center gap-2">
								{#each room.gameState.dealerHand as card, ci}
									{#if revealStep >= 4 + ci}
										<div class="card-wrapper animate-card-flip" style="width:{useArcLayout ? 48 : 56}px;height:{useArcLayout ? 68 : 80}px">
											{@html renderCard(card.suit, card.display, useArcLayout ? 48 : 56, useArcLayout ? 68 : 80)}
										</div>
									{:else if revealStep >= 1.1 + ci * 0.2}
										<div class="card-wrapper animate-deal
											{ci === room.gameState.dealerHand.length - 1 && lastDealerHeartbeat ? ' animate-heartbeat' : ''}
											{ci === room.gameState.dealerHand.length - 1 && glowingDealerBack ? ' animate-glow' : ''}"
											style="width:{useArcLayout ? 48 : 56}px;height:{useArcLayout ? 68 : 80}px;--deal-x:50px;--deal-y:-30px{ci === room.gameState.dealerHand.length - 1 && glowingDealerBack ? ';--glow-color:#eab308' : ''}">
											{@html renderCardBack(useArcLayout ? 48 : 56, useArcLayout ? 68 : 80)}
										</div>
									{/if}
								{/each}
							</div>
						</div>

						<div class="table-divider"></div>

						<!-- Player hands -->
						{#if revealStep >= 1}
						{#if useArcLayout}
							<div class="flex justify-around items-start pt-3 px-1 sm:px-3 gap-1">
								{#each otherPlayers as player, i}
									{#if player.hand}
										{@const pColor = playerColor(room?.players?.indexOf(player) ?? i)}
										<div class="arc-seat" style="margin-top: {seatOffset(i, otherPlayers.length)}px">
											<div class="arc-seat-inner {player.userId === currentUser.value?.id ? 'arc-seat-me' : ''} {revealDone && player.result === 'win' ? 'arc-seat-win' : revealDone && player.result === 'lose' ? 'arc-seat-lose' : ''}">
												<div class="flex items-center justify-center gap-1 mb-1">
													<span class="inline-flex h-4 w-4 items-center justify-center rounded-full text-[7px] font-black text-white" style="background:{pColor}">{player.username.charAt(0)}</span>
													<span class="arc-seat-name">{player.username}</span>
												</div>
												<div class="flex justify-center gap-0.5">
													{#each player.hand as card, ci}
														{#if revealStep >= 2}
															<div class="card-wrapper animate-card-flip" style="width:34px;height:48px;animation-delay:{(i * 2 + ci) * 0.08}s">
																{@html renderCard(card.suit, card.display, 34, 48)}
															</div>
														{:else if revealStep >= 1 + ci * 0.2}
															<div class="card-wrapper animate-deal" style="width:34px;height:48px;--deal-x:25px;--deal-y:-20px;animation-delay:{i * 0.1}s">
																{@html renderCardBack(34, 48)}
															</div>
														{/if}
													{/each}
												</div>
												{#if revealStep >= 2}
													<p class="arc-seat-value">{baccaratPoints(player.hand)} แต้ม
														{#if baccaratPoints(player.hand) >= 8}<span class="!text-amber-400 text-[8px] ml-0.5">ป็อก!</span>{/if}
													</p>
												{:else}
													<p class="arc-seat-value text-white/30">??</p>
												{/if}
												{#if player.result && revealDone}
													<div class="mt-1">
														<span class="inline-block rounded-full px-1.5 py-0.5 text-[8px] font-bold {resultBg(player.result)}">
															{resultLabel(player.result)}
														</span>
													</div>
												{/if}
												<p class="arc-seat-bet">
													&#3647;{player.bet}
													{#if player.payout !== undefined && player.result && revealDone}
														<span class="{player.payout > player.bet ? 'text-emerald-400' : player.payout < player.bet ? 'text-red-400' : 'text-white/40'}">
															({player.payout > player.bet ? '+' : ''}{player.payout - player.bet})
														</span>
													{/if}
												</p>
											</div>
										</div>
									{/if}
								{/each}
							</div>
						{:else}
							<div class="space-y-2 pt-3">
								{#each otherPlayers as player, idx}
									{#if player.hand}
										{@const pColor = playerColor(room?.players?.indexOf(player) ?? idx)}
										<div class="player-card-row {revealDone && player.result === 'win' ? 'player-card-win' : revealDone && player.result === 'lose' ? 'player-card-lose' : ''}">
											<div class="mb-1.5 flex items-center justify-between">
												<div class="flex items-center gap-1.5">
													<span class="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black text-white" style="background:{pColor}">{player.username.charAt(0)}</span>
													<span class="text-xs font-bold text-white/80">{player.username}</span>
													<span class="text-[10px] text-white/30">&#3647;{player.bet}</span>
												</div>
												<div class="flex items-center gap-1.5">
													{#if revealStep >= 2}
														<span class="text-xs text-white/60">{baccaratPoints(player.hand)} แต้ม
															{#if baccaratPoints(player.hand) >= 8}<span class="!text-amber-400 font-black">ป็อก!</span>{/if}
														</span>
													{:else}
														<span class="text-xs text-white/30">??</span>
													{/if}
													{#if player.result && revealDone}
														<span class="rounded-full px-2 py-0.5 text-[10px] font-bold {resultBg(player.result)}">{resultLabel(player.result)}</span>
													{/if}
												</div>
											</div>
											<div class="flex gap-1.5">
												{#each player.hand as card, ci}
													{#if revealStep >= 2}
														<div class="card-wrapper animate-card-flip" style="width:48px;height:68px;animation-delay:{ci * 0.15}s">
															{@html renderCard(card.suit, card.display, 48, 68)}
														</div>
													{:else if revealStep >= 1 + ci * 0.2}
														<div class="card-wrapper animate-deal" style="width:48px;height:68px;--deal-x:40px;--deal-y:-25px">
															{@html renderCardBack(48, 68)}
														</div>
													{/if}
												{/each}
											</div>
										</div>
									{/if}
								{/each}
							</div>
						{/if}
						{/if}
						{/if}
					<!-- ========== GAO GAE ========== -->
					{:else if room.game === 'gaogae' && room.gameState}
						{#if revealStep === 0}
							{@render deckShuffleOverlay()}
						{:else}
						<!-- Dealer hand -->
						<div class="text-center pb-3 sm:pb-4">
							<p class="dealer-label mb-2">
								{isBotDealer ? 'BOT DEALER' : 'DEALER'}
								{#if revealStep >= 5}
									— {room.gameState.dealerPoints} แต้ม
									{#if room.gameState.dealerType !== 'normal'}
										<span class="!text-amber-400 font-black">{room.gameState.dealerTypeName}</span>
									{/if}
								{/if}
							</p>
							<div class="flex justify-center gap-2">
								{#each room.gameState.dealerHand as card, ci}
									{#if revealStep >= 4 + ci}
										<div class="card-wrapper animate-card-flip" style="width:{useArcLayout ? 48 : 56}px;height:{useArcLayout ? 68 : 80}px">
											{@html renderCard(card.suit, card.display, useArcLayout ? 48 : 56, useArcLayout ? 68 : 80)}
										</div>
									{:else if revealStep >= 1.1 + ci * 0.2}
										<div class="card-wrapper animate-deal
											{ci === room.gameState.dealerHand.length - 1 && lastDealerHeartbeat ? ' animate-heartbeat' : ''}
											{ci === room.gameState.dealerHand.length - 1 && glowingDealerBack ? ' animate-glow' : ''}"
											style="width:{useArcLayout ? 48 : 56}px;height:{useArcLayout ? 68 : 80}px;--deal-x:50px;--deal-y:-30px{ci === room.gameState.dealerHand.length - 1 && glowingDealerBack ? ';--glow-color:#eab308' : ''}">
											{@html renderCardBack(useArcLayout ? 48 : 56, useArcLayout ? 68 : 80)}
										</div>
									{/if}
								{/each}
							</div>
						</div>

						<div class="table-divider"></div>

						<!-- Player hands -->
						{#if revealStep >= 1}
						{#if useArcLayout}
							<div class="flex justify-around items-start pt-3 px-1 sm:px-3 gap-1">
								{#each otherPlayers as player, i}
									{#if player.hand}
										{@const pColor = playerColor(room?.players?.indexOf(player) ?? i)}
										<div class="arc-seat" style="margin-top: {seatOffset(i, otherPlayers.length)}px">
											<div class="arc-seat-inner {player.userId === currentUser.value?.id ? 'arc-seat-me' : ''} {revealDone && player.result === 'win' ? 'arc-seat-win' : revealDone && player.result === 'lose' ? 'arc-seat-lose' : ''}">
												<div class="flex items-center justify-center gap-1 mb-1">
													<span class="inline-flex h-4 w-4 items-center justify-center rounded-full text-[7px] font-black text-white" style="background:{pColor}">{player.username.charAt(0)}</span>
													<span class="arc-seat-name">{player.username}</span>
												</div>
												<div class="flex justify-center gap-0.5">
													{#each player.hand as card, ci}
														{#if revealStep >= 2}
															<div class="card-wrapper animate-card-flip" style="width:34px;height:48px;animation-delay:{(i * 2 + ci) * 0.08}s">
																{@html renderCard(card.suit, card.display, 34, 48)}
															</div>
														{:else if revealStep >= 1 + ci * 0.2}
															<div class="card-wrapper animate-deal" style="width:34px;height:48px;--deal-x:25px;--deal-y:-20px;animation-delay:{i * 0.1}s">
																{@html renderCardBack(34, 48)}
															</div>
														{/if}
													{/each}
												</div>
												{#if revealStep >= 2}
													<p class="arc-seat-value">{baccaratPoints(player.hand)} แต้ม
														{#if player.handTypeName && player.handType !== 'normal'}
															<span class="!text-amber-400 text-[8px] ml-0.5">{player.handTypeName}</span>
														{/if}
													</p>
												{:else}
													<p class="arc-seat-value text-white/30">??</p>
												{/if}
												{#if player.result && revealDone}
													<div class="mt-1">
														<span class="inline-block rounded-full px-1.5 py-0.5 text-[8px] font-bold {resultBg(player.result)}">
															{resultLabel(player.result)}
														</span>
													</div>
												{/if}
												<p class="arc-seat-bet">
													&#3647;{player.bet}
													{#if player.payout !== undefined && player.result && revealDone}
														<span class="{player.payout > player.bet ? 'text-emerald-400' : player.payout < player.bet ? 'text-red-400' : 'text-white/40'}">
															({player.payout > player.bet ? '+' : ''}{player.payout - player.bet})
														</span>
													{/if}
												</p>
											</div>
										</div>
									{/if}
								{/each}
							</div>
						{:else}
							<div class="space-y-2 pt-3">
								{#each otherPlayers as player, idx}
									{#if player.hand}
										{@const pColor = playerColor(room?.players?.indexOf(player) ?? idx)}
										<div class="player-card-row {revealDone && player.result === 'win' ? 'player-card-win' : revealDone && player.result === 'lose' ? 'player-card-lose' : ''}">
											<div class="mb-1.5 flex items-center justify-between">
												<div class="flex items-center gap-1.5">
													<span class="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black text-white" style="background:{pColor}">{player.username.charAt(0)}</span>
													<span class="text-xs font-bold text-white/80">{player.username}</span>
													<span class="text-[10px] text-white/30">&#3647;{player.bet}</span>
												</div>
												<div class="flex items-center gap-1.5">
													{#if revealStep >= 2}
														<span class="text-xs text-white/60">{baccaratPoints(player.hand)} แต้ม
															{#if player.handTypeName && player.handType !== 'normal'}
																<span class="!text-amber-400 font-black">{player.handTypeName}</span>
															{/if}
														</span>
													{:else}
														<span class="text-xs text-white/30">??</span>
													{/if}
													{#if player.result && revealDone}
														<span class="rounded-full px-2 py-0.5 text-[10px] font-bold {resultBg(player.result)}">{resultLabel(player.result)}</span>
													{/if}
												</div>
											</div>
											<div class="flex gap-1.5">
												{#each player.hand as card, ci}
													{#if revealStep >= 2}
														<div class="card-wrapper animate-card-flip" style="width:48px;height:68px;animation-delay:{ci * 0.15}s">
															{@html renderCard(card.suit, card.display, 48, 68)}
														</div>
													{:else if revealStep >= 1 + ci * 0.2}
														<div class="card-wrapper animate-deal" style="width:48px;height:68px;--deal-x:40px;--deal-y:-25px">
															{@html renderCardBack(48, 68)}
														</div>
													{/if}
												{/each}
											</div>
										</div>
									{/if}
								{/each}
							</div>
						{/if}
						{/if}
						{/if}
					<!-- ========== VIDEO POKER ========== -->
					{:else if room.game === 'videopoker'}
						{#if room.phase === 'playing' || room.phase === 'result'}
							{#if revealStep === 0 && deckPhase !== 'idle'}
								{@render deckShuffleOverlay()}
							{:else}
								<div class="space-y-3 pb-3">
									{#each otherPlayers as player, idx}
										{#if player.hand}
											{@const pColor = playerColor(room?.players?.indexOf(player) ?? idx)}
											{@const isMe = player.userId === currentUser.value?.id}
											<div class="player-card-row {revealDone && player.result === 'win' ? 'player-card-win' : revealDone && player.result === 'lose' ? 'player-card-lose' : ''}">
												<div class="mb-2 flex items-center justify-between">
													<div class="flex items-center gap-1.5">
														<span class="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black text-white" style="background:{pColor}">{player.username.charAt(0)}</span>
														<span class="text-xs font-bold text-white/80">{player.username}</span>
														<span class="text-[10px] text-white/30">&#3647;{player.bet}</span>
													</div>
													<div class="flex items-center gap-1.5">
														{#if player.stood && (player as any).handRank && revealDone}
															<span class="text-[10px] font-bold text-amber-300">{(player as any).handRank}</span>
														{/if}
														{#if player.result && revealDone}
															<span class="rounded-full px-2 py-0.5 text-[10px] font-bold {resultBg(player.result)}">{resultLabel(player.result)}</span>
														{/if}
													</div>
												</div>
												<div class="flex gap-1.5 justify-center">
													{#each player.hand as card, ci}
														{#if card}
															{#if revealStep >= 1 + ci * 0.5}
																<div class="text-center">
																	<div class="card-wrapper animate-deal" style="width:48px;height:68px;--deal-x:50px;--deal-y:-30px">
																		{@html renderCard(card.suit, card.display, 48, 68)}
																	</div>
																	{#if isMe && room.phase === 'playing' && !player.stood}
																		<button onclick={() => { vpHolds[ci] = !vpHolds[ci]; vpHolds = [...vpHolds]; }}
																			class="mt-1 cursor-pointer rounded px-1.5 py-0.5 text-[8px] font-bold transition
																				{vpHolds[ci] ? 'bg-amber-500/30 text-amber-300 ring-1 ring-amber-500/40' : 'bg-white/5 text-white/30 hover:text-white/50'}">
																			{vpHolds[ci] ? 'HOLD' : 'HOLD'}
																		</button>
																	{/if}
																</div>
															{/if}
														{:else}
															<div class="card-wrapper animate-deal" style="width:48px;height:68px;--deal-x:50px;--deal-y:-30px">
																{@html renderCardBack(48, 68)}
															</div>
														{/if}
													{/each}
												</div>
												{#if player.payout !== undefined && player.result && revealDone}
													<p class="mt-1.5 text-center text-[10px] font-bold {player.payout > player.bet ? 'text-emerald-400' : player.payout < player.bet ? 'text-red-400' : 'text-white/40'}">
														{player.payout > player.bet ? '+' : ''}{player.payout - player.bet}
													</p>
												{/if}
											</div>
										{/if}
									{/each}
								</div>
							{/if}
						{/if}

					<!-- ========== ROULETTE ========== -->
					{:else if room.game === 'roulette'}
						<div class="text-center pb-3">
							<!-- Roulette wheel — always visible -->
							<div class="flex flex-col items-center justify-center py-3">
								<RouletteWheel
									resultNumber={rouletteWheelResult}
									spinning={rouletteSpinning}
									size="sm"
									onAnimationComplete={onRouletteAnimComplete}
								/>
							</div>
							{#if room.phase === 'result' && revealDone}
								<!-- Result badge (same as solo play) -->
								{@const rn = room.gameState?.resultNumber ?? 0}
								{@const rColor = rn === 0 ? 'bg-green-600 text-white' : RED_NUMBERS_SET.has(rn) ? 'bg-red-600 text-white' : 'bg-gray-800 text-white'}
								<div class="mb-3 flex items-center justify-center gap-2 rounded-full px-5 py-1.5 shadow animate-pop animate-shake mx-auto w-fit {rColor}">
									<span class="text-xl font-bold">{rn}</span>
									<span class="text-xs">{rn === 0 ? 'เขียว' : RED_NUMBERS_SET.has(rn) ? 'แดง' : 'ดำ'}</span>
								</div>
							{/if}
							{#if room.phase === 'result' || room.phase === 'playing'}
								<!-- Who bet what -->
								<div class="bets-bar">
									{#each otherPlayers as player}
										{@const bc = player.betChoice || ''}
										{@const choiceLabel = bc.startsWith('number:') ? '#' + bc.split(':')[1] : bc === 'red' ? 'แดง' : bc === 'black' ? 'ดำ' : bc === 'odd' ? 'คี่' : bc === 'even' ? 'คู่' : bc === 'high' ? 'สูง' : bc === 'low' ? 'ต่ำ' : bc}
										<span class="bets-bar-item">
											<span class="text-white/50">{player.username}</span>
											<span class="font-bold text-amber-300">{choiceLabel}</span>
											<span class="text-white/25">&#3647;{player.bet}</span>
										</span>
									{/each}
								</div>
							{/if}
						</div>

					{/if}
				</div>
			</div>

			<!-- Results summary -->
			{#if room.phase === 'result' && revealDone}
				<div class="result-panel">
					<div class="mb-2.5 flex items-center justify-between">
						<p class="text-[10px] font-bold uppercase tracking-widest text-slot-muted">ROUND {room.round}</p>
						{#if isBotDealer}
							<p class="text-[10px] text-cyan-500 animate-pulse">รอบใหม่อัตโนมัติ...</p>
						{/if}
					</div>
					{#each otherPlayers as player, i}
						{@const pColor = playerColor(room?.players?.indexOf(player) ?? i)}
						<div class="result-row">
							<div class="flex items-center gap-2">
								<span class="inline-flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-black text-white" style="background:{pColor}">{player.username.charAt(0)}</span>
								<span class="font-medium text-slot-text text-xs">{player.username}</span>
							</div>
							<div class="flex items-center gap-2 text-xs">
								<span class="text-slot-muted">&#3647;{player.bet}</span>
								{#if player.result}
									<span class="font-bold {resultColor(player.result)}">{resultLabel(player.result)}</span>
									{#if player.payout !== undefined}
										<span class="font-bold tabular-nums {player.payout > player.bet ? 'text-emerald-400' : player.payout < player.bet ? 'text-red-400' : 'text-slot-muted'}">
											{player.payout > player.bet ? '+' : ''}{player.payout - player.bet}
										</span>
									{/if}
								{/if}
							</div>
						</div>
					{/each}
					{#if !isBotDealer}
						{@const dealerProfit = otherPlayers.reduce((sum: number, p: any) => sum + (p.bet - (p.payout ?? 0)), 0)}
						<div class="result-row-dealer">
							<div class="flex items-center gap-2">
								<span class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/30 text-[9px] font-black text-amber-300">D</span>
								<span class="font-medium text-amber-500 text-xs">เจ้ามือ</span>
							</div>
							<span class="font-bold tabular-nums text-sm {dealerProfit > 0 ? 'text-emerald-400' : dealerProfit < 0 ? 'text-red-400' : 'text-slot-muted'}">
								{dealerProfit > 0 ? '+' : ''}{dealerProfit}
							</span>
						</div>
					{/if}
				</div>
			{/if}
		{/if}

		<!-- Controls -->
		<div class="space-y-2 mt-16">
			{#if isHost}
				{#if room.phase === 'waiting' || room.phase === 'result'}
					<button onclick={startRound} disabled={actionLoading || otherPlayers.length === 0}
						class="action-btn action-btn-primary">
						{room.phase === 'waiting' ? 'เริ่มรอบแรก' : 'เริ่มรอบใหม่'}
					</button>
				{/if}
				{#if room.phase === 'betting'}
					<button onclick={deal} disabled={actionLoading || !allPlayersReady}
						class="action-btn action-btn-deal">
						{allPlayersReady ? (room.game === 'roulette' ? 'หมุนวงล้อ' : 'แจกไพ่') : 'รอผู้เล่นวางเดิมพัน...'}
					</button>
				{/if}
				{#if room.phase === 'playing' && room.game === 'blackjack'}
					<button onclick={revealDealer} disabled={actionLoading}
						class="action-btn action-btn-primary">
						{bjAllStood ? 'เปิดไพ่เจ้ามือ' : 'รอผู้เล่น... (หรือบังคับเปิด)'}
					</button>
				{/if}
			{/if}

			{#if isPlayer}
				{#if room.phase === 'betting' && !myPlayer?.ready}
					<div class="bet-panel">
						{#if countdown > 0 && countdownActive}
							{#key countdownKey}
							<div class="flex items-center justify-center">
								<div class="countdown-wrapper">
									<svg class="countdown-svg" viewBox="0 0 44 44">
										<circle cx="22" cy="22" r="19" class="countdown-track" />
										<circle cx="22" cy="22" r="19" class="countdown-fill {countdown <= 5 ? 'countdown-urgent' : ''}" style="--duration: {COUNTDOWN_SEC}s" />
									</svg>
									<span class="countdown-num {countdown <= 5 ? 'countdown-num-urgent' : ''}">{countdown}</span>
								</div>
							</div>
							{/key}
						{/if}
						{#if room.game === 'baccarat'}
							<p class="bet-section-label">เลือกฝั่ง</p>
							<div class="grid grid-cols-3 gap-2">
								<button onclick={() => (betChoice = 'player')} class="choice-btn {betChoice === 'player' ? 'choice-btn-active-blue' : ''}">Player<br/><span class="text-[9px] opacity-50">x2</span></button>
								<button onclick={() => (betChoice = 'banker')} class="choice-btn {betChoice === 'banker' ? 'choice-btn-active-red' : ''}">Banker<br/><span class="text-[9px] opacity-50">x1.95</span></button>
								<button onclick={() => (betChoice = 'tie')} class="choice-btn {betChoice === 'tie' ? 'choice-btn-active-amber' : ''}">Tie<br/><span class="text-[9px] opacity-50">x8</span></button>
							</div>
						{:else if room.game === 'dragontiger'}
							<p class="bet-section-label">เลือกฝั่ง</p>
							<div class="grid grid-cols-3 gap-2">
								<button onclick={() => (betChoice = 'dragon')} class="choice-btn {betChoice === 'dragon' ? 'choice-btn-active-blue' : ''}">Dragon<br/><span class="text-[9px] opacity-50">x2</span></button>
								<button onclick={() => (betChoice = 'tie')} class="choice-btn {betChoice === 'tie' ? 'choice-btn-active-amber' : ''}">Tie<br/><span class="text-[9px] opacity-50">x8</span></button>
								<button onclick={() => (betChoice = 'tiger')} class="choice-btn {betChoice === 'tiger' ? 'choice-btn-active-red' : ''}">Tiger<br/><span class="text-[9px] opacity-50">x2</span></button>
							</div>
						{:else if room.game === 'hilo'}
							<div class="grid grid-cols-2 gap-2">
								<button onclick={() => (betChoice = 'high')} class="choice-btn {betChoice === 'high' ? 'choice-btn-active-blue' : ''}">สูง (High)</button>
								<button onclick={() => (betChoice = 'low')} class="choice-btn {betChoice === 'low' ? 'choice-btn-active-red' : ''}">ต่ำ (Low)</button>
							</div>
						{:else if room.game === 'roulette'}
							<p class="bet-section-label">เลือกประเภท</p>
							<div class="grid grid-cols-3 gap-2">
								<button onclick={() => (betChoice = 'red')} class="choice-btn {betChoice === 'red' ? 'choice-btn-active-red' : ''}">แดง<br/><span class="text-[9px] opacity-50">x2</span></button>
								<button onclick={() => (betChoice = 'black')} class="choice-btn {betChoice === 'black' ? 'choice-btn-active-blue' : ''}">ดำ<br/><span class="text-[9px] opacity-50">x2</span></button>
								<button onclick={() => (betChoice = 'odd')} class="choice-btn {betChoice === 'odd' ? 'choice-btn-active-amber' : ''}">คี่<br/><span class="text-[9px] opacity-50">x2</span></button>
								<button onclick={() => (betChoice = 'even')} class="choice-btn {betChoice === 'even' ? 'choice-btn-active-amber' : ''}">คู่<br/><span class="text-[9px] opacity-50">x2</span></button>
								<button onclick={() => (betChoice = 'high')} class="choice-btn {betChoice === 'high' ? 'choice-btn-active-blue' : ''}">สูง<br/><span class="text-[9px] opacity-50">19-36</span></button>
								<button onclick={() => (betChoice = 'low')} class="choice-btn {betChoice === 'low' ? 'choice-btn-active-red' : ''}">ต่ำ<br/><span class="text-[9px] opacity-50">1-18</span></button>
							</div>
							<p class="bet-section-label mt-2">หรือเลือกเลข (x36)</p>
							<div class="grid grid-cols-10 gap-1">
								{#each Array.from({length: 37}, (_, i) => i) as num}
									<button onclick={() => (betChoice = 'number:' + num)}
										class="cursor-pointer rounded px-0 py-1 text-[9px] font-bold transition
											{betChoice === 'number:' + num ? 'ring-2 ring-amber-400 scale-110' : ''}
											{num === 0 ? 'bg-emerald-700 text-white' : RED_NUMBERS_SET.has(num) ? 'bg-red-700 text-white' : 'bg-gray-700 text-white'}
											hover:brightness-125 active:scale-95">
										{num}
									</button>
								{/each}
							</div>
						{/if}

						{#if !isBotDealer}
							<div class="flex items-center justify-center gap-1.5 text-[10px] text-slot-muted">
								<span>เจ้ามือมี</span>
								<span class="font-bold {hostCredit < 0 ? 'text-red-400' : 'text-amber-500'}">&#3647;{shortNum(hostCredit)}</span>
							</div>
							{#if hostCredit < 0}
								<div class="text-center text-[8px] text-red-400/70">ติดลบ</div>
							{/if}
						{/if}

						<!-- Bet amount -->
						<div class="bet-input-row">
							<button onclick={() => { betAmount = Math.max(10, betAmount - 50); }} class="bet-adj-btn">-</button>
							<div class="bet-input-center">
								<span class="text-[7px] uppercase tracking-widest text-slot-muted">BET</span>
								<input type="number" bind:value={betAmount} min="10"
									class="w-full bg-transparent text-center text-base font-black text-slot-text tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
							</div>
							<button onclick={() => { betAmount += 50; }} class="bet-adj-btn">+</button>
						</div>

						<!-- Chip presets -->
						<div class="flex gap-1.5">
							{#each [10, 50, 100, 500] as amt}
								<button onclick={() => (betAmount = amt)}
									class="chip-btn {betAmount === amt ? 'chip-btn-active' : ''}">
									{amt}
								</button>
							{/each}
						</div>

						<button onclick={doBet} disabled={actionLoading || betAmount < 1 || (needsBetChoice && !betChoice)}
							class="action-btn action-btn-bet">
							วางเดิมพัน &#3647;{betAmount}
						</button>
					</div>
				{:else if room.phase === 'betting' && myPlayer?.ready}
					<div class="bet-confirmed">
						{#if countdown > 0 && countdownActive}
							{#key countdownKey}
							<div class="flex items-center justify-center mb-2">
								<div class="countdown-wrapper">
									<svg class="countdown-svg" viewBox="0 0 44 44">
										<circle cx="22" cy="22" r="19" class="countdown-track" />
										<circle cx="22" cy="22" r="19" class="countdown-fill {countdown <= 3 ? 'countdown-urgent' : ''}" style="--duration: {COUNTDOWN_SEC}s" />
									</svg>
									<span class="countdown-num {countdown <= 3 ? 'countdown-num-urgent' : ''}">{countdown}</span>
								</div>
							</div>
							{/key}
							<p>รอผู้เล่นคนอื่น... ({countdown})</p>
						{:else}
							&#10003; วางเดิมพันแล้ว &#3647;{myPlayer.bet} — {isBotDealer ? 'รอผู้เล่นคนอื่น...' : 'รอเจ้ามือแจกไพ่'}
						{/if}
					</div>
				{/if}

				{#if room.phase === 'playing' && room.game === 'blackjack' && myPlayer && !myPlayer.stood}
					<div class="flex w-full gap-2">
						<button onclick={hit} disabled={actionLoading} class="action-btn action-btn-hit flex-1">จั่วไพ่ (Hit)</button>
						<button onclick={stand} disabled={actionLoading} class="action-btn action-btn-stand flex-1">หยุด (Stand)</button>
					</div>
					<p class="text-center text-xs text-slot-muted">แต้มของคุณ: <span class="font-bold text-slot-text">{myBjValue}</span></p>
				{:else if room.phase === 'playing' && room.game === 'blackjack' && myPlayer?.stood}
					<div class="status-msg">
						{myPlayer.result === 'lose' ? 'บัสท์! เกิน 21' : isBotDealer ? 'หยุดแล้ว — รอบอทเปิดไพ่...' : 'หยุดแล้ว — รอเจ้ามือเปิดไพ่...'}
					</div>
				{/if}

				{#if room.phase === 'playing' && room.game === 'videopoker' && myPlayer && !myPlayer.stood}
					<div class="space-y-2">
						<p class="text-center text-xs text-slot-muted">เลือกไพ่ที่ต้องการเก็บ (HOLD) แล้วกดจั่ว</p>
						<button onclick={vpDraw} disabled={actionLoading}
							class="action-btn action-btn-deal">
							จั่วไพ่ (Draw)
						</button>
					</div>
				{:else if room.phase === 'playing' && room.game === 'videopoker' && myPlayer?.stood}
					<div class="status-msg">
						รอผู้เล่นคนอื่น...
					</div>
				{/if}

				{#if room.phase === 'waiting'}
					<div class="status-msg animate-pulse">รอเจ้ามือเริ่มรอบ...</div>
				{/if}
			{/if}

			<div class="flex justify-end pt-1">
				<button onclick={() => (showCloseConfirm = true)}
					class="cursor-pointer rounded-lg px-3 py-1.5 text-[10px] text-slot-muted transition hover:text-red-400 hover:bg-red-500/5">
					ออกจากห้อง
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* ===== Room Header ===== */
	.room-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--color-slot-surface);
		border: 1px solid var(--color-slot-border);
		border-radius: 16px;
		padding: 0.75rem 1rem;
	}

	.room-code-btn {
		cursor: pointer;
		background: var(--color-slot-accent);
		border: none;
		border-radius: 10px;
		padding: 0.4rem 0.75rem;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.2em;
		color: white;
		transition: all 0.15s;
	}
	.room-code-btn:hover {
		filter: brightness(1.15);
		transform: translateY(-1px);
	}

	.room-badge {
		font-size: 10px;
		font-weight: 700;
		padding: 0.2rem 0.6rem;
		border-radius: 9999px;
	}
	.room-badge-host { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
	.room-badge-wait { background: rgba(255, 255, 255, 0.05); color: var(--color-slot-muted); }
	.room-badge-bet { background: color-mix(in srgb, var(--color-slot-accent) 15%, transparent); color: var(--color-slot-accent); animation: badgePulse 2s infinite; }
	.room-badge-play { background: rgba(234, 179, 8, 0.15); color: #fbbf24; }
	.room-badge-result { background: color-mix(in srgb, var(--color-slot-win) 15%, transparent); color: var(--color-slot-win); }

	@keyframes badgePulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.6; }
	}

	/* ===== Casino Table ===== */
	.casino-table {
		position: relative;
	}

	.casino-felt {
		position: relative;
		background:
			radial-gradient(ellipse at 50% 20%, rgba(34, 120, 60, 0.4) 0%, transparent 50%),
			radial-gradient(ellipse at 50% 50%, #1a6b35 0%, #145a2c 30%, #0e4420 60%, #0a3518 100%);
		border-radius: 20px;
		border: 2px solid rgba(184, 150, 15, 0.45);
		box-shadow: 0 0 12px rgba(184, 150, 15, 0.15), inset 0 0 12px rgba(184, 150, 15, 0.06);
		padding: 1.25rem 1rem;
		min-height: 200px;
	}

	.casino-table-arc .casino-felt {
		border-radius: 20px 20px 50% 50% / 20px 20px 30% 30%;
		padding-bottom: 2rem;
		min-height: 260px;
	}

	.casino-felt-roulette {
		background: none;
		border: none;
		box-shadow: none;
	}

	.casino-felt-inner-border {
		display: none;
	}

	.casino-felt-shine {
		display: none;
	}

	.table-divider {
		border-top: 1px dashed rgba(255, 255, 255, 0.08);
		margin: 0 1rem;
	}

	.dealer-label {
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.5);
	}

	.vs-text {
		font-size: 1.5rem;
		font-weight: 900;
		color: rgba(255, 255, 255, 0.08);
	}

	.result-announce {
		text-align: center;
		padding-bottom: 0.5rem;
		font-size: 0.875rem;
		font-weight: 800;
		color: rgba(255, 255, 255, 0.9);
		animation: resultPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	@keyframes resultPop {
		from { opacity: 0; transform: scale(0.8) translateY(5px); }
		to { opacity: 1; transform: scale(1) translateY(0); }
	}

	.claim-host-btn {
		cursor: pointer;
		background: rgba(245, 158, 11, 0.1);
		border: 1px solid rgba(245, 158, 11, 0.3);
		border-radius: 9999px;
		padding: 0.35rem 1rem;
		font-size: 10px;
		font-weight: 700;
		color: #fbbf24;
		transition: all 0.15s;
		touch-action: manipulation;
	}
	.claim-host-btn:hover {
		background: rgba(245, 158, 11, 0.2);
	}
	.claim-host-btn:active {
		transform: scale(0.96);
		background: rgba(245, 158, 11, 0.3);
	}

	/* ===== Cards ===== */
	.card-wrapper {
		border-radius: 3px;
		overflow: hidden;
		transition: transform 0.2s ease;
		position: relative;
		z-index: 1;
		background: white;
	}

	/* ===== Player Card Row (single player) ===== */
	.player-card-row {
		background: rgba(0, 0, 0, 0.25);
		border-radius: 14px;
		border: 1px solid rgba(255, 255, 255, 0.06);
		padding: 0.6rem 0.75rem;
		transition: border-color 0.3s, box-shadow 0.3s;
	}
	.player-card-win {
		border-color: color-mix(in srgb, var(--color-slot-win) 30%, transparent);
	}
	.player-card-lose {
		border-color: color-mix(in srgb, var(--color-slot-lose) 20%, transparent);
	}

	/* ===== Arc Player Seats ===== */
	.arc-seat {
		flex: 0 1 auto;
		min-width: 0;
		transition: margin-top 0.3s ease;
	}

	.arc-seat-inner {
		background: rgba(0, 0, 0, 0.3);
		border-radius: 14px;
		border: 1px solid rgba(255, 255, 255, 0.06);
		padding: 0.4rem 0.35rem;
		text-align: center;
		min-width: 72px;
		max-width: 105px;
		transition: all 0.3s ease;
	}

	.arc-seat-me {
		border-color: color-mix(in srgb, var(--color-slot-accent) 40%, transparent);
	}
	.arc-seat-win {
		border-color: color-mix(in srgb, var(--color-slot-win) 40%, transparent) !important;
	}
	.arc-seat-lose {
		border-color: color-mix(in srgb, var(--color-slot-lose) 30%, transparent) !important;
	}

	.arc-seat-name {
		font-size: 9px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.7);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.arc-seat-value {
		font-size: 10px;
		font-weight: 800;
		color: rgba(255, 255, 255, 0.9);
		margin-top: 3px;
	}
	.arc-seat-bet {
		font-size: 9px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.4);
		margin-top: 2px;
	}

	@media (min-width: 640px) {
		.arc-seat-inner { min-width: 88px; max-width: 125px; padding: 0.5rem; }
		.arc-seat-name { font-size: 10px; }
		.arc-seat-value { font-size: 11px; }
	}

	/* ===== Result Panel ===== */
	.result-panel {
		background: var(--color-slot-surface);
		border: 1px solid var(--color-slot-border);
		border-radius: 16px;
		padding: 0.875rem;
	}
	.result-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--color-slot-border);
	}
	.result-row:last-of-type { border-bottom: none; }

	.result-row-dealer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.6rem 0 0.2rem;
		margin-top: 0.25rem;
		border-top: 1px solid rgba(245, 158, 11, 0.15);
	}

	/* ===== Bet Panel ===== */
	.bet-panel {
		background: var(--color-slot-surface);
		border: 1px solid var(--color-slot-border);
		border-radius: 20px;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.bet-section-label {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-slot-muted);
	}

	.choice-btn {
		cursor: pointer;
		border-radius: 14px;
		border: 2px solid var(--color-slot-border);
		background: var(--color-slot-bg);
		padding: 0.6rem 0.5rem;
		font-size: 12px;
		font-weight: 700;
		color: var(--color-slot-muted);
		transition: all 0.15s;
	}
	.choice-btn:hover { border-color: var(--color-slot-accent); color: var(--color-slot-text); }
	.choice-btn-active-blue { border-color: #3b82f6 !important; background: rgba(59, 130, 246, 0.1) !important; color: #60a5fa !important; }
	.choice-btn-active-red { border-color: #ef4444 !important; background: rgba(239, 68, 68, 0.1) !important; color: #f87171 !important; }
	.choice-btn-active-amber { border-color: #f59e0b !important; background: rgba(245, 158, 11, 0.1) !important; color: #fbbf24 !important; }

	.bet-input-row {
		display: flex;
		align-items: center;
		border-radius: 14px;
		border: 1px solid var(--color-slot-border);
		background: var(--color-slot-bg);
		overflow: hidden;
	}
	.bet-adj-btn {
		cursor: pointer;
		background: none;
		border: none;
		padding: 0.6rem 1rem;
		font-size: 1.1rem;
		font-weight: 800;
		color: var(--color-slot-muted);
		transition: all 0.1s;
	}
	.bet-adj-btn:hover { background: rgba(255, 255, 255, 0.05); color: var(--color-slot-text); }
	.bet-input-center {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		border-left: 1px solid var(--color-slot-border);
		border-right: 1px solid var(--color-slot-border);
		padding: 0 0.25rem;
	}

	.chip-btn {
		flex: 1;
		cursor: pointer;
		border-radius: 10px;
		border: 1px solid var(--color-slot-border);
		background: var(--color-slot-bg);
		padding: 0.4rem 0;
		font-size: 11px;
		font-weight: 700;
		color: var(--color-slot-muted);
		transition: all 0.1s;
	}
	.chip-btn:hover { color: var(--color-slot-text); border-color: var(--color-slot-accent); }
	.chip-btn-active {
		border-color: var(--color-slot-accent) !important;
		background: color-mix(in srgb, var(--color-slot-accent) 10%, transparent) !important;
		color: var(--color-slot-accent) !important;
	}

	.bet-confirmed {
		border-radius: 16px;
		border: 1px solid color-mix(in srgb, var(--color-slot-win) 20%, transparent);
		background: color-mix(in srgb, var(--color-slot-win) 5%, transparent);
		padding: 0.75rem 1rem;
		text-align: center;
		font-size: 12px;
		font-weight: 700;
		color: var(--color-slot-win);
	}

	/* ===== Action Buttons ===== */
	.action-btn {
		width: 100%;
		cursor: pointer;
		border-radius: 14px;
		padding: 0.8rem 1rem;
		font-size: 14px;
		font-weight: 800;
		color: white;
		border: none;
		transition: all 0.15s;
	}
	.action-btn:disabled { opacity: 0.35; cursor: default; }
	.action-btn:not(:disabled):active { transform: scale(0.98); }

	.action-btn-primary {
		background: var(--color-slot-accent);
	}
	.action-btn-primary:not(:disabled):hover { filter: brightness(1.15); }

	.action-btn-deal {
		background: var(--color-slot-win);
	}
	.action-btn-deal:not(:disabled):hover { filter: brightness(1.15); }

	.action-btn-bet {
		background: var(--color-slot-accent);
	}
	.action-btn-bet:not(:disabled):hover { filter: brightness(1.15); }

	.action-btn-hit {
		background: var(--color-slot-accent);
	}
	.action-btn-stand {
		background: transparent;
		border: 2px solid color-mix(in srgb, var(--color-slot-accent) 40%, transparent);
		color: var(--color-slot-accent);
		box-shadow: none;
	}
	.action-btn-stand:not(:disabled):hover { background: color-mix(in srgb, var(--color-slot-accent) 8%, transparent); }

	.status-msg {
		border-radius: 14px;
		border: 1px solid var(--color-slot-border);
		background: var(--color-slot-bg);
		padding: 0.65rem 1rem;
		text-align: center;
		font-size: 12px;
		color: var(--color-slot-muted);
	}

	/* ===== Modal ===== */
	.room-modal {
		background: var(--color-slot-surface);
		border: 1px solid var(--color-slot-border);
		border-radius: 20px;
		box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6);
	}

	.room-error {
		border-radius: 14px;
		background: color-mix(in srgb, var(--color-slot-lose) 8%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-slot-lose) 20%, transparent);
		padding: 0.5rem 0.75rem;
		text-align: center;
		font-size: 12px;
		font-weight: 600;
		color: var(--color-slot-lose);
	}

	/* ===== Loading ===== */
	.loading-spinner {
		width: 32px;
		height: 32px;
		border: 3px solid color-mix(in srgb, var(--color-slot-accent) 15%, transparent);
		border-top-color: var(--color-slot-accent);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* ===== Smooth transitions ===== */
	:global(.casino-table *) {
		transition: opacity 0.2s ease, transform 0.2s ease;
	}
	:global(.casino-table .card-wrapper) {
		transition: opacity 0.3s ease, transform 0.3s ease;
	}

	.arc-seat-inner {
		animation: seatIn 0.35s ease;
	}
	@keyframes seatIn {
		from { opacity: 0; transform: translateY(8px) scale(0.95); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}

	/* Countdown ring (SVG smooth) */
	.countdown-wrapper {
		position: relative;
		width: 44px;
		height: 44px;
	}
	.countdown-svg {
		width: 100%;
		height: 100%;
		transform: rotate(-90deg);
	}
	.countdown-track {
		fill: none;
		stroke: var(--color-slot-border);
		stroke-width: 3;
	}
	.countdown-fill {
		fill: none;
		stroke: var(--color-slot-accent);
		stroke-width: 3;
		stroke-linecap: round;
		stroke-dasharray: 119.38;
		stroke-dashoffset: 0;
		animation: countdownDrain var(--duration) linear forwards;
	}
	.countdown-urgent {
		stroke: #ef4444;
	}
	@keyframes countdownDrain {
		to { stroke-dashoffset: 119.38; }
	}
	.countdown-num {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 14px;
		font-weight: 900;
		color: var(--color-slot-text);
	}
	.countdown-num-urgent {
		color: #ef4444;
	}

	/* Card reveal animation */
	.animate-card-reveal {
		animation: cardReveal 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	@keyframes cardReveal {
		from { opacity: 0; transform: scale(0.8) translateY(15px); }
		to { opacity: 1; transform: scale(1) translateY(0); }
	}

	/* Suspense pulse on face-down cards */
	.card-wrapper:not(:empty) {
		animation: none;
	}

	/* Disable blue tap highlight on mobile */
	* {
		-webkit-tap-highlight-color: transparent;
		-webkit-touch-callout: none;
	}

	/* Dealing suspense text */
	.dealing-suspense {
		text-align: center;
		padding: 2rem 0;
	}
	.dealing-suspense p {
		font-size: 15px;
		font-weight: 800;
		color: rgba(255, 255, 255, 0.7);
		animation: suspensePulse 0.8s ease-in-out infinite;
	}
	@keyframes suspensePulse {
		0%, 100% { opacity: 0.5; transform: scale(1); }
		50% { opacity: 1; transform: scale(1.05); }
	}

	/* ===== Bets Bar (who bet what) ===== */
	.bets-bar {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.2rem 0.5rem;
		padding: 0.4rem 0;
	}
	.bets-bar-item {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 10px;
	}

	/* ===== Shuffle Overlay ===== */
	.shuffle-overlay {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 1.5rem 0;
		min-height: 140px;
	}


	/* Card flip animation (3D) */
	.animate-card-flip {
		animation: cardFlip3d 0.7s cubic-bezier(0.4, 0, 0.2, 1) both;
	}
	@keyframes cardFlip3d {
		0% { transform: perspective(800px) rotateY(180deg) scale(0.9); opacity: 0; }
		30% { opacity: 0.6; }
		50% { transform: perspective(800px) rotateY(90deg) scale(1.03); }
		75% { transform: perspective(800px) rotateY(20deg) scale(1.01); opacity: 1; }
		100% { transform: perspective(800px) rotateY(0deg) scale(1); opacity: 1; }
	}
</style>
