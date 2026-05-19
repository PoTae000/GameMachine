<script lang="ts">
	import {
		handValue,
		isBlackjack,
		isBust,
		getMultiplier,
		suitSymbol,
		suitColor,
		type Card,
		type GameResult
	} from '$lib/games/blackjackEngine';
	import { wallet, stats, gameInProgress } from '$lib/store.svelte';
	import { renderCard, renderCardBack } from '$lib/cardSvg';
	import { playBet, playCardFlip, playCardDeal, playCardShuffle, playSuspense, playSuspenseLong, playHeartbeat, playWin, playLose, playBigWin } from '$lib/sounds';

	const BET_OPTIONS = [1, 5, 10, 20, 50, 100, 200, 500];

	let bet = $state(BET_OPTIONS[0]);
	let betBeforeDouble = $state(0);
	let playerHand: Card[] = $state([]);
	let dealerHand: Card[] = $state([]);
	let phase: 'betting' | 'dealing' | 'playing' | 'dealer' | 'result' = $state('betting');
	let result: GameResult | null = $state(null);
	let message = $state('');
	let messageType: 'win' | 'lose' | 'info' | '' = $state('');
	let showDealerCards = $state(false);
	let visiblePlayerCards = $state(0);
	let visibleDealerCards = $state(0);
	let revealingDealer = $state(false);

	// Suspense animation states
	let flippedCards = $state(new Set<string>());
	let glowingDealerBack = $state(false);
	let lastDealerHeartbeat = $state(false);
	let bustShake = $state(false);
	let resultGlow: 'win' | 'lose' | '' = $state('');

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
		playBet();
		gameInProgress.value = true;
		message = '';
		messageType = '';
		result = null;
		showDealerCards = false;
		visiblePlayerCards = 0;
		visibleDealerCards = 0;
		revealingDealer = false;
		flippedCards = new Set();
		glowingDealerBack = false;
		lastDealerHeartbeat = false;
		bustShake = false;
		resultGlow = '';
		// Clear old cards before shuffle so table is clean
		playerHand = [];
		dealerHand = [];

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
		const res = await fetch('/api/games/blackjack/deal', {
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
		dealerHand = data.dealerHand;

		// Suspense dealing animation with card-flip
		phase = 'dealing';
		await delay(400);
		visiblePlayerCards = 1;
		flippedCards = new Set(['p0']);
		playCardDeal();
		await delay(500);
		visibleDealerCards = 1;
		flippedCards = new Set([...flippedCards, 'd0']);
		playCardDeal();
		await delay(500);
		visiblePlayerCards = 2;
		flippedCards = new Set([...flippedCards, 'p1']);
		playCardDeal();
		await delay(500);
		visibleDealerCards = 2;
		// Don't flip dealer's second card yet (face down)
		await delay(300);

		if (data.phase === 'result') {
			// Immediate blackjack resolution - server already resolved
			showDealerCards = true;
			await revealDealerCardsAnimated();
			await delay(400);
			handleResult(data);
			return;
		}

		phase = 'playing';
	}

	async function hit() {
		const res = await fetch('/api/games/blackjack/action', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'hit' })
		});
		const data = await res.json();
		if (!res.ok) return;

		playerHand = data.playerHand;
		visiblePlayerCards = playerHand.length;
		flippedCards = new Set([...flippedCards, `p${playerHand.length - 1}`]);
		playCardDeal();

		if (data.phase === 'result') {
			dealerHand = data.dealerHand;
			bustShake = true;
			showDealerCards = true;
			visibleDealerCards = dealerHand.length;
			handleResult(data);
		}
	}

	async function stand() {
		showDealerCards = true;

		const res = await fetch('/api/games/blackjack/action', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'stand' })
		});
		const data = await res.json();
		if (!res.ok) return;

		dealerHand = data.dealerHand;
		playerHand = data.playerHand;

		// Animate dealer card reveals
		await revealDealerCardsAnimated();

		// Show any extra dealer-drawn cards with suspense
		phase = 'dealer';
		if (dealerHand.length > visibleDealerCards) {
			for (let i = visibleDealerCards; i < dealerHand.length; i++) {
				visibleDealerCards = i + 1;
				lastDealerHeartbeat = true;
				glowingDealerBack = true;
				playHeartbeat();
				playSuspense();
				await delay(800);
				lastDealerHeartbeat = false;
				glowingDealerBack = false;
				flippedCards = new Set([...flippedCards, `d${i}`]);
				playCardFlip();
				await delay(700);
			}
		}
		await delay(800);
		handleResult(data);
	}

	async function doubleDown() {
		if (wallet.credit < bet) {
			message = 'บาทไม่พอสำหรับ Double';
			messageType = 'info';
			return;
		}

		const res = await fetch('/api/games/blackjack/action', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'double' })
		});
		const data = await res.json();
		if (!res.ok) return;

		betBeforeDouble = bet;
		bet = bet * 2;
		playerHand = data.playerHand;
		dealerHand = data.dealerHand;
		visiblePlayerCards = playerHand.length;
		flippedCards = new Set([...flippedCards, `p${playerHand.length - 1}`]);
		playCardDeal();
		showDealerCards = true;

		await revealDealerCardsAnimated();

		if (isBust(playerHand)) {
			bustShake = true;
			handleResult(data);
		} else {
			// Show any extra dealer-drawn cards with suspense
			phase = 'dealer';
			if (dealerHand.length > visibleDealerCards) {
				for (let i = visibleDealerCards; i < dealerHand.length; i++) {
					visibleDealerCards = i + 1;
					lastDealerHeartbeat = true;
					glowingDealerBack = true;
					playHeartbeat();
					playSuspense();
					await delay(800);
					lastDealerHeartbeat = false;
					glowingDealerBack = false;
					flippedCards = new Set([...flippedCards, `d${i}`]);
					playCardFlip();
					await delay(700);
				}
			}
			await delay(800);
			handleResult(data);
		}
	}

	async function revealDealerCardsAnimated() {
		revealingDealer = true;
		for (let i = 0; i < dealerHand.length; i++) {
			visibleDealerCards = i + 1;
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
			flippedCards = new Set([...flippedCards, `d${i}`]);
			playCardFlip();
			await delay(i === dealerHand.length - 1 ? 600 : 700);
		}
		revealingDealer = false;
	}

	function handleResult(data: any) {
		phase = 'result';
		const r = data.result as GameResult;
		result = r;
		const creditBefore = wallet.credit;
		const payout = data.payout ?? 0;

		wallet.credit = data.newCredit;
		if (data.stats) {
			stats.totalSpent = data.stats.totalSpent;
			stats.totalReceived = data.stats.totalReceived;
		}

		const net = payout - bet;
		if (r === 'blackjack') {
			resultGlow = 'win';
			message = `แบล็คแจ็ค! +${net.toLocaleString()}`;
			messageType = 'win';
			playWin();
			if (net > creditBefore * 0.5) {
				bigWinAmount = net;
				showBigWin = true;
				playBigWin();
			}
		} else if (r === 'win') {
			resultGlow = 'win';
			message = `ชนะ! +${net.toLocaleString()}`;
			messageType = 'win';
			playWin();
			if (net > creditBefore * 0.5) {
				bigWinAmount = net;
				showBigWin = true;
				playBigWin();
			}
		} else if (r === 'push') {
			message = 'เสมอ — ได้เงินคืน';
			messageType = 'info';
		} else {
			resultGlow = 'lose';
			bustShake = true;
			message = `แพ้ เสีย ${bet.toLocaleString()}`;
			messageType = 'lose';
			playLose();
		}
		gameInProgress.value = false;

		// Restore bet if it was doubled
		if (betBeforeDouble > 0) {
			bet = betBeforeDouble;
			betBeforeDouble = 0;
		}
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
		result = null;
		message = '';
		messageType = '';
		showDealerCards = false;
		visiblePlayerCards = 0;
		visibleDealerCards = 0;
		flippedCards = new Set();
		glowingDealerBack = false;
		lastDealerHeartbeat = false;
		bustShake = false;
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
	<title>Blackjack - BUNG TAE DUBAI</title>
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
	<h2 class="mb-4 text-lg font-bold text-slot-accent sm:text-xl">Blackjack แบล็คแจ็ค</h2>

	<!-- Card Table -->
	<div class="relative mb-4 w-full rounded-2xl p-5 sm:p-6 min-h-[280px] sm:min-h-[320px] casino-felt casino-felt-gold">
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
		<p class="mb-1 table-label">เจ้ามือ {dealerHand.length > 0 && showDealerCards ? `(${handValue(dealerHand)})` : ''}</p>
		<div class="flex gap-2.5 sm:gap-3 {bustShake && resultGlow === 'lose' && isBust(dealerHand) ? 'animate-shake' : ''}">
			{#if dealerHand.length > 0}
				{#each dealerHand as card, i}
					{#if i < visibleDealerCards}
						{#if i === 0 || showDealerCards}
							{@render faceUpCard(card, `d${i}`)}
						{:else}
							{@render cardBack(i === visibleDealerCards - 1)}
						{/if}
					{/if}
				{/each}
				{#if visibleDealerCards < dealerHand.length}
					{@render cardBack(true)}
				{/if}
			{:else}
				<div class="h-24 sm:h-28"></div>
			{/if}
		</div>
	</div>

	<!-- Player hand -->
	<div class="mb-2">
		<p class="mb-1 table-label">
			ผู้เล่น {playerHand.length > 0 ? `(${handValue(playerHand)})` : ''}
			{#if playerHand.length > 0 && isBust(playerHand)} - บัสต์!{/if}
		</p>
		<div class="flex gap-2.5 sm:gap-3 {bustShake && isBust(playerHand) ? 'animate-shake' : ''}
			{resultGlow === 'win' ? 'result-glow-win' : ''}
			{resultGlow === 'lose' && !isBust(playerHand) ? 'result-glow-lose' : ''}">
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
				onclick={hit}
				class="flex-1 cursor-pointer rounded-xl bg-slot-accent px-4 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] sm:text-base"
			>
				จั่วไพ่
			</button>
			<button
				onclick={stand}
				class="flex-1 cursor-pointer rounded-xl border-2 border-slot-accent bg-transparent px-4 py-3 text-sm font-bold text-slot-accent transition hover:bg-slot-accent/10 active:scale-[0.98] sm:text-base"
			>
				หยุด
			</button>
			{#if playerHand.length === 2 && wallet.credit >= bet}
				<button
					onclick={doubleDown}
					class="flex-1 cursor-pointer rounded-xl bg-slot-lose px-4 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] sm:text-base"
				>
					ดับเบิ้ล
				</button>
			{/if}
		</div>
		{:else if phase === 'dealer'}
		<div class="w-full text-center text-sm text-slot-muted animate-pulse">เจ้ามือกำลังจั่วไพ่...</div>
	{:else if phase === 'result'}
		<button
			onclick={newGame}
			class="w-full cursor-pointer rounded-xl bg-slot-accent px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] sm:text-base"
		>
			เล่นใหม่
		</button>
	{/if}

	<div class="mt-4 w-full rounded-xl border border-slot-border bg-slot-surface p-3 text-xs text-slot-muted casino-shadow">
		<p class="font-medium text-slot-text">วิธีเล่น</p>
		<p class="mt-1">เป้าหมาย: แต้มรวมใกล้ 21 มากที่สุด ไม่เกิน</p>
		<p>แบล็คแจ็ค = x2.5 | ชนะ = x2 | เสมอ = คืนเงิน</p>
	</div>
</div>
