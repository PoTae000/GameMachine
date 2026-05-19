<script lang="ts">
	import { PAYOUTS, HAND_RANKS, evaluateHand, type Card } from '$lib/games/videoPokerEngine';
	import { renderCard, renderCardBack } from '$lib/cardSvg';
	import { wallet, stats, gameInProgress } from '$lib/store.svelte';
	import { playBet, playCardFlip, playCardDeal, playCardShuffle, playSuspenseLong, playHeartbeat, playWin, playLose, playBigWin } from '$lib/sounds';

	const BET_OPTIONS = [1, 5, 10, 20, 50, 100, 200, 500];

	let bet = $state(BET_OPTIONS[0]);
	let phase: 'betting' | 'dealing' | 'holding' | 'drawing' | 'result' = $state('betting');
	let hand: Card[] = $state([]);
	let holds: boolean[] = $state([false, false, false, false, false]);
	let flipped: boolean[] = $state([false, false, false, false, false]);
	let handRank = $state('');
	let message = $state('');
	let messageType: 'win' | 'lose' | 'info' | '' = $state('');
	let highlightRank = $state('');
	let cardGlow: boolean[] = $state([false, false, false, false, false]);

	// Deck shuffle + chip animation state
	let showDeck = $state(false);
	let deckPhase: 'idle' | 'riffle' | 'wash' | 'riffle2' | 'cut' = $state('idle');
	let showBigWin = $state(false);
	let bigWinAmount = $state(0);
	let creditBefore = 0;

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

	async function deal() {
		if (wallet.credit < bet) return;

		creditBefore = wallet.credit;
		gameInProgress.value = true;
		message = '';
		messageType = '';
		handRank = '';
		highlightRank = '';
		holds = [false, false, false, false, false];
		flipped = [false, false, false, false, false];
		cardGlow = [false, false, false, false, false];
		phase = 'dealing';
		playBet();

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
		const res = await fetch('/api/games/videopoker/deal', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ bet })
		});
		const data = await res.json();
		if (!res.ok) {
			message = data.error || 'เกิดข้อผิดพลาด';
			messageType = 'info';
			gameInProgress.value = false;
			phase = 'betting';
			return;
		}

		hand = data.hand;

		// Deal cards one by one with stagger
		for (let i = 0; i < 5; i++) {
			await delay(180);
			playCardDeal();
			flipped[i] = true;
			flipped = [...flipped];
		}

		await delay(400);
		phase = 'holding';
	}

	function toggleHold(idx: number) {
		if (phase !== 'holding') return;
		holds[idx] = !holds[idx];
		holds = [...holds];
	}

	async function draw() {
		if (phase !== 'holding') return;
		phase = 'drawing';

		// Flip non-held cards face down
		for (let i = 0; i < 5; i++) {
			if (!holds[i]) {
				flipped[i] = false;
				flipped = [...flipped];
			}
		}
		await delay(400);

		// Call server API to draw
		const res = await fetch('/api/games/videopoker/draw', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ holds })
		});
		const data = await res.json();
		if (!res.ok) {
			phase = 'holding';
			return;
		}

		hand = data.hand;

		// Flip new cards face up with suspense
		for (let i = 0; i < 5; i++) {
			if (!holds[i]) {
				playHeartbeat();
				await delay(350);
				playCardFlip();
				flipped[i] = true;
				flipped = [...flipped];
				await delay(150);
			}
		}

		await delay(500);
		phase = 'result';
		const rank = data.handRank;
		handRank = rank;
		highlightRank = rank;
		const multiplier = data.multiplier;

		// Glow winning cards
		if (multiplier > 0) {
			cardGlow = [true, true, true, true, true];
		}

		wallet.credit = data.newCredit;
		if (data.stats) {
			stats.totalSpent = data.stats.totalSpent;
			stats.totalReceived = data.stats.totalReceived;
		}

		if (data.won) {
			const profit = data.payout - bet;
			message = `${rank} — ชนะ +${profit.toLocaleString()} (x${multiplier})`;
			messageType = 'win';
			if (profit > creditBefore * 0.5 && profit > 0) { bigWinAmount = profit; showBigWin = true; playBigWin(); } else { playWin(); }
		} else {
			message = 'ไม่ได้รางวัล';
			messageType = 'lose';
			playLose();
		}
		gameInProgress.value = false;
	}

	function newGame() {
		gameInProgress.value = false;
		phase = 'betting';
		hand = [];
		holds = [false, false, false, false, false];
		flipped = [false, false, false, false, false];
		handRank = '';
		highlightRank = '';
		message = '';
		messageType = '';
		cardGlow = [false, false, false, false, false];
		showDeck = false;
		deckPhase = 'idle';
	}

	function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
</script>

<svelte:head><title>Video Poker - BUNG TAE DUBAI</title></svelte:head>

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
	<h2 class="mb-3 text-lg font-bold text-slot-accent sm:text-xl">Video Poker</h2>

	<!-- Paytable -->
	<div class="mb-3 w-full overflow-hidden rounded-xl border border-slot-border casino-shadow">
		<div class="poker-paytable-header px-3 py-1.5 text-center">
			<span class="text-[10px] font-bold uppercase tracking-wider text-amber-200/80">Paytable</span>
		</div>
		{#each HAND_RANKS.filter(r => r !== 'No Win') as rank, i}
			<div class="flex items-center justify-between px-3 py-1.5 text-xs transition-all duration-300
				{i > 0 ? 'border-t border-slot-border/50' : ''}
				{highlightRank === rank ? 'poker-paytable-win' : 'bg-slot-surface text-slot-muted'}">
				<span class="{highlightRank === rank ? 'font-bold' : ''}">{rank}</span>
				<span class="tabular-nums font-bold">x{PAYOUTS[rank]}</span>
			</div>
		{/each}
	</div>

	<!-- Poker table area -->
	<div class="relative poker-table mb-3 w-full rounded-2xl p-5 sm:p-6 min-h-[200px] sm:min-h-[240px] casino-felt casino-felt-gold">
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
			<div class="absolute top-3 right-3 z-10">
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
		<!-- Cards -->
		{#if hand.length > 0}
			<div class="mb-2 flex gap-1.5 sm:gap-2.5 justify-center">
				{#each hand as card, i}
					<div class="flex flex-col items-center gap-1.5">
						<div class="poker-card-wrap animate-deal {flipped[i] ? 'poker-card-flipped' : ''}
							{cardGlow[i] && phase === 'result' ? 'poker-card-glow' : ''}"
							style="--deal-x: 80px; --deal-y: -60px; {cardGlow[i] ? '--glow-color: #16a34a' : ''}">
							<div class="poker-card-inner" style="transform: rotateY({flipped[i] ? 0 : 180}deg);">
								<div class="poker-card-front">
									{@html renderCard(card.suit, card.rank, 56, 80)}
								</div>
								<div class="poker-card-back">
									{@html renderCardBack(56, 80)}
								</div>
							</div>
						</div>
						{#if phase === 'holding'}
							<button
								onclick={() => toggleHold(i)}
								class="poker-hold-btn cursor-pointer rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-all
									{holds[i] ? 'poker-hold-active' : 'poker-hold-inactive'}"
							>
								{holds[i] ? 'HELD' : 'HOLD'}
							</button>
						{:else if holds[i] && (phase === 'drawing' || phase === 'result')}
							<span class="rounded-md bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700">HELD</span>
						{/if}
					</div>
				{/each}
			</div>
		{:else}
			<div class="flex h-24 items-center justify-center text-sm text-white/30">กด Deal เพื่อเริ่มเกม</div>
		{/if}

		{#if handRank && handRank !== 'No Win'}
			<div class="mt-2 text-center animate-bounce-in">
				<span class="inline-block rounded-full bg-green-500/20 px-4 py-1 text-sm font-black text-green-300 ring-1 ring-green-500/30">{handRank}</span>
			</div>
		{/if}
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
				<button onclick={decreaseBet} class="cursor-pointer rounded-l-xl px-2.5 py-1.5 text-base font-bold text-slot-muted transition hover:text-slot-text sm:px-3 sm:py-2 sm:text-lg">−</button>
				<div class="flex min-w-[3.5rem] flex-col items-center border-x border-slot-border px-1 sm:min-w-[4.5rem]">
					<span class="text-[9px] uppercase tracking-wider text-slot-muted">BET</span>
					<input type="number" bind:value={bet} onblur={validateBet} min="1" class="w-full bg-transparent text-center text-sm font-bold tabular-nums outline-none sm:text-base [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
				</div>
				<button onclick={increaseBet} class="cursor-pointer rounded-r-xl px-2.5 py-1.5 text-base font-bold text-slot-muted transition hover:text-slot-text sm:px-3 sm:py-2 sm:text-lg">+</button>
			</div>
			<button onclick={deal} disabled={wallet.credit < bet} class="poker-deal-btn flex-1 cursor-pointer rounded-xl px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:text-base">DEAL</button>
		</div>
	{:else if phase === 'holding'}
		<button onclick={draw} class="poker-draw-btn w-full cursor-pointer rounded-xl px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] casino-shadow sm:text-base">DRAW</button>
		{:else if phase === 'result'}
		<button onclick={newGame} class="w-full cursor-pointer rounded-xl bg-slot-accent px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] casino-shadow sm:text-base">เล่นใหม่</button>
	{:else}
		<div class="w-full text-center text-sm text-slot-muted animate-pulse">
			{phase === 'dealing' ? 'กำลังแจกไพ่...' : 'กำลังเปลี่ยนไพ่...'}
		</div>
	{/if}

	<div class="mt-4 w-full rounded-xl border border-slot-border bg-slot-surface p-3 text-xs text-slot-muted casino-shadow">
		<p class="font-medium text-slot-text">วิธีเล่น</p>
		<p class="mt-1">กด Deal → ได้ 5 ใบ → เลือก HOLD ใบที่เก็บ → กด Draw เปลี่ยนใบที่เหลือ</p>
		<p>Royal Flush x250 | Straight Flush x50 | 4 of a Kind x25</p>
	</div>
</div>

<style>
	.poker-table {
		position: relative;
	}
	.poker-table::before {
		content: '';
		position: absolute;
		inset: 4px;
		border-radius: 14px;
		border: 1px solid rgba(255,255,255,0.06);
		pointer-events: none;
	}
	.poker-paytable-header {
		background: linear-gradient(135deg, #78350f, #92400e, #78350f);
	}
	.poker-paytable-win {
		background: linear-gradient(90deg, rgba(34,197,94,0.15), rgba(34,197,94,0.25), rgba(34,197,94,0.15));
		color: #16a34a;
		font-weight: 700;
		animation: win-flash 0.6s ease-out;
	}
	.poker-card-wrap {
		width: 56px;
		height: 80px;
		perspective: 600px;
		transition: transform 0.2s;
	}
	.poker-card-wrap:hover {
		transform: translateY(-2px);
	}
	.poker-card-glow {
	}
	.poker-card-inner {
		position: relative;
		width: 100%;
		height: 100%;
		transform-style: preserve-3d;
		transition: transform 0.45s cubic-bezier(0.4, 0, 0.2, 1);
	}
	.poker-card-front {
		position: absolute;
		top: 0;
		left: 0;
		backface-visibility: hidden;
	}
	.poker-card-back {
		position: absolute;
		top: 0;
		left: 0;
		backface-visibility: hidden;
		transform: rotateY(180deg);
	}
	.poker-hold-btn {
		min-width: 42px;
	}
	.poker-hold-active {
		background: linear-gradient(135deg, #fbbf24, #f59e0b);
		color: #78350f;
		box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
	}
	.poker-hold-inactive {
		background: rgba(255,255,255,0.1);
		color: rgba(255,255,255,0.5);
		border: 1px solid rgba(255,255,255,0.15);
	}
	.poker-deal-btn {
		background: linear-gradient(135deg, #6d28d9, #7c3aed);
		box-shadow: 0 4px 15px rgba(109, 40, 217, 0.4);
	}
	.poker-draw-btn {
		background: linear-gradient(135deg, #16a34a, #22c55e);
		box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4);
	}
</style>
