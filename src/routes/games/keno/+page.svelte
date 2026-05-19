<script lang="ts">
	import { KENO_GRID, MAX_PICKS, DRAW_COUNT, getMultiplier, countMatches } from '$lib/games/kenoEngine';
	import { wallet, stats, gameInProgress} from '$lib/store.svelte';
	import { playClick, playBet, playTick, playWin, playLose, playBigWin, playHeartbeat, playRevealBig } from '$lib/sounds';

	const BET_OPTIONS = [1, 5, 10, 20, 50, 100, 200, 500];

	let bet = $state(BET_OPTIONS[0]);
	let picks: number[] = $state([]);
	let drawn: number[] = $state([]);
	let revealedDrawn: number[] = $state([]);
	let phase: 'picking' | 'drawing' | 'result' = $state('picking');
	let message = $state('');
	let messageType: 'win' | 'lose' | 'info' | '' = $state('');
	let matches = $state(0);

	// Suspense animation states
	let lastRevealed = $state(-1);
	let heartbeatNumbers = $state(new Set<number>());

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
		playClick();
		if (picks.includes(n)) {
			picks = picks.filter((p) => p !== n);
		} else if (picks.length < MAX_PICKS) {
			picks = [...picks, n];
		}
	}

	async function play() {
		if (picks.length === 0 || wallet.credit < bet) return;

		const creditBefore = wallet.credit;
		gameInProgress.value = true;
		message = '';
		messageType = '';
		revealedDrawn = [];
		lastRevealed = -1;
		heartbeatNumbers = new Set();
		phase = 'drawing';

		// Call server API
		const res = await fetch('/api/games/keno/play', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ bet, picks })
		});
		const data = await res.json();
		if (!res.ok) { message = data.error || 'error'; messageType = 'info'; phase = 'picking'; gameInProgress.value = false; return; }


		playBet();
		drawn = data.outcome.drawn;

		// Reveal one by one — last 3 numbers get heartbeat before reveal
		for (let i = 0; i < drawn.length; i++) {
			const isLast3 = i >= drawn.length - 3;
			const d = isLast3 ? 600 : i >= drawn.length - 5 ? 450 : 300;

			if (isLast3) {
				// Show heartbeat on the number position before revealing
				heartbeatNumbers = new Set([drawn[i]]);
				playHeartbeat();
				await delay(400);
				heartbeatNumbers = new Set();
			}

			await delay(d - (isLast3 ? 400 : 0));
			lastRevealed = drawn[i];
			revealedDrawn = [...revealedDrawn, drawn[i]];
			// Use big reveal sound for the final number, normal tick otherwise
			if (i === drawn.length - 1) {
				playRevealBig();
			} else {
				playTick();
			}
		}

		await delay(700);
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
			message = `ตรง ${matches}/${picks.length} — ชนะ +${profit.toLocaleString()} (x${mult})`;
			messageType = 'win';
			playWin();
			if (profit > creditBefore * 0.5 && profit > 0) { bigWinAmount = profit; showBigWin = true; playBigWin(); }
		} else {
			message = `ตรง ${matches}/${picks.length} — ไม่ถูกรางวัล`;
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
		heartbeatNumbers = new Set();
	}

	function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
</script>

<svelte:head><title>Keno - BUNG TAE DUBAI</title></svelte:head>

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
	<h2 class="mb-4 text-lg font-bold text-slot-accent sm:text-xl">Keno คีโน</h2>

	{#if phase === 'picking'}
		<p class="mb-2 text-xs text-slot-muted">เลือกตัวเลข 1-{MAX_PICKS} ตัว ({picks.length}/{MAX_PICKS})</p>
	{/if}

	<!-- Number grid -->
	<div class="relative mb-4 grid w-full grid-cols-8 gap-1 rounded-2xl border-2 border-indigo-500/20 p-2 sm:grid-cols-10 casino-shadow-lg" style="background: linear-gradient(180deg, #1e1b4b 0%, #312e81 100%)">
		{#each Array.from({ length: KENO_GRID }, (_, i) => i + 1) as n}
			{@const isPicked = picks.includes(n)}
			{@const isDrawn = revealedDrawn.includes(n)}
			{@const isMatch = isPicked && isDrawn}
			{@const isJustRevealed = lastRevealed === n}
			{@const isHeartbeat = heartbeatNumbers.has(n)}
			<button
				onclick={() => togglePick(n)}
				disabled={phase !== 'picking'}
				class="flex h-9 items-center justify-center rounded-lg text-xs font-bold transition
					{isMatch ? 'bg-slot-win text-white ring-2 ring-slot-win/50 animate-glow' : ''}
					{isMatch && isJustRevealed ? 'animate-shake' : ''}
					{isPicked && !isDrawn ? 'bg-slot-accent text-white' : ''}
					{isDrawn && !isPicked ? 'bg-slot-muted/20 text-slot-muted' : ''}
					{isJustRevealed && !isMatch ? 'animate-pop' : ''}
					{isJustRevealed && isMatch ? 'animate-pop' : ''}
					{isHeartbeat ? 'animate-heartbeat bg-slot-accent/20 text-slot-accent' : ''}
					{!isPicked && !isDrawn && !isHeartbeat ? 'border border-slot-border bg-slot-surface text-slot-text hover:border-slot-accent/40' : ''}
					disabled:cursor-default"
				style={isMatch ? '--glow-color: #16a34a' : ''}
			>
				{n}
			</button>
		{/each}
	</div>

	{#if message}
		<div class="animate-slide-up mb-3 w-full rounded-xl px-4 py-2.5 text-center text-sm font-bold casino-shadow
			{messageType === 'win' ? 'bg-green-50 text-slot-win border border-green-200' : ''}
			{messageType === 'lose' ? 'bg-red-50 text-slot-lose border border-red-200' : ''}
			{messageType === 'info' ? 'bg-slot-accent/10 text-slot-accent border border-slot-accent/20' : ''}">{message}</div>
	{/if}

	{#if phase === 'picking'}
		<div class="mb-4 flex w-full items-center gap-2 sm:gap-3">
			<div class="flex items-center gap-0 rounded-xl border border-slot-border bg-slot-surface casino-shadow">
			<button onclick={decreaseBet} class="cursor-pointer rounded-l-xl px-2.5 py-1.5 text-base font-bold text-slot-muted transition hover:text-slot-text disabled:cursor-not-allowed disabled:opacity-30 sm:px-3 sm:py-2 sm:text-lg">−</button>
			<div class="flex min-w-[3.5rem] flex-col items-center border-x border-slot-border px-1 sm:min-w-[4.5rem]">
				<span class="text-[9px] uppercase tracking-wider text-slot-muted">BET</span>
				<input type="number" bind:value={bet} onblur={validateBet} min="1" class="w-full bg-transparent text-center text-sm font-bold tabular-nums outline-none disabled:opacity-60 sm:text-base [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
			</div>
			<button onclick={increaseBet} class="cursor-pointer rounded-r-xl px-2.5 py-1.5 text-base font-bold text-slot-muted transition hover:text-slot-text disabled:cursor-not-allowed disabled:opacity-30 sm:px-3 sm:py-2 sm:text-lg">+</button>
		</div>
		<button onclick={play} disabled={picks.length === 0 || wallet.credit < bet} class="flex-1 cursor-pointer rounded-xl bg-slot-accent px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:text-base">จับสลาก</button>
		</div>
	{:else if phase === 'drawing'}
		<div class="w-full text-center text-sm text-slot-muted animate-pulse">กำลังจับสลาก...</div>
	{:else}
		<button onclick={newGame} class="w-full cursor-pointer rounded-xl bg-slot-accent px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] sm:text-base">เล่นใหม่</button>
	{/if}

	<div class="mt-4 w-full rounded-xl border border-slot-border bg-slot-surface p-3 text-xs text-slot-muted casino-shadow">
		<p class="font-medium text-slot-text">วิธีเล่น</p>
		<p class="mt-1">เลือกตัวเลข 1-{MAX_PICKS} ตัว ระบบจับ {DRAW_COUNT} ตัว ยิ่งตรงเยอะยิ่งได้มาก</p>
		<p>เลือก 5 ตัว ตรง 5 = x100 | เลือก 10 ตัว ตรง 10 = x3000</p>
	</div>
</div>
