<script lang="ts">
	import { getMultiplier, suitSymbol, suitColor, type Card, type DTBet, type DTResult } from '$lib/games/dragonTigerEngine';
	import { wallet, stats, gameInProgress } from '$lib/store.svelte';
	import { renderCard, renderCardBack } from '$lib/cardSvg';
	import { playBet, playCardFlip, playCardDeal, playCardShuffle, playSuspense, playSuspenseLong, playHeartbeat, playWin, playLose, playBigWin } from '$lib/sounds';

	const BET_OPTIONS = [1, 5, 10, 20, 50, 100, 200, 500];

	let bet = $state(BET_OPTIONS[0]);
	let selectedBet: DTBet | null = $state(null);
	let dragonCard: Card | null = $state(null);
	let tigerCard: Card | null = $state(null);
	let phase: 'betting' | 'dealing' | 'result' = $state('betting');
	let message = $state('');
	let messageType: 'win' | 'lose' | 'info' | '' = $state('');
	let showDragon = $state(false);
	let showTiger = $state(false);

	// Suspense animation states
	let dragonFlipped = $state(false);
	let tigerFlipped = $state(false);
	let tigerHeartbeat = $state(false);
	let tigerGlow = $state(false);
	let tigerShake = $state(false);
	let winSide: 'dragon' | 'tiger' | '' = $state('');
	let loseSide: 'dragon' | 'tiger' | '' = $state('');

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
		showDragon = false;
		showTiger = false;
		dragonFlipped = false;
		tigerFlipped = false;
		tigerHeartbeat = false;
		tigerGlow = false;
		tigerShake = false;
		winSide = '';
		loseSide = '';
		phase = 'dealing';

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
		const res = await fetch('/api/games/dragontiger/play', {
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

		dragonCard = data.outcome.dragon;
		tigerCard = data.outcome.tiger;


		// Dragon card: deal onto table then flip face-up
		await delay(600);
		showDragon = true;
		playCardDeal();
		await delay(500);
		dragonFlipped = true;
		playCardFlip();

		// Tiger card: deal card back onto table with heartbeat + glow suspense
		await delay(800);
		showTiger = true; // Show as card back first
		playCardDeal();
		await delay(400);
		tigerHeartbeat = true;
		tigerGlow = true;
		playHeartbeat();
		await delay(600);
		playSuspenseLong();
		await delay(800);

		// Shake before reveal
		tigerHeartbeat = false;
		tigerShake = true;
		playHeartbeat();
		await delay(600);
		tigerShake = false;
		tigerGlow = false;

		// Flip tiger card
		tigerFlipped = true;
		playCardFlip();
		await delay(800);

		phase = 'result';
		const result: DTResult = data.outcome.result;

		// Set win/lose glow
		if (result === 'dragon') { winSide = 'dragon'; loseSide = 'tiger'; }
		else if (result === 'tiger') { winSide = 'tiger'; loseSide = 'dragon'; }

		const creditBefore = wallet.credit;

		if (data.won) {
			const profit = data.payout - bet;
			message = `${result === 'dragon' ? 'มังกร' : result === 'tiger' ? 'เสือ' : 'เสมอ'}ชนะ! +${profit.toLocaleString()}`;
			messageType = 'win';
			playWin();
			if (profit > creditBefore * 0.5) { bigWinAmount = profit; showBigWin = true; playBigWin(); }
		} else if (result === 'tie' && selectedBet !== 'tie') {
			message = 'เสมอ — ได้คืนครึ่ง';
			messageType = 'info';
		} else {
			message = `${result === 'dragon' ? 'มังกร' : result === 'tiger' ? 'เสือ' : 'เสมอ'}ชนะ — เสีย ${bet.toLocaleString()}`;
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
		dragonCard = null;
		tigerCard = null;
		message = '';
		messageType = '';
		showDragon = false;
		showTiger = false;
		dragonFlipped = false;
		tigerFlipped = false;
		tigerHeartbeat = false;
		tigerGlow = false;
		tigerShake = false;
		winSide = '';
		loseSide = '';
		showDeck = false;
		deckPhase = 'idle';
	}

	function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
</script>

<svelte:head><title>Dragon Tiger - BUNG TAE DUBAI</title></svelte:head>

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
	<h2 class="mb-4 text-lg font-bold text-slot-accent sm:text-xl">Dragon Tiger เสือมังกร</h2>

	<!-- Card Table -->
	<div class="relative mb-4 w-full rounded-2xl dt-table p-5 sm:p-6 min-h-[240px] sm:min-h-[280px] casino-felt casino-felt-gold">
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
	<div class="flex items-center justify-center gap-4 sm:gap-6">
		<div class="text-center">
			<p class="mb-1 table-label">มังกร</p>
			{#if showDragon && dragonCard && dragonFlipped}
				<div class="h-28 w-20 rounded-lg overflow-hidden shadow-lg sm:h-32 sm:w-24 animate-card-flip animate-deal transition-all duration-300
					{loseSide === 'dragon' ? 'opacity-50 scale-95' : ''}"
					style="--deal-x: 80px; --deal-y: -60px;">
					{@html renderCard(dragonCard.suit, dragonCard.display, 80, 112)}
				</div>
			{:else if showDragon}
				<div class="h-28 w-20 rounded-lg overflow-hidden shadow-lg sm:h-32 sm:w-24 animate-deal"
					style="--deal-x: 80px; --deal-y: -60px;">
					{@html renderCardBack(80, 112)}
				</div>
			{:else}
				<div class="h-28 w-20 sm:h-32 sm:w-24"></div>
			{/if}
		</div>

		<span class="text-xl font-bold text-white/40">VS</span>

		<div class="text-center">
			<p class="mb-1 table-label">เสือ</p>
			{#if showTiger && tigerCard && tigerFlipped}
				<div class="h-28 w-20 rounded-lg overflow-hidden shadow-lg sm:h-32 sm:w-24 animate-card-flip animate-deal transition-all duration-300
					{loseSide === 'tiger' ? 'opacity-50 scale-95' : ''}"
					style="--deal-x: 80px; --deal-y: -60px;">
					{@html renderCard(tigerCard.suit, tigerCard.display, 80, 112)}
				</div>
			{:else if showTiger}
				<div class="h-28 w-20 rounded-lg overflow-hidden shadow-lg sm:h-32 sm:w-24
					{tigerHeartbeat ? 'animate-heartbeat' : ''}
					{tigerGlow ? 'animate-glow' : ''}
					{tigerShake ? 'animate-shake' : ''}"
					style={tigerGlow ? '--glow-color: #eab308' : ''}>
					{@html renderCardBack(80, 112)}
				</div>
			{:else}
				<div class="h-28 w-20 sm:h-32 sm:w-24"></div>
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
				<button onclick={() => (selectedBet = 'dragon')} class="cursor-pointer rounded-lg border px-3 py-3 text-sm font-bold transition {selectedBet === 'dragon' ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-slot-border bg-slot-surface text-slot-text hover:border-blue-400/40'}">มังกร x2</button>
				<button onclick={() => (selectedBet = 'tie')} class="cursor-pointer rounded-lg border px-3 py-3 text-sm font-bold transition {selectedBet === 'tie' ? 'border-slot-accent bg-slot-accent/10 text-slot-accent' : 'border-slot-border bg-slot-surface text-slot-text hover:border-slot-accent/40'}">เสมอ x8</button>
				<button onclick={() => (selectedBet = 'tiger')} class="cursor-pointer rounded-lg border px-3 py-3 text-sm font-bold transition {selectedBet === 'tiger' ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-slot-border bg-slot-surface text-slot-text hover:border-red-400/40'}">เสือ x2</button>
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
		<div class="w-full text-center text-sm text-slot-muted animate-pulse">กำลังเปิดไพ่...</div>
	{:else}
		<button onclick={newGame} class="w-full cursor-pointer rounded-xl bg-slot-accent px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] sm:text-base">เล่นใหม่</button>
	{/if}

	<div class="mt-4 w-full rounded-xl border border-slot-border bg-slot-surface p-3 text-xs text-slot-muted casino-shadow">
		<p class="font-medium text-slot-text">วิธีเล่น</p>
		<p class="mt-1">ไพ่ใบเดียว ฝั่งไหนสูงกว่าชนะ เรียบง่าย เร็วทันใจ</p>
		<p>มังกร/เสือ = x2 | เสมอ = x8 (เสมอคืนครึ่ง)</p>
	</div>
</div>
