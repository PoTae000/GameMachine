<script lang="ts">
	import { LOTTERY_GRID, PICK_COUNT, DRAW_COUNT, getMultiplier, countMatches } from '$lib/games/lotteryEngine';
	import { wallet, stats, gameInProgress } from '$lib/store.svelte';
	import { playBet, playTick, playWin, playLose, playBigWin } from '$lib/sounds';

	const BET_OPTIONS = [1, 5, 10, 20, 50, 100, 200, 500];

	let bet = $state(BET_OPTIONS[0]);
	let picks: number[] = $state([]);
	let drawn: number[] = $state([]);
	let revealedDrawn: number[] = $state([]);
	let phase: 'picking' | 'drawing' | 'result' = $state('picking');
	let message = $state('');
	let messageType: 'win' | 'lose' | 'info' | '' = $state('');
	let matches = $state(0);
	let lastRevealed = $state(-1);

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

	function togglePick(n: number) {
		if (phase !== 'picking') return;
		if (picks.includes(n)) {
			picks = picks.filter((p) => p !== n);
		} else if (picks.length < PICK_COUNT) {
			picks = [...picks, n];
		}
	}

	function randomPicks() {
		if (phase !== 'picking') return;
		const pool = Array.from({ length: LOTTERY_GRID }, (_, i) => i + 1);
		const shuffled = pool.sort(() => Math.random() - 0.5);
		picks = shuffled.slice(0, PICK_COUNT).sort((a, b) => a - b);
	}

	async function play() {
		if (picks.length !== PICK_COUNT || wallet.credit < bet) return;

		const creditBefore = wallet.credit;
		gameInProgress.value = true;
		message = '';
		messageType = '';
		revealedDrawn = [];
		lastRevealed = -1;
		phase = 'drawing';

		// Call server API
		const res = await fetch('/api/games/lottery/play', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ bet, picks })
		});
		const data = await res.json();
		if (!res.ok) { message = data.error || 'error'; messageType = 'info'; phase = 'picking'; gameInProgress.value = false; return; }


		playBet();
		drawn = data.outcome.drawn;

		// Reveal balls one by one with a simple tick sound
		for (let i = 0; i < drawn.length; i++) {
			await delay(500);
			playTick();
			lastRevealed = drawn[i];
			revealedDrawn = [...revealedDrawn, drawn[i]];
		}

		await delay(600);
		lastRevealed = -1;
		phase = 'result';
		gameInProgress.value = false;
		matches = data.outcome.matches;
		const mult = data.outcome.multiplier;

		// Set final credit and stats from server
		wallet.credit = data.newCredit;
		stats.totalSpent = data.stats.totalSpent;
		stats.totalReceived = data.stats.totalReceived;

		if (mult > 0) {
			const profit = data.payout - bet;
			message = `ตรง ${matches}/${PICK_COUNT} — ชนะ +${profit.toLocaleString()} (x${mult})`;
			messageType = 'win';
			if (profit > creditBefore * 0.5 && profit > 0) { bigWinAmount = profit; showBigWin = true; playBigWin(); } else { playWin(); }
		} else {
			message = `ตรง ${matches}/${PICK_COUNT} — ไม่ถูกรางวัล`;
			messageType = 'lose';
			playLose();
		}
	}

	function newGame() {
		phase = 'picking';
		picks = [];
		drawn = [];
		revealedDrawn = [];
		message = '';
		messageType = '';
		matches = 0;
		lastRevealed = -1;
	}

	function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
</script>

<svelte:head><title>Lottery - BUNG TAE DUBAI</title></svelte:head>

{#if showBigWin}
	<div class="animate-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
		<div class="animate-modal w-full max-w-sm rounded-2xl bg-gradient-to-b from-yellow-900/90 to-yellow-950/95 p-6 text-center shadow-2xl border border-yellow-500/40">
			<div class="mb-2 text-5xl">🎉</div>
			<p class="mb-1 text-lg font-bold text-yellow-400">BIG WIN!</p>
			<p class="my-3 text-4xl font-black tabular-nums text-yellow-300 sm:text-5xl">+{bigWinAmount.toLocaleString()}</p>
			<p class="mb-4 text-sm text-yellow-500/80">บาท</p>
			<button onclick={() => (showBigWin = false)} class="cursor-pointer rounded-xl bg-yellow-500 px-8 py-2.5 text-sm font-bold text-black transition hover:bg-yellow-400 active:scale-[0.98]">เยี่ยม!</button>
		</div>
	</div>
{/if}

<div class="flex flex-col items-center select-none">
	<h2 class="mb-3 text-lg font-bold text-slot-accent sm:text-xl">Lottery ลอตเตอรี่</h2>

	<!-- Ball display area -->
	<div class="mb-3 flex min-h-[4rem] w-full items-center justify-center gap-2.5 rounded-2xl border border-slot-border bg-slot-surface px-4 py-3">
		{#if phase === 'picking'}
			{#if picks.length === 0}
				<span class="text-xs text-slot-muted">เลือกตัวเลข {PICK_COUNT} ตัว</span>
			{:else}
				{#each Array(PICK_COUNT) as _, i}
					{#if i < picks.length}
						<div class="flex h-9 w-9 items-center justify-center rounded-full bg-slot-accent text-xs font-bold text-white animate-pop">
							{picks[i]}
						</div>
					{:else}
						<div class="flex h-9 w-9 items-center justify-center rounded-full border-2 border-dashed border-slot-border text-xs text-slot-muted">?</div>
					{/if}
				{/each}
				<span class="ml-1 text-[10px] text-slot-muted">{picks.length}/{PICK_COUNT}</span>
			{/if}
		{:else}
			{#each drawn as n, i}
				{@const isRevealed = revealedDrawn.includes(n)}
				{@const isMatch = isRevealed && picks.includes(n)}
				{@const isJustRevealed = lastRevealed === n}
				<div class="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-all duration-300 sm:h-11 sm:w-11
					{isRevealed ? (isMatch ? 'bg-green-500 text-white' : 'bg-amber-500 text-white') : 'bg-slot-bg border-2 border-dashed border-slot-border text-slot-muted'}
					{isJustRevealed ? 'animate-pop' : ''}
					{!isRevealed ? 'opacity-40' : ''}">
					{isRevealed ? n : '?'}
				</div>
			{/each}
		{/if}
	</div>

	<!-- Number grid -->
	<div class="mb-4 flex w-full justify-center">
		<div class="grid grid-cols-9 gap-[6px] sm:gap-2">
			{#each Array.from({ length: LOTTERY_GRID }, (_, i) => i + 1) as n}
				{@const isPicked = picks.includes(n)}
				{@const isDrawn = revealedDrawn.includes(n)}
				{@const isMatch = isPicked && isDrawn}
				<button
					onclick={() => togglePick(n)}
					disabled={phase !== 'picking'}
					class="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold tabular-nums transition-all duration-150 sm:h-9 sm:w-9 sm:text-[13px]
						{isMatch ? 'bg-green-500 text-white ring-2 ring-green-400/60 animate-glow' : ''}
						{isPicked && !isDrawn ? 'bg-slot-accent text-white scale-110' : ''}
						{isDrawn && !isPicked ? 'bg-slot-muted/15 text-slot-muted' : ''}
						{!isPicked && !isDrawn ? 'bg-slot-bg text-slot-text hover:bg-slot-accent/10 hover:text-slot-accent' : ''}
						disabled:cursor-default"
					style={isMatch ? '--glow-color: #16a34a' : ''}
				>
					{n}
				</button>
			{/each}
		</div>
	</div>

	{#if message}
		<div class="animate-slide-up mb-3 w-full rounded-xl px-4 py-2.5 text-center text-sm font-bold
			{messageType === 'win' ? 'bg-green-50 text-slot-win border border-green-200' : ''}
			{messageType === 'lose' ? 'bg-red-50 text-slot-lose border border-red-200' : ''}
			{messageType === 'info' ? 'bg-slot-accent/10 text-slot-accent border border-slot-accent/20' : ''}">{message}</div>
	{/if}

	{#if phase === 'picking'}
		<div class="mb-2 w-full">
			<button onclick={randomPicks} class="w-full cursor-pointer rounded-xl border border-slot-border bg-slot-surface px-4 py-2.5 text-xs font-bold text-slot-muted transition hover:border-slot-accent/40 hover:text-slot-text">สุ่มเลข {PICK_COUNT} ตัว</button>
		</div>
		<div class="mb-4 flex w-full items-center gap-2 sm:gap-3">
			<div class="flex items-center gap-0 rounded-xl border border-slot-border bg-slot-surface">
				<button onclick={decreaseBet} class="cursor-pointer rounded-l-xl px-2.5 py-1.5 text-base font-bold text-slot-muted transition hover:text-slot-text sm:px-3 sm:py-2 sm:text-lg">−</button>
				<div class="flex min-w-[3.5rem] flex-col items-center border-x border-slot-border px-1 sm:min-w-[4.5rem]">
					<span class="text-[9px] uppercase tracking-wider text-slot-muted">BET</span>
					<input type="number" bind:value={bet} onblur={validateBet} min="1" class="w-full bg-transparent text-center text-sm font-bold tabular-nums outline-none sm:text-base [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
				</div>
				<button onclick={increaseBet} class="cursor-pointer rounded-r-xl px-2.5 py-1.5 text-base font-bold text-slot-muted transition hover:text-slot-text sm:px-3 sm:py-2 sm:text-lg">+</button>
			</div>
			<button onclick={play} disabled={picks.length !== PICK_COUNT || wallet.credit < bet} class="flex-1 cursor-pointer rounded-xl bg-slot-accent px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:text-base">จับสลาก</button>
		</div>
	{:else if phase === 'drawing'}
		<div class="w-full text-center text-sm text-slot-muted animate-pulse">กำลังออกรางวัล...</div>
	{:else}
		<button onclick={newGame} class="w-full cursor-pointer rounded-xl bg-slot-accent px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] sm:text-base">เล่นใหม่</button>
	{/if}

	<!-- Paytable -->
	<div class="mt-4 w-full rounded-xl border border-slot-border bg-slot-surface p-3">
		<div class="mb-2 flex items-center gap-2">
			<div class="h-px flex-1 bg-slot-border"></div>
			<span class="text-[10px] font-bold uppercase tracking-wider text-slot-muted">Paytable</span>
			<div class="h-px flex-1 bg-slot-border"></div>
		</div>
		<div class="grid grid-cols-4 gap-2 text-center text-xs">
			<div class="rounded-lg bg-slot-bg p-2">
				<div class="font-bold text-slot-text">2 ตรง</div>
				<div class="text-slot-accent font-black">x3</div>
			</div>
			<div class="rounded-lg bg-slot-bg p-2">
				<div class="font-bold text-slot-text">3 ตรง</div>
				<div class="text-slot-accent font-black">x15</div>
			</div>
			<div class="rounded-lg bg-amber-50 p-2 border border-amber-200">
				<div class="font-bold text-amber-800">4 ตรง</div>
				<div class="text-amber-600 font-black">x200</div>
			</div>
			<div class="rounded-lg bg-amber-100 p-2 border border-amber-300">
				<div class="font-bold text-amber-900">5 ตรง</div>
				<div class="text-amber-700 font-black">x1000</div>
			</div>
		</div>
		<p class="mt-2 text-center text-[10px] text-slot-muted">เลือก {PICK_COUNT} ตัวจาก 1-{LOTTERY_GRID} — ระบบออก {DRAW_COUNT} ตัว</p>
	</div>
</div>
