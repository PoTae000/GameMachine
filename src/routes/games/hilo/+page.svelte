<script lang="ts">
	import {
		suitSymbol,
		suitColor,
		HILO_MULTIPLIER,
		type Card,
		type HiLoGuess
	} from '$lib/games/hiloEngine';
	import { wallet, stats, gameInProgress } from '$lib/store.svelte';
	import { renderCard, renderCardBack } from '$lib/cardSvg';
	import { playBet, playCardFlip, playCardDeal, playCardShuffle, playSuspense, playSuspenseLong, playHeartbeat, playWin, playLose, playBigWin, playCashout, playReveal } from '$lib/sounds';

	const BET_OPTIONS = [1, 5, 10, 20, 50, 100, 200, 500];

	let bet = $state(BET_OPTIONS[0]);
	let currentCard: Card | null = $state(null);
	let nextCard: Card | null = $state(null);
	let phase: 'betting' | 'guessing' | 'result' = $state('betting');
	let message = $state('');
	let messageType: 'win' | 'lose' | 'info' | '' = $state('');
	let streak = $state(0);
	let potentialWin = $state(0);
	let animating = $state(false);
	let originalBet = $state(0);

	// 3D card flip state
	let showNextCard = $state(false);
	let nextCardFlipped = $state(false);
	let cardShaking = $state(false);
	let resultGlow: 'win' | 'lose' | '' = $state('');

	// Deck shuffle + chip animation state
	let showDeck = $state(false);
	let deckPhase: 'idle' | 'riffle' | 'wash' | 'riffle2' | 'cut' = $state('idle');
	// Big win popup
	let showBigWin = $state(false);
	let bigWinAmount = $state(0);

	function decreaseBet() {
		const lower = BET_OPTIONS.filter((b) => b < bet);
		if (lower.length > 0) bet = lower[lower.length - 1];
	}

	function increaseBet() {
		const higher = BET_OPTIONS.filter((b) => b > bet);
		if (higher.length > 0) bet = higher[0];
	}

	function validateBet() {
		if (!bet || bet < 1 || isNaN(bet)) bet = BET_OPTIONS[0];
		bet = Math.round(bet * 100) / 100;
	}

	async function startRound() {
		if (wallet.credit < bet) {
			message = 'บาทไม่พอ';
			messageType = 'info';
			return;
		}
		playBet();
		gameInProgress.value = true;
		originalBet = bet;
		message = '';
		messageType = '';
		nextCard = null;
		showNextCard = false;
		nextCardFlipped = false;
		cardShaking = false;
		resultGlow = '';

		// Deck shuffle
		showDeck = true;
		await delay(200);
		deckPhase = 'riffle';
		playCardShuffle();
		await delay(500);
		deckPhase = 'wash';
		await delay(600);
		deckPhase = 'riffle2';
		await delay(500);
		deckPhase = 'cut';
		await delay(450);
		deckPhase = 'idle';
		showDeck = false;
		await delay(150);

		// Call server API to start
		const res = await fetch('/api/games/hilo/start', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ bet })
		});
		const data = await res.json();
		if (!res.ok) {
			message = data.error || 'เกิดข้อผิดพลาด';
			messageType = 'info';
			gameInProgress.value = false;
			return;
		}

		currentCard = data.currentCard;
		streak = data.streak;
		potentialWin = data.potentialWin;
		playCardDeal();
		phase = 'guessing';
	}

	async function guess(g: HiLoGuess) {
		if (!currentCard || animating) return;
		animating = true;
		showNextCard = true;
		nextCardFlipped = false;
		cardShaking = false;
		resultGlow = '';

		// Call server API to guess
		const res = await fetch('/api/games/hilo/guess', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ guess: g })
		});
		const data = await res.json();
		if (!res.ok) {
			animating = false;
			return;
		}

		nextCard = data.nextCard;

		// Suspense: show card back with heartbeat, then shake
		playHeartbeat();
		await delay(600);
		playSuspenseLong();
		await delay(1000);
		cardShaking = true;
		playHeartbeat();
		await delay(700);
		cardShaking = false;

		// 3D card flip reveal
		playCardFlip();
		nextCardFlipped = true;
		await delay(600);

		if (data.won) {
			playWin();
			resultGlow = 'win';
			streak = data.streak;
			potentialWin = data.potentialWin;
			message = `ถูก! ชนะสะสม ${potentialWin.toLocaleString()} (x${streak})`;
			messageType = 'win';
			await delay(400);
			currentCard = data.currentCard;
			nextCard = null;
			showNextCard = false;
			nextCardFlipped = false;
			phase = 'guessing';
		} else {
			playLose();
			resultGlow = 'lose';
			wallet.credit = data.newCredit;
			if (data.stats) {
				stats.totalSpent = data.stats.totalSpent;
				stats.totalReceived = data.stats.totalReceived;
			}
			message = `ผิด! เสีย ${originalBet.toLocaleString()} บาท`;
			messageType = 'lose';
			phase = 'result';
			gameInProgress.value = false;
		}
		await delay(300);
		resultGlow = '';
		animating = false;
	}

	async function cashOut() {
		if (potentialWin <= 0) return;

		const res = await fetch('/api/games/hilo/cashout', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' }
		});
		const data = await res.json();
		if (!res.ok) return;

		gameInProgress.value = false;
		playCashout();
		const creditBefore = wallet.credit;
		wallet.credit = data.newCredit;
		if (data.stats) {
			stats.totalSpent = data.stats.totalSpent;
			stats.totalReceived = data.stats.totalReceived;
		}
		const profit = data.payout - originalBet;
		message = `ถอน ${data.payout.toLocaleString()} บาท!`;
		messageType = 'win';
		if (profit > creditBefore * 0.5) {
			playBigWin();
			bigWinAmount = profit;
			showBigWin = true;
		}
		potentialWin = 0;
		streak = 0;
		phase = 'betting';
		currentCard = null;
		nextCard = null;
		showNextCard = false;
		nextCardFlipped = false;
	}

	async function washShuffle() {
		showDeck = true;
		await delay(200);
		deckPhase = 'riffle';
		playCardShuffle();
		await delay(500);
		deckPhase = 'wash';
		await delay(600);
		deckPhase = 'riffle2';
		await delay(500);
		deckPhase = 'cut';
		await delay(450);
		deckPhase = 'idle';
		showDeck = false;
	}

	function newGame() {
		gameInProgress.value = false;
		phase = 'betting';
		currentCard = null;
		nextCard = null;
		message = '';
		messageType = '';
		streak = 0;
		potentialWin = 0;
		showNextCard = false;
		nextCardFlipped = false;
		cardShaking = false;
		resultGlow = '';
		showDeck = false;
		deckPhase = 'idle';
	}

	function delay(ms: number) {
		return new Promise((r) => setTimeout(r, ms));
	}
</script>

<svelte:head>
	<title>Hi-Lo - BUNG TAE DUBAI</title>
</svelte:head>

{#if showBigWin}
	<div class="animate-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
		<div class="animate-modal w-full max-w-sm rounded-2xl bg-gradient-to-b from-yellow-900/90 to-yellow-950/95 p-6 text-center shadow-2xl border border-yellow-500/40">
			<div class="mb-2 text-5xl">🎉</div>
			<p class="mb-1 text-lg font-bold text-yellow-400 drop-shadow">BIG WIN!</p>
			<p class="my-3 text-4xl font-black tabular-nums text-yellow-300 drop-shadow sm:text-5xl animate-neon">
				+{bigWinAmount.toLocaleString()}
			</p>
			<p class="mb-4 text-sm text-yellow-500/80">บาท</p>
			<button
				onclick={() => (showBigWin = false)}
				class="cursor-pointer rounded-xl bg-yellow-500 px-8 py-2.5 text-sm font-bold text-black transition hover:bg-yellow-400 active:scale-[0.98]"
			>
				เยี่ยม!
			</button>
		</div>
	</div>
{/if}

<div class="flex flex-col items-center select-none">
	<h2 class="mb-4 text-lg font-bold text-slot-accent sm:text-xl">Hi-Lo ไฮโล</h2>

	<!-- Card Table -->
	<div class="relative mb-4 w-full rounded-2xl hilo-table p-5 sm:p-6 min-h-[220px] sm:min-h-[260px] casino-felt casino-felt-gold">
	<!-- Static deck on table -->
	{#if phase === 'betting' && !showDeck}
		<div class="absolute top-1/2 right-4 -translate-y-1/2 opacity-30 sm:right-5">
			<div class="relative h-[68px] w-[48px] sm:h-[80px] sm:w-[56px]">
				<div class="absolute inset-0" style="transform: rotate(-2deg) translate(-2px, -3px)">{@html renderCardBack(48, 68)}</div>
				<div class="absolute inset-0" style="transform: rotate(-0.5deg) translate(-0.5px, -1px)">{@html renderCardBack(48, 68)}</div>
				<div class="absolute inset-0">{@html renderCardBack(48, 68)}</div>
			</div>
		</div>
	{/if}
	{#if showDeck}
		<div class="absolute inset-0 z-10 flex items-center justify-center">
			<div class="relative h-24 w-[4.2rem] sm:h-28 sm:w-20">
				<div class="absolute inset-0 {deckPhase === 'riffle' ? 'animate-shuffle-left' : ''} {deckPhase === 'wash' ? 'animate-shuffle-wash' : ''} {deckPhase === 'riffle2' ? 'animate-shuffle-left' : ''}">
					<div class="absolute inset-0 rounded-lg" style="transform: rotate(-3deg) translate(-3px, -4px)">{@html renderCardBack(56, 80)}</div>
					<div class="absolute inset-0 rounded-lg" style="transform: rotate(-1.5deg) translate(-1.5px, -2px)">{@html renderCardBack(56, 80)}</div>
				</div>
				<div class="absolute inset-0 {deckPhase === 'riffle' ? 'animate-shuffle-right' : ''} {deckPhase === 'wash' ? 'animate-shuffle-fan' : ''} {deckPhase === 'riffle2' ? 'animate-shuffle-right' : ''} {deckPhase === 'cut' ? 'animate-shuffle-cut' : ''}">
					<div class="absolute inset-0 rounded-lg" style="transform: rotate(0deg) translate(0.5px, -0.5px)">{@html renderCardBack(56, 80)}</div>
					<div class="absolute inset-0 rounded-lg">{@html renderCardBack(56, 80)}</div>
				</div>
			</div>
		</div>
	{/if}
	<div class="flex items-center justify-center gap-4">
		<!-- Left card: current or card-back -->
		{#if currentCard}
			<div class="h-28 w-20 rounded-xl shadow-lg sm:h-32 sm:w-24 animate-deal" style="--deal-x: 80px; --deal-y: -40px">
				{@html renderCard(currentCard.suit, currentCard.display, 80, 112)}
			</div>
		{:else}
			<div class="h-28 w-20 sm:h-32 sm:w-24"></div>
		{/if}

		<!-- Arrow indicator -->
		{#if phase === 'guessing'}
			<div class="text-xl text-slot-muted animate-pulse">→</div>
		{/if}

		<!-- Right card: true 3D flip container -->
		{#if showNextCard}
			<div class="card-flip-3d h-28 w-20 sm:h-32 sm:w-24
				{resultGlow === 'lose' ? 'animate-shake' : ''}">
				<div class="card-flip-3d-inner h-full w-full {nextCardFlipped ? 'flipped' : ''}">
					<!-- Back face (visible initially) -->
					<div class="card-flip-3d-back h-full w-full rounded-xl shadow-lg
						{cardShaking ? 'animate-shake' : ''}
						{!nextCardFlipped && !cardShaking ? 'animate-heartbeat' : ''}">
						{@html renderCardBack(80, 112)}
					</div>
					<!-- Front face (visible after flip) -->
					<div class="card-flip-3d-front h-full w-full rounded-xl shadow-lg">
						{#if nextCard}
							{@html renderCard(nextCard.suit, nextCard.display, 80, 112)}
						{/if}
					</div>
				</div>
			</div>
		{:else if phase === 'guessing'}
			<div class="h-28 w-20 rounded-xl shadow-lg sm:h-32 sm:w-24">
				{@html renderCardBack(80, 112)}
			</div>
		{/if}
	</div>
	</div>

	{#if streak > 0 && phase === 'guessing'}
		<div class="mb-3 w-full rounded-xl bg-slot-win/10 px-4 py-2 text-center casino-shadow">
			<span class="text-sm font-bold text-slot-win">ชนะสะสม: {potentialWin.toLocaleString()} (สตรีค x{streak})</span>
		</div>
	{/if}

	{#if message}
		<div class="animate-slide-up mb-3 w-full rounded-xl px-4 py-2.5 text-center text-sm font-bold casino-shadow
			{messageType === 'win' ? 'bg-green-50 text-slot-win border border-green-200' : ''}
			{messageType === 'lose' ? 'bg-red-50 text-slot-lose border border-red-200' : ''}
			{messageType === 'info' ? 'bg-slot-accent/10 text-slot-accent border border-slot-accent/20' : ''}">
			{message}
		</div>
	{/if}

	{#if phase === 'betting'}
		<div class="mb-4 flex w-full items-center gap-2 sm:gap-3">
			<div class="flex items-center gap-0 rounded-xl border border-slot-border bg-slot-surface casino-shadow">
			<button onclick={decreaseBet} class="cursor-pointer rounded-l-xl px-2.5 py-1.5 text-base font-bold text-slot-muted transition hover:text-slot-text disabled:cursor-not-allowed disabled:opacity-30 sm:px-3 sm:py-2 sm:text-lg">−</button>
			<div class="flex min-w-[3.5rem] flex-col items-center border-x border-slot-border px-1 sm:min-w-[4.5rem]">
				<span class="text-[9px] uppercase tracking-wider text-slot-muted">BET</span>
				<input type="number" bind:value={bet} onblur={validateBet} min="1" class="w-full bg-transparent text-center text-sm font-bold tabular-nums outline-none disabled:opacity-60 sm:text-base [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
			</div>
			<button onclick={increaseBet} class="cursor-pointer rounded-r-xl px-2.5 py-1.5 text-base font-bold text-slot-muted transition hover:text-slot-text disabled:cursor-not-allowed disabled:opacity-30 sm:px-3 sm:py-2 sm:text-lg">+</button>
		</div>
		<button
			onclick={startRound}
			disabled={wallet.credit < bet}
			class="flex-1 cursor-pointer rounded-xl bg-slot-accent px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:text-base"
		>
			เริ่มเกม
		</button>
		<button onclick={washShuffle} disabled={showDeck} class="cursor-pointer rounded-xl border border-slot-border bg-slot-surface px-3 py-3 text-xs font-bold text-slot-muted transition hover:border-slot-accent/40 hover:text-slot-accent active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40">ล้างไพ่</button>
		</div>
	{:else if phase === 'guessing'}
		<div class="flex w-full gap-2">
			<button
				onclick={() => guess('high')}
				disabled={animating}
				class="flex-1 cursor-pointer rounded-xl bg-slot-win px-4 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40 sm:text-base"
			>
				สูงกว่า
			</button>
			<button
				onclick={() => guess('low')}
				disabled={animating}
				class="flex-1 cursor-pointer rounded-xl bg-slot-lose px-4 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40 sm:text-base"
			>
				ต่ำกว่า
			</button>
		</div>
		{#if streak > 0}
			<button
				onclick={cashOut}
				disabled={animating}
				class="mt-2 w-full cursor-pointer rounded-xl border-2 border-slot-accent bg-slot-accent/10 px-4 py-2.5 text-sm font-bold text-slot-accent transition hover:bg-slot-accent/20 active:scale-[0.98] disabled:opacity-40"
			>
				ถอน {potentialWin.toLocaleString()} บาท
			</button>
		{/if}
		{:else}
		<button
			onclick={newGame}
			class="w-full cursor-pointer rounded-xl bg-slot-accent px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] sm:text-base"
		>
			เล่นใหม่
		</button>
	{/if}

	<div class="mt-4 w-full rounded-xl border border-slot-border bg-slot-surface p-3 text-xs text-slot-muted casino-shadow">
		<p class="font-medium text-slot-text">วิธีเล่น</p>
		<p class="mt-1">ทายว่าไพ่ใบถัดไปจะสูงกว่าหรือต่ำกว่าใบปัจจุบัน</p>
		<p>ทายถูก = x{HILO_MULTIPLIER} | เล่นต่อหรือถอนได้เลย</p>
	</div>
</div>
