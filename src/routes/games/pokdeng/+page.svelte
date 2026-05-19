<script lang="ts">
	import {
		handPoints,
		isPok,
		getHandMultiplier,
		suitSymbol,
		suitColor,
		type Card
	} from '$lib/games/pokdengEngine';
	import { wallet, stats, gameInProgress } from '$lib/store.svelte';
	import { renderCard, renderCardBack } from '$lib/cardSvg';
	import { playBet, playCardFlip, playCardDeal, playCardShuffle, playSuspense, playSuspenseLong, playHeartbeat, playWin, playLose, playBigWin } from '$lib/sounds';

	const BET_OPTIONS = [1, 5, 10, 20, 50, 100, 200, 500];

	let bet = $state(BET_OPTIONS[0]);
	let playerHand: Card[] = $state([]);
	let dealerHand: Card[] = $state([]);
	let dealerHandCount = $state(0);
	let phase: 'betting' | 'dealing' | 'playing' | 'revealing' | 'result' = $state('betting');
	let message = $state('');
	let messageType: 'win' | 'lose' | 'info' | '' = $state('');
	let showDealer = $state(false);
	let visiblePlayerCards = $state(0);
	let visibleDealerCards = $state(0);
	let dealerRevealed = $state(0);

	// Suspense animation states
	let flippedCards = $state(new Set<string>());
	let glowingDealerBack = $state(false);
	let lastDealerHeartbeat = $state(false);
	let resultGlow: 'win' | 'lose' | 'pok' | '' = $state('');

	// Big win popup
	let showBigWin = $state(false);
	let bigWinAmount = $state(0);

	let showDeck = $state(false);
	let deckPhase: 'idle' | 'riffle' | 'wash' | 'riffle2' | 'cut' = $state('idle');

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

	async function startGame() {
		if (wallet.credit < bet) {
			message = 'บาทไม่พอ';
			messageType = 'info';
			return;
		}

		gameInProgress.value = true;
		playBet();
		message = '';
		messageType = '';
		showDealer = false;
		visiblePlayerCards = 0;
		visibleDealerCards = 0;
		dealerRevealed = 0;
		flippedCards = new Set();
		glowingDealerBack = false;
		lastDealerHeartbeat = false;
		resultGlow = '';
		playerHand = [];
		dealerHand = [];
		dealerHandCount = 0;

		// Deck shuffle animation
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

		// Call server API to deal
		const res = await fetch('/api/games/pokdeng/deal', {
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

		playerHand = data.playerHand;
		dealerHandCount = data.dealerHandCount ?? 2;

		// Suspense dealing: card by card with flip
		phase = 'dealing';
		await delay(350);
		visiblePlayerCards = 1;
		flippedCards = new Set(['p0']);
		playCardDeal();
		await delay(400);
		visibleDealerCards = 1;
		playCardDeal();
		await delay(400);
		visiblePlayerCards = 2;
		flippedCards = new Set([...flippedCards, 'p1']);
		playCardDeal();
		await delay(400);
		visibleDealerCards = 2;
		playCardDeal();
		await delay(300);

		// Check pok (immediate result from server)
		if (data.isPok) {
			dealerHand = data.dealerHand;
			showDealer = true;
			await revealDealerAnimated();
			await delay(400);
			handleResult(data);
			return;
		}

		phase = 'playing';
	}

	async function revealDealerAnimated() {
		for (let i = 0; i < dealerHand.length; i++) {
			if (i === dealerHand.length - 1) {
				// Last card: heartbeat + glow before flip
				lastDealerHeartbeat = true;
				glowingDealerBack = true;
				playHeartbeat();
				playSuspenseLong();
				await delay(1200);
				lastDealerHeartbeat = false;
				glowingDealerBack = false;
			}
			dealerRevealed = i + 1;
			flippedCards = new Set([...flippedCards, `d${i}`]);
			playCardFlip();
			await delay(i === dealerHand.length - 1 ? 600 : 500);
		}
	}

	async function drawCard() {
		const res = await fetch('/api/games/pokdeng/action', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'draw' })
		});
		const data = await res.json();
		if (!res.ok) return;

		playerHand = data.playerHand;
		dealerHand = data.dealerHand;
		visiblePlayerCards = playerHand.length;
		flippedCards = new Set([...flippedCards, `p${playerHand.length - 1}`]);
		playCardDeal();
		visibleDealerCards = dealerHand.length;

		phase = 'revealing';
		showDealer = true;
		await delay(800);
		await revealDealerAnimated();
		await delay(700);
		handleResult(data);
	}

	async function stay() {
		const res = await fetch('/api/games/pokdeng/action', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'stay' })
		});
		const data = await res.json();
		if (!res.ok) return;

		playerHand = data.playerHand;
		dealerHand = data.dealerHand;
		visibleDealerCards = dealerHand.length;

		phase = 'revealing';
		showDealer = true;
		await delay(700);
		await revealDealerAnimated();
		await delay(700);
		handleResult(data);
	}

	function handleResult(data: any) {
		phase = 'result';
		const creditBefore = wallet.credit;
		wallet.credit = data.newCredit;
		if (data.stats) {
			stats.totalSpent = data.stats.totalSpent;
			stats.totalReceived = data.stats.totalReceived;
		}
		const resultVal = data.result;

		if (resultVal === 'win') {
			const payout = data.payout ?? 0;
			const profit = payout - bet;
			const hasPok = isPok(playerHand);
			resultGlow = hasPok ? 'pok' : 'win';
			const mult = getHandMultiplier(playerHand);
			const label = hasPok ? `ป๊อก ${handPoints(playerHand)}!` : 'ชนะ!';
			message = `${label} +${profit.toLocaleString()} (x${mult})`;
			messageType = 'win';
			playWin();
			if (profit > creditBefore * 0.5) {
				bigWinAmount = profit;
				showBigWin = true;
				playBigWin();
			}
		} else if (resultVal === 'draw') {
			message = 'เสมอ — ได้เงินคืน';
			messageType = 'info';
		} else {
			resultGlow = 'lose';
			const label = isPok(dealerHand) ? `เจ้ามือป๊อก ${handPoints(dealerHand)}!` : 'แพ้';
			message = `${label} เสีย ${bet.toLocaleString()}`;
			messageType = 'lose';
			playLose();
		}
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
		dealerHand = [];
		message = '';
		messageType = '';
		showDealer = false;
		visiblePlayerCards = 0;
		visibleDealerCards = 0;
		dealerRevealed = 0;
		flippedCards = new Set();
		glowingDealerBack = false;
		lastDealerHeartbeat = false;
		resultGlow = '';
		showDeck = false;
		deckPhase = 'idle';
	}

	function delay(ms: number) {
		return new Promise((r) => setTimeout(r, ms));
	}
</script>

{#snippet cardBack(isLast: boolean)}
	<div class="animate-deal h-24 w-[4.2rem] sm:h-28 sm:w-20
		{isLast && glowingDealerBack ? 'animate-glow' : ''}
		{isLast && lastDealerHeartbeat ? 'animate-heartbeat' : ''}"
		style="--deal-x: 80px; --deal-y: -60px{isLast && glowingDealerBack ? '; --glow-color: #eab308' : ''}">
		{@html renderCardBack(56, 80)}
	</div>
{/snippet}

{#snippet faceUpCard(card: Card, key: string)}
	<div class="h-24 w-[4.2rem] sm:h-28 sm:w-20 animate-deal {flippedCards.has(key) ? 'animate-card-flip' : ''}"
		style="--deal-x: 80px; --deal-y: -60px">
		{@html renderCard(card.suit, card.display, 56, 80)}
	</div>
{/snippet}

<svelte:head>
	<title>Pok Deng - BUNG TAE DUBAI</title>
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
	<h2 class="mb-4 text-lg font-bold text-slot-accent sm:text-xl">Pok Deng ป๊อกเด้ง</h2>

	<!-- Card Table -->
	<div class="relative mb-4 w-full rounded-2xl p-5 sm:p-6 min-h-[260px] sm:min-h-[300px] casino-felt casino-felt-gold">
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
	<!-- Deck shuffle overlay -->
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
	<!-- Dealer hand -->
	<div class="mb-2">
		<p class="mb-1 table-label">เจ้ามือ {dealerHand.length > 0 && showDealer && dealerRevealed >= dealerHand.length ? `(${handPoints(dealerHand)} แต้ม)` : ''}</p>
		<div class="flex gap-2.5 sm:gap-3 {resultGlow === 'lose' ? 'animate-shake' : ''}">
			{#if dealerHand.length > 0}
				{#each dealerHand as card, i}
					{#if i < visibleDealerCards}
						{#if showDealer && i < dealerRevealed}
							{@render faceUpCard(card, `d${i}`)}
						{:else}
							{@render cardBack(i === visibleDealerCards - 1)}
						{/if}
					{/if}
				{/each}
			{:else if dealerHandCount > 0 && visibleDealerCards > 0}
				{#each Array(Math.min(visibleDealerCards, dealerHandCount)) as _, i}
					{@render cardBack(i === Math.min(visibleDealerCards, dealerHandCount) - 1)}
				{/each}
			{:else}
				<div class="h-24 sm:h-28"></div>
			{/if}
		</div>
	</div>

	<!-- Player hand -->
	<div class="mb-2">
		<p class="mb-1 table-label">
			คุณ {playerHand.length > 0 && visiblePlayerCards >= playerHand.length ? `(${handPoints(playerHand)} แต้ม)` : ''}
			{#if playerHand.length > 0 && visiblePlayerCards >= playerHand.length && isPok(playerHand)}<span class="font-bold text-slot-win">ป๊อก!</span>{/if}
		</p>
		<div class="flex gap-2.5 sm:gap-3
			{resultGlow === 'win' || resultGlow === 'pok' ? 'animate-pop' : ''}">
			{#if playerHand.length > 0}
				{#each playerHand as card, i}
					{#if i < visiblePlayerCards}
						{@render faceUpCard(card, `p${i}`)}
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
			onclick={startGame}
			disabled={wallet.credit < bet}
			class="flex-1 cursor-pointer rounded-xl bg-slot-accent px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:text-base"
		>
			แจกไพ่
		</button>
		<button onclick={washShuffle} disabled={showDeck} class="cursor-pointer rounded-xl border border-slot-border bg-slot-surface px-3 py-3 text-xs font-bold text-slot-muted transition hover:border-slot-accent/40 hover:text-slot-accent active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40">ล้างไพ่</button>
		</div>
	{:else if phase === 'dealing'}
		<div class="w-full text-center text-sm text-slot-muted animate-pulse">กำลังแจกไพ่...</div>
	{:else if phase === 'playing'}
		<div class="flex w-full gap-2">
			<button
				onclick={drawCard}
				class="flex-1 cursor-pointer rounded-xl bg-slot-accent px-4 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] sm:text-base"
			>
				จั่วใบที่ 3
			</button>
			<button
				onclick={stay}
				class="flex-1 cursor-pointer rounded-xl border-2 border-slot-accent bg-transparent px-4 py-3 text-sm font-bold text-slot-accent transition hover:bg-slot-accent/10 active:scale-[0.98] sm:text-base"
			>
				อยู่
			</button>
		</div>
		{:else if phase === 'revealing'}
		<div class="w-full text-center text-sm text-slot-muted animate-pulse">กำลังเปิดไพ่เจ้ามือ...</div>
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
		<p class="mt-1">แจกไพ่ 2 ใบ ป๊อก 8-9 = ชนะทันที</p>
		<p>ไม่ป๊อก = เลือกจั่วหรืออยู่ | แต้มสูงกว่าเจ้ามือ = ชนะ</p>
		<p>ป๊อก 9 = x3 | ป๊อก 8 / คู่ = x2 | ชนะปกติ = x1</p>
	</div>
</div>
