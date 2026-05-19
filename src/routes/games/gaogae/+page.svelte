<script lang="ts">
	import {
		handPoints,
		getHandType,
		handTypeName,
		getHandMultiplier,
		type Card,
		type HandType
	} from '$lib/games/gaogaeEngine';
	import { wallet, stats, gameInProgress } from '$lib/store.svelte';
	import { renderCard, renderCardBack } from '$lib/cardSvg';
	import { playBet, playCardFlip, playCardDeal, playCardShuffle, playSuspense, playSuspenseLong, playHeartbeat, playWin, playLose, playBigWin } from '$lib/sounds';

	const BET_OPTIONS = [1, 5, 10, 20, 50, 100, 200, 500];

	let bet = $state(BET_OPTIONS[0]);
	let playerHand: Card[] = $state([]);
	let dealerHand: Card[] = $state([]);
	let phase: 'betting' | 'dealing' | 'result' = $state('betting');
	let message = $state('');
	let messageType: 'win' | 'lose' | 'info' | '' = $state('');
	let visiblePlayer = $state(0);
	let visibleDealer = $state(0);

	// Suspense animation states
	let flippedCards = $state(new Set<string>());
	let lastCardHeartbeat = $state(false);
	let lastCardGlow = $state(false);
	let winSide: 'player' | 'dealer' | '' = $state('');

	let showDeck = $state(false);
	let deckPhase: 'idle' | 'riffle' | 'wash' | 'riffle2' | 'cut' = $state('idle');
	let showBigWin = $state(false);
	let bigWinAmount = $state(0);

	// Result data
	let playerType: HandType = $state('normal');
	let dealerType: HandType = $state('normal');
	let resultMultiplier = $state(0);

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
		if (wallet.credit < bet) return;

		gameInProgress.value = true;
		playBet();
		message = '';
		messageType = '';
		visiblePlayer = 0;
		visibleDealer = 0;
		flippedCards = new Set();
		lastCardHeartbeat = false;
		lastCardGlow = false;
		winSide = '';
		playerType = 'normal';
		dealerType = 'normal';
		resultMultiplier = 0;
		phase = 'dealing';

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

		// Call server API
		const res = await fetch('/api/games/gaogae/play', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ bet })
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
		dealerHand = data.outcome.dealerHand;
		playerType = data.outcome.playerType;
		dealerType = data.outcome.dealerType;
		resultMultiplier = data.outcome.multiplier;

		// Animate dealing: alternate player/dealer, 3 cards each
		await delay(400);
		visiblePlayer = 1;
		playCardDeal();
		await delay(350);
		visibleDealer = 1;
		playCardDeal();
		await delay(350);
		visiblePlayer = 2;
		playCardDeal();
		await delay(350);
		visibleDealer = 2;
		playCardDeal();
		await delay(350);
		visiblePlayer = 3;
		playCardDeal();
		await delay(350);

		// Dealer's last card: heartbeat + glow suspense
		visibleDealer = 3;
		lastCardHeartbeat = true;
		lastCardGlow = true;
		playHeartbeat();
		playSuspenseLong();
		await delay(1200);

		// Reveal all player cards
		flippedCards = new Set(['p0', 'p1', 'p2']);
		playCardFlip();
		await delay(600);

		// Reveal dealer first 2 cards
		flippedCards = new Set([...flippedCards, 'd0', 'd1']);
		playCardFlip();
		await delay(800);

		// Reveal dealer last card with suspense
		lastCardHeartbeat = false;
		lastCardGlow = false;
		flippedCards = new Set([...flippedCards, 'd2']);
		playCardFlip();
		await delay(800);

		phase = 'result';
		const result = data.outcome.result;
		winSide = result === 'win' ? 'player' : result === 'lose' ? 'dealer' : '';
		const creditBefore = wallet.credit;

		if (data.won) {
			const profit = data.payout - bet;
			const typeName = data.outcome.playerTypeName;
			message = `ชนะ! ${typeName} x${resultMultiplier} — +${profit.toLocaleString()}`;
			messageType = 'win';
			playWin();
			if (profit > creditBefore * 0.5 || playerType === 'trips' || playerType === 'straightflush') {
				bigWinAmount = profit;
				showBigWin = true;
				playBigWin();
			}
		} else if (result === 'draw') {
			message = 'เสมอ — ได้เงินคืน';
			messageType = 'info';
		} else {
			message = `แพ้ — เสีย ${bet.toLocaleString()}`;
			messageType = 'lose';
			playLose();
		}

		wallet.credit = data.newCredit;
		stats.totalSpent = data.stats.totalSpent;
		stats.totalReceived = data.stats.totalReceived;
		gameInProgress.value = false;
	}

	function newGame() {
		gameInProgress.value = false;
		phase = 'betting';
		playerHand = [];
		dealerHand = [];
		message = '';
		messageType = '';
		visiblePlayer = 0;
		visibleDealer = 0;
		flippedCards = new Set();
		lastCardHeartbeat = false;
		lastCardGlow = false;
		winSide = '';
		showDeck = false;
		deckPhase = 'idle';
		playerType = 'normal';
		dealerType = 'normal';
		resultMultiplier = 0;
	}

	function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

	function typeBadgeClass(type: HandType): string {
		switch (type) {
			case 'trips': return 'bg-amber-500 text-black';
			case 'straightflush': return 'bg-purple-500 text-white';
			case 'sian': return 'bg-blue-500 text-white';
			case 'straight': return 'bg-green-500 text-white';
			case 'flush': return 'bg-cyan-500 text-white';
			default: return 'bg-slot-border text-slot-muted';
		}
	}
</script>

{#snippet faceUpCard(card: Card, key: string)}
	<div class="h-24 w-[4.2rem] sm:h-28 sm:w-20 animate-deal {flippedCards.has(key) ? 'animate-card-flip' : ''}" style="--deal-x: 80px; --deal-y: -60px">
		{@html renderCard(card.suit, card.display, 56, 80)}
	</div>
{/snippet}

{#snippet cardBack(isLast: boolean)}
	<div class="animate-deal h-24 w-[4.2rem] sm:h-28 sm:w-20
		{isLast && lastCardGlow ? 'animate-glow' : ''}
		{isLast && lastCardHeartbeat ? 'animate-heartbeat' : ''}"
		style="--deal-x: 80px; --deal-y: -60px; {isLast && lastCardGlow ? '--glow-color: #eab308' : ''}">
		{@html renderCardBack(56, 80)}
	</div>
{/snippet}

<svelte:head><title>เก้าเก - BUNG TAE DUBAI</title></svelte:head>

{#if showBigWin}
	<div class="animate-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
		<div class="animate-modal w-full max-w-sm rounded-2xl bg-gradient-to-b from-yellow-900/90 to-yellow-950/95 p-6 text-center shadow-2xl border border-yellow-500/40">
			<div class="mb-2 text-5xl">🎉</div>
			<p class="mb-1 text-lg font-bold text-yellow-400">BIG WIN!</p>
			<p class="text-sm text-yellow-500/80 mb-1">{handTypeName(playerType)}</p>
			<p class="my-3 text-4xl font-black tabular-nums text-yellow-300 sm:text-5xl animate-neon">+{bigWinAmount.toLocaleString()}</p>
			<p class="mb-4 text-sm text-yellow-500/80">บาท</p>
			<button onclick={() => (showBigWin = false)} class="cursor-pointer rounded-xl bg-yellow-500 px-8 py-2.5 text-sm font-bold text-black transition hover:bg-yellow-400 active:scale-[0.98]">เยี่ยม!</button>
		</div>
	</div>
{/if}

<div class="flex flex-col items-center select-none">
	<h2 class="mb-4 text-lg font-bold text-slot-accent sm:text-xl">เก้าเก Gao Gae</h2>

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
		<div class="mb-3">
			<p class="mb-1 table-label">
				ผู้เล่น
				{#if visiblePlayer >= 3 && flippedCards.has('p0')}
					({handPoints(playerHand)} แต้ม)
					{#if playerType !== 'normal'}
						<span class="inline-block ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold {typeBadgeClass(playerType)}">{handTypeName(playerType)} x{getHandMultiplier(playerType)}</span>
					{/if}
				{/if}
			</p>
			<div class="flex gap-2.5 sm:gap-3 transition-all duration-300 {winSide === 'dealer' ? 'opacity-50 scale-95' : ''}">
				{#if playerHand.length > 0}
					{#each playerHand as card, i}
						{#if i < visiblePlayer}
							{#if flippedCards.has(`p${i}`)}
								{@render faceUpCard(card, `p${i}`)}
							{:else}
								{@render cardBack(false)}
							{/if}
						{/if}
					{/each}
				{:else}
					<div class="h-24 sm:h-28"></div>
				{/if}
			</div>
		</div>

		<!-- Dealer hand -->
		<div class="mb-2">
			<p class="mb-1 table-label">
				เจ้ามือ
				{#if visibleDealer >= 3 && flippedCards.has('d2')}
					({handPoints(dealerHand)} แต้ม)
					{#if dealerType !== 'normal'}
						<span class="inline-block ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold {typeBadgeClass(dealerType)}">{handTypeName(dealerType)}</span>
					{/if}
				{/if}
			</p>
			<div class="flex gap-2.5 sm:gap-3 transition-all duration-300 {winSide === 'player' ? 'opacity-50 scale-95' : ''}">
				{#if dealerHand.length > 0}
					{#each dealerHand as card, i}
						{#if i < visibleDealer}
							{#if flippedCards.has(`d${i}`)}
								{@render faceUpCard(card, `d${i}`)}
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
		<div class="mb-4 flex w-full items-center gap-2 sm:gap-3">
			<div class="flex items-center gap-0 rounded-xl border border-slot-border bg-slot-surface casino-shadow">
				<button onclick={decreaseBet} class="cursor-pointer rounded-l-xl px-2.5 py-1.5 text-base font-bold text-slot-muted transition hover:text-slot-text disabled:cursor-not-allowed disabled:opacity-30 sm:px-3 sm:py-2 sm:text-lg">−</button>
				<div class="flex min-w-[3.5rem] flex-col items-center border-x border-slot-border px-1 sm:min-w-[4.5rem]">
					<span class="text-[9px] uppercase tracking-wider text-slot-muted">BET</span>
					<input type="number" bind:value={bet} onblur={validateBet} min="1" class="w-full bg-transparent text-center text-sm font-bold tabular-nums outline-none disabled:opacity-60 sm:text-base [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
				</div>
				<button onclick={increaseBet} class="cursor-pointer rounded-r-xl px-2.5 py-1.5 text-base font-bold text-slot-muted transition hover:text-slot-text disabled:cursor-not-allowed disabled:opacity-30 sm:px-3 sm:py-2 sm:text-lg">+</button>
			</div>
			<button onclick={play} disabled={wallet.credit < bet} class="flex-1 cursor-pointer rounded-xl bg-slot-accent px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:text-base">แจกไพ่</button>
		</div>
	{:else if phase === 'dealing'}
		<div class="w-full text-center text-sm text-slot-muted animate-pulse">กำลังแจกไพ่...</div>
	{:else}
		<button onclick={newGame} class="w-full cursor-pointer rounded-xl bg-slot-accent px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] sm:text-base">เล่นใหม่</button>
	{/if}

	<div class="mt-4 w-full rounded-xl border border-slot-border bg-slot-surface p-3 text-xs text-slot-muted casino-shadow">
		<p class="font-medium text-slot-text">วิธีเล่นเก้าเก</p>
		<p class="mt-1">แต่ละฝ่ายได้ไพ่ 3 ใบ แต้มรวม mod 10 สูงกว่าชนะ</p>
		<p>ธรรมดา/สี = x2 | เรียง/เซียน = x3 | สีเรียง/ตอง = x5</p>
		<p>ตอง 3 (3+3+3=9) แรงที่สุด!</p>
	</div>
</div>
