<script lang="ts">
	import {
		handTotal,
		getMultiplier,
		suitSymbol,
		suitColor,
		type Card,
		type BaccaratBet,
		type BaccaratResult
	} from '$lib/games/baccaratEngine';
	import { wallet, stats, gameInProgress } from '$lib/store.svelte';
	import { renderCard, renderCardBack } from '$lib/cardSvg';
	import { playBet, playCardFlip, playCardDeal, playCardShuffle, playSuspense, playSuspenseLong, playHeartbeat, playWin, playLose, playBigWin } from '$lib/sounds';

	const BET_OPTIONS = [1, 5, 10, 20, 50, 100, 200, 500];

	let bet = $state(BET_OPTIONS[0]);
	let selectedBet: BaccaratBet | null = $state(null);
	let playerHand: Card[] = $state([]);
	let bankerHand: Card[] = $state([]);
	let phase: 'betting' | 'dealing' | 'result' = $state('betting');
	let message = $state('');
	let messageType: 'win' | 'lose' | 'info' | '' = $state('');
	let visiblePlayer = $state(0);
	let visibleBanker = $state(0);

	// Suspense animation states
	let flippedCards = $state(new Set<string>());
	let thirdCardHeartbeat = $state(false);
	let thirdCardGlow = $state(false);
	let winSide: 'player' | 'banker' | '' = $state('');

	let showDeck = $state(false);
	let deckPhase: 'idle' | 'riffle' | 'wash' | 'riffle2' | 'cut' = $state('idle');
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

	async function play() {
		if (!selectedBet || wallet.credit < bet) return;

		gameInProgress.value = true;
		playBet();
		message = '';
		messageType = '';
		visiblePlayer = 0;
		visibleBanker = 0;
		flippedCards = new Set();
		thirdCardHeartbeat = false;
		thirdCardGlow = false;
		winSide = '';
		phase = 'dealing';

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

		// Call server API
		const res = await fetch('/api/games/baccarat/play', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ bet, selectedBet })
		});
		const data = await res.json();
		if (!res.ok) {
			message = data.error || 'เกิดข้อผิดพลาด';
			messageType = 'lose';
			phase = 'result';
			gameInProgress.value = false;
			return;
		}

		playerHand = data.outcome.playerHand;
		bankerHand = data.outcome.bankerHand;


		// Animate dealing with card-flip
		await delay(400);
		visiblePlayer = 1;
		flippedCards = new Set(['p0']);
		playCardDeal();
		await delay(400);
		visibleBanker = 1;
		flippedCards = new Set([...flippedCards, 'b0']);
		playCardDeal();
		await delay(400);
		visiblePlayer = 2;
		flippedCards = new Set([...flippedCards, 'p1']);
		playCardDeal();
		await delay(400);
		visibleBanker = 2;
		flippedCards = new Set([...flippedCards, 'b1']);
		playCardDeal();

		// Third cards with heartbeat suspense
		if (playerHand.length > 2) {
			await delay(600);
			visiblePlayer = 3;
			thirdCardHeartbeat = true;
			thirdCardGlow = true;
			playHeartbeat();
			playSuspenseLong();
			await delay(1200);
			thirdCardHeartbeat = false;
			thirdCardGlow = false;
			flippedCards = new Set([...flippedCards, 'p2']);
			playCardFlip();
			await delay(400);
		}
		if (bankerHand.length > 2) {
			await delay(600);
			visibleBanker = 3;
			thirdCardHeartbeat = true;
			thirdCardGlow = true;
			playHeartbeat();
			playSuspenseLong();
			await delay(1200);
			thirdCardHeartbeat = false;
			thirdCardGlow = false;
			flippedCards = new Set([...flippedCards, 'b2']);
			playCardFlip();
			await delay(400);
		}

		await delay(800);
		phase = 'result';

		const result: BaccaratResult = data.outcome.result;
		winSide = result === 'tie' ? '' : result;
		const creditBefore = wallet.credit;

		if (data.won) {
			const profit = data.payout - bet;
			const label = result === 'tie' ? 'เสมอ!' : result === 'player' ? 'ผู้เล่นชนะ!' : 'เจ้ามือชนะ!';
			message = `${label} +${profit.toLocaleString()}`;
			messageType = 'win';
			playWin();
			if (profit > creditBefore * 0.5) {
				bigWinAmount = profit;
				showBigWin = true;
				playBigWin();
			}
		} else if (result === 'tie' && selectedBet !== 'tie') {
			message = 'เสมอ — ได้เงินคืน';
			messageType = 'info';
		} else {
			message = `${result === 'player' ? 'ผู้เล่นชนะ' : result === 'banker' ? 'เจ้ามือชนะ' : 'เสมอ'} — เสีย ${bet.toLocaleString()}`;
			messageType = 'lose';
			playLose();
		}

		// Apply final server state after animation
		wallet.credit = data.newCredit;
		stats.totalSpent = data.stats.totalSpent;
		stats.totalReceived = data.stats.totalReceived;
		gameInProgress.value = false;
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
		playerHand = [];
		bankerHand = [];
		message = '';
		messageType = '';
		visiblePlayer = 0;
		visibleBanker = 0;
		flippedCards = new Set();
		thirdCardHeartbeat = false;
		thirdCardGlow = false;
		winSide = '';
		showDeck = false;
		deckPhase = 'idle';
	}

	function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
</script>

{#snippet faceUpCard(card: Card, key: string)}
	<div class="h-24 w-[4.2rem] sm:h-28 sm:w-20 animate-deal {flippedCards.has(key) ? 'animate-card-flip' : ''}" style="--deal-x: 80px; --deal-y: -60px">
		{@html renderCard(card.suit, card.display, 56, 80)}
	</div>
{/snippet}

{#snippet cardBack(isThird: boolean)}
	<div class="animate-deal h-24 w-[4.2rem] sm:h-28 sm:w-20
		{isThird && thirdCardGlow ? 'animate-glow' : ''}
		{isThird && thirdCardHeartbeat ? 'animate-heartbeat' : ''}"
		style="--deal-x: 80px; --deal-y: -60px; {isThird && thirdCardGlow ? '--glow-color: #eab308' : ''}">
		{@html renderCardBack(56, 80)}
	</div>
{/snippet}

<svelte:head><title>Baccarat - BUNG TAE DUBAI</title></svelte:head>

{#if showBigWin}
	<div class="animate-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
		<div class="animate-modal w-full max-w-sm rounded-2xl bg-gradient-to-b from-yellow-900/90 to-yellow-950/95 p-6 text-center shadow-2xl border border-yellow-500/40">
			<div class="mb-2 text-5xl">🎉</div>
			<p class="mb-1 text-lg font-bold text-yellow-400">BIG WIN!</p>
			<p class="my-3 text-4xl font-black tabular-nums text-yellow-300 sm:text-5xl animate-neon">+{bigWinAmount.toLocaleString()}</p>
			<p class="mb-4 text-sm text-yellow-500/80">บาท</p>
			<button onclick={() => (showBigWin = false)} class="cursor-pointer rounded-xl bg-yellow-500 px-8 py-2.5 text-sm font-bold text-black transition hover:bg-yellow-400 active:scale-[0.98]">เยี่ยม!</button>
		</div>
	</div>
{/if}

<div class="flex flex-col items-center select-none">
	<h2 class="mb-4 text-lg font-bold text-slot-accent sm:text-xl">Baccarat บาคาร่า</h2>

	<!-- Card Table -->
	<div class="relative mb-4 w-full rounded-2xl baccarat-table p-5 sm:p-6 min-h-[260px] sm:min-h-[300px] casino-felt casino-felt-gold">
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
		</div>
	{/if}
	<!-- Player hand -->
	<div class="mb-2">
		<p class="mb-1 table-label">ผู้เล่น {visiblePlayer >= playerHand.length && playerHand.length > 0 ? `(${handTotal(playerHand)})` : ''}</p>
		<div class="flex gap-2.5 sm:gap-3 transition-all duration-300
			{winSide === 'banker' ? 'opacity-50 scale-95' : ''}">
			{#if playerHand.length > 0}
				{#each playerHand as card, i}
					{#if i < visiblePlayer}
						{#if flippedCards.has(`p${i}`)}
							{@render faceUpCard(card, `p${i}`)}
						{:else}
							{@render cardBack(i === 2)}
						{/if}
					{/if}
				{/each}
			{:else}
				<div class="h-24 sm:h-28"></div>
			{/if}
		</div>
	</div>

	<!-- Banker hand -->
	<div class="mb-2">
		<p class="mb-1 table-label">เจ้ามือ {visibleBanker >= bankerHand.length && bankerHand.length > 0 ? `(${handTotal(bankerHand)})` : ''}</p>
		<div class="flex gap-2.5 sm:gap-3 transition-all duration-300
			{winSide === 'player' ? 'opacity-50 scale-95' : ''}">
			{#if bankerHand.length > 0}
				{#each bankerHand as card, i}
					{#if i < visibleBanker}
						{#if flippedCards.has(`b${i}`)}
							{@render faceUpCard(card, `b${i}`)}
						{:else}
							{@render cardBack(i === 2)}
						{/if}
					{/if}
				{/each}
			{:else}
				<div class="h-24 sm:h-28"></div>
			{/if}
		</div>
	</div>
	</div>

	{#if message}
		<div class="animate-slide-up mb-3 w-full rounded-xl px-4 py-2.5 text-center text-sm font-bold casino-shadow
			{messageType === 'win' ? 'bg-green-50 text-slot-win border border-green-200' : ''}
			{messageType === 'lose' ? 'bg-red-50 text-slot-lose border border-red-200' : ''}
			{messageType === 'info' ? 'bg-slot-accent/10 text-slot-accent border border-slot-accent/20' : ''}">{message}</div>
	{/if}

	{#if phase === 'betting'}
		<div class="mb-3 w-full">
			<p class="mb-2 text-xs text-slot-muted">เลือกเดิมพัน:</p>
			<div class="grid grid-cols-3 gap-2">
				<button onclick={() => (selectedBet = 'player')} class="cursor-pointer rounded-lg border px-3 py-3 text-sm font-bold transition {selectedBet === 'player' ? 'border-slot-accent bg-slot-accent/10 text-slot-accent' : 'border-slot-border bg-slot-surface text-slot-text hover:border-slot-accent/40'}">ผู้เล่น x2</button>
				<button onclick={() => (selectedBet = 'banker')} class="cursor-pointer rounded-lg border px-3 py-3 text-sm font-bold transition {selectedBet === 'banker' ? 'border-slot-accent bg-slot-accent/10 text-slot-accent' : 'border-slot-border bg-slot-surface text-slot-text hover:border-slot-accent/40'}">เจ้ามือ x1.95</button>
				<button onclick={() => (selectedBet = 'tie')} class="cursor-pointer rounded-lg border px-3 py-3 text-sm font-bold transition {selectedBet === 'tie' ? 'border-slot-accent bg-slot-accent/10 text-slot-accent' : 'border-slot-border bg-slot-surface text-slot-text hover:border-slot-accent/40'}">เสมอ x8</button>
			</div>
		</div>
		<div class="mb-4 flex w-full items-center gap-2 sm:gap-3">
			<div class="flex items-center gap-0 rounded-xl border border-slot-border bg-slot-surface casino-shadow">
			<button onclick={decreaseBet} class="cursor-pointer rounded-l-xl px-2.5 py-1.5 text-base font-bold text-slot-muted transition hover:text-slot-text disabled:cursor-not-allowed disabled:opacity-30 sm:px-3 sm:py-2 sm:text-lg">−</button>
			<div class="flex min-w-[3.5rem] flex-col items-center border-x border-slot-border px-1 sm:min-w-[4.5rem]">
				<span class="text-[9px] uppercase tracking-wider text-slot-muted">BET</span>
				<input type="number" bind:value={bet} onblur={validateBet} min="1" class="w-full bg-transparent text-center text-sm font-bold tabular-nums outline-none disabled:opacity-60 sm:text-base [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
			</div>
			<button onclick={increaseBet} class="cursor-pointer rounded-r-xl px-2.5 py-1.5 text-base font-bold text-slot-muted transition hover:text-slot-text disabled:cursor-not-allowed disabled:opacity-30 sm:px-3 sm:py-2 sm:text-lg">+</button>
		</div>
		<button onclick={play} disabled={!selectedBet || wallet.credit < bet} class="flex-1 cursor-pointer rounded-xl bg-slot-accent px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:text-base">แจกไพ่</button>
		<button onclick={washShuffle} disabled={showDeck} class="cursor-pointer rounded-xl border border-slot-border bg-slot-surface px-3 py-3 text-xs font-bold text-slot-muted transition hover:border-slot-accent/40 hover:text-slot-accent active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40">ล้างไพ่</button>
		</div>
	{:else if phase === 'dealing'}
		<div class="w-full text-center text-sm text-slot-muted animate-pulse">กำลังแจกไพ่...</div>
	{:else}
		<button onclick={newGame} class="w-full cursor-pointer rounded-xl bg-slot-accent px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] sm:text-base">เล่นใหม่</button>
	{/if}

	<div class="mt-4 w-full rounded-xl border border-slot-border bg-slot-surface p-3 text-xs text-slot-muted casino-shadow">
		<p class="font-medium text-slot-text">วิธีเล่น</p>
		<p class="mt-1">เลือกเดิมพัน ผู้เล่น/เจ้ามือ/เสมอ แต้มใกล้ 9 ที่สุดชนะ</p>
		<p>ผู้เล่น = x2 | เจ้ามือ = x1.95 | เสมอ = x8</p>
	</div>
</div>
