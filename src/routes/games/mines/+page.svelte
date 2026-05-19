<script lang="ts">
	import { GRID_SIZE, MINE_COUNTS, getMultiplier } from '$lib/games/minesEngine';
	import { wallet, stats, gameInProgress } from '$lib/store.svelte';
	import { playBet, playReveal, playExplosion, playWin, playCashout, playBigWin, playHeartbeat, playSuspenseLong } from '$lib/sounds';

	const BET_OPTIONS = [1, 5, 10, 20, 50, 100, 200, 500];

	let bet = $state(BET_OPTIONS[0]);
	let mineCount = $state(5);
	let revealedCells: Set<number> = $state(new Set());
	let minePositions: Set<number> = $state(new Set());
	let phase: 'setup' | 'playing' | 'result' = $state('setup');
	let message = $state('');
	let messageType: 'win' | 'lose' | 'info' | '' = $state('');
	let hitMine = $state(-1);
	let currentMult = $state(1);
	let originalBet = $state(0);

	// Suspense animation states
	let revealingCell = $state(-1);
	let justRevealed = $state(-1);
	let gridShake = $state(false);
	let explosionFlash = $state(false);
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

	async function startGame(force = false) {
		if (wallet.credit < bet) return;
		gameInProgress.value = true;
		originalBet = bet;
		message = ''; messageType = '';
		hitMine = -1; revealingCell = -1; justRevealed = -1;
		gridShake = false; explosionFlash = false;

		const res = await fetch('/api/games/mines/start', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ bet, mineCount, force })
		});
		const data = await res.json();
		if (!res.ok) {
			if (data.error === 'Game already in progress' && !force) {
				return startGame(true);
			}
			message = data.error || 'error'; messageType = 'info'; gameInProgress.value = false; return;
		}

		revealedCells = new Set();
		minePositions = new Set();
		currentMult = 1;
		phase = 'playing';
		playBet();
	}

	async function reveal(cell: number) {
		if (revealedCells.has(cell) || phase !== 'playing') return;

		revealingCell = cell;
		playHeartbeat();
		await delay(400);
		revealingCell = -1;

		const res = await fetch('/api/games/mines/reveal', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ cell })
		});
		const data = await res.json();
		if (!res.ok) { message = data.error || 'error'; messageType = 'info'; return; }

		if (data.safe) {
			revealedCells.add(cell);
			revealedCells = new Set(revealedCells);
			justRevealed = cell;
			playReveal(); playWin();
			currentMult = data.multiplier;
			message = `x${currentMult} (${data.revealedCount} ช่อง)`;
			messageType = 'win';
			await delay(300);
			justRevealed = -1;
		} else {
			hitMine = cell;
			minePositions = new Set(data.mines);
			playExplosion();
			gridShake = true; explosionFlash = true;
			phase = 'result';
			gameInProgress.value = false;
			message = `โดนระเบิด! เสีย ${originalBet.toLocaleString()}`;
			messageType = 'lose';
			wallet.credit = data.newCredit;
			stats.totalSpent = data.stats.totalSpent;
			stats.totalReceived = data.stats.totalReceived;
			await delay(600);
			gridShake = false; explosionFlash = false;
		}
	}

	async function cashOut() {
		if (revealedCells.size === 0) return;
		gameInProgress.value = false;
		playCashout(); playWin();

		const res = await fetch('/api/games/mines/cashout', { method: 'POST' });
		const data = await res.json();
		if (!res.ok) { message = data.error || 'error'; messageType = 'info'; return; }

		wallet.credit = data.newCredit;
		stats.totalSpent = data.stats.totalSpent;
		stats.totalReceived = data.stats.totalReceived;
		phase = 'result';
		const profit = data.payout - originalBet;
		message = `ถอน ${data.payout.toLocaleString()} บาท (+${profit.toLocaleString()})`;
		messageType = 'win';
		if (profit > (wallet.credit - data.payout) * 0.5 && profit > 0) { bigWinAmount = profit; showBigWin = true; playBigWin(); }
	}

	function newGame() {
		phase = 'setup';
		revealedCells = new Set();
		minePositions = new Set();
		message = '';
		messageType = '';
		hitMine = -1;
		currentMult = 1;
		revealingCell = -1;
		justRevealed = -1;
		gridShake = false;
		explosionFlash = false;
	}

	function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

	function cellIcon(cell: number): string {
		if (phase === 'result' && minePositions.has(cell)) return '💣';
		if (revealedCells.has(cell)) return '💎';
		if (hitMine === cell) return '💥';
		return '';
	}
</script>

<svelte:head><title>Mines - BUNG TAE DUBAI</title></svelte:head>

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
	<h2 class="mb-4 text-lg font-bold text-slot-accent sm:text-xl">Mines กู้ระเบิด</h2>

	{#if phase === 'playing'}
		<div class="mb-3 w-full rounded-lg bg-slot-accent/10 px-4 py-2 text-center">
			<span class="text-sm font-bold text-slot-accent">x{currentMult}</span>
			<span class="text-xs text-slot-muted"> — ถอนได้ {(Math.round(originalBet * currentMult * 100) / 100).toLocaleString()} บาท</span>
		</div>
	{/if}

	<!-- Grid -->
	<div class="relative mb-4 grid w-full grid-cols-5 gap-1.5 rounded-2xl p-2 dice-table {gridShake ? 'animate-shake' : ''}">
		{#if explosionFlash}
			<div class="col-span-5 absolute inset-0 bg-slot-lose/10 rounded-xl pointer-events-none animate-fade-in"></div>
		{/if}
		{#each Array.from({ length: GRID_SIZE }, (_, i) => i) as cell}
			{@const isRevealed = revealedCells.has(cell)}
			{@const isMine = phase === 'result' && minePositions.has(cell)}
			{@const isHit = hitMine === cell}
			{@const isRevealing = revealingCell === cell}
			{@const isJustRevealed = justRevealed === cell}
			<button
				onclick={() => reveal(cell)}
				disabled={phase !== 'playing' || isRevealed}
				class="flex aspect-square items-center justify-center rounded-lg text-lg transition
					{isHit ? 'bg-slot-lose text-white scale-125 animate-mine-explode' : ''}
					{isMine && !isHit ? 'bg-slot-lose/20 text-slot-lose' : ''}
					{isRevealed && !isMine && isJustRevealed ? 'bg-slot-win/10 text-slot-win border border-slot-win/30 animate-tile-reveal' : ''}
					{isRevealed && !isMine && !isJustRevealed ? 'bg-slot-win/10 text-slot-win border border-slot-win/30' : ''}
					{isRevealing ? 'border border-slot-accent bg-slot-accent/10 animate-glow animate-heartbeat' : ''}
					{!isRevealed && !isMine && !isHit && !isRevealing ? 'border border-slot-border bg-slot-surface hover:bg-slot-bg cursor-pointer active:scale-95' : ''}
					disabled:cursor-default"
				style={isRevealing ? '--glow-color: #6d28d9' : isJustRevealed ? '--glow-color: #16a34a' : ''}
			>
				{cellIcon(cell)}
			</button>
		{/each}
	</div>

	{#if message}
		<div class="animate-slide-up mb-3 w-full rounded-xl px-4 py-2.5 text-center text-sm font-bold casino-shadow
			{messageType === 'win' ? 'bg-green-50 text-slot-win border border-green-200' : ''}
			{messageType === 'lose' ? 'bg-red-50 text-slot-lose border border-red-200' : ''}
			{messageType === 'info' ? 'bg-slot-accent/10 text-slot-accent border border-slot-accent/20' : ''}">{message}</div>
	{/if}

	{#if phase === 'setup'}
		<div class="mb-3 flex w-full items-center justify-center gap-2">
			<span class="text-sm text-slot-muted">ระเบิด:</span>
			<select bind:value={mineCount} class="rounded-lg border border-slot-border bg-slot-surface px-3 py-2 text-sm font-bold outline-none">
				{#each MINE_COUNTS as m}<option value={m}>{m} ลูก</option>{/each}
			</select>
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
		<button onclick={() => startGame()} disabled={wallet.credit < bet} class="flex-1 cursor-pointer rounded-xl bg-slot-accent px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:text-base">เริ่มเกม</button>
		</div>
	{:else if phase === 'playing'}
		<button onclick={cashOut} disabled={revealedCells.size === 0} class="w-full cursor-pointer rounded-xl border-2 border-slot-accent bg-slot-accent/10 px-6 py-3 text-sm font-bold text-slot-accent transition hover:bg-slot-accent/20 active:scale-[0.98] disabled:opacity-40 sm:text-base">ถอน {(Math.round(originalBet * currentMult * 100) / 100).toLocaleString()} บาท</button>
		{:else}
		<button onclick={newGame} class="w-full cursor-pointer rounded-xl bg-slot-accent px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] sm:text-base">เล่นใหม่</button>
	{/if}

	<div class="mt-4 w-full rounded-xl border border-slot-border bg-slot-surface p-3 text-xs text-slot-muted casino-shadow">
		<p class="font-medium text-slot-text">วิธีเล่น</p>
		<p class="mt-1">เปิดช่อง หลบระเบิด ยิ่งเปิดเยอะ multiplier ยิ่งสูง</p>
		<p>ถอนได้ตลอด หรือเสี่ยงเปิดต่อ!</p>
	</div>
</div>
