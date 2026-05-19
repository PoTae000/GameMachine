<script lang="ts">
	import { wallet, stats, gameInProgress, currentUser, forfeitGame } from '$lib/store.svelte';
	import { DIFFICULTY_CONFIG, type Difficulty } from '$lib/games/towerEngine';
	import { playBet, playWin, playLose, playBigWin, playClick, playSuspense, playReveal, playCashout, playExplosion } from '$lib/sounds';
	import { onMount } from 'svelte';

	const BET_OPTIONS = [1, 5, 10, 20, 50, 100, 200, 500];

	type Phase = 'setup' | 'playing' | 'result';

	let bet = $state(BET_OPTIONS[0]);
	let difficulty: Difficulty = $state('easy');
	let phase: Phase = $state('setup');
	let message = $state('');
	let messageType: 'win' | 'lose' | 'info' | '' = $state('');
	let cheatMode = $state(false);

	// Game state
	let columns = $state(4);
	let floors = $state(10);
	let floorsCleared = $state(0);
	let currentMultiplier = $state(1);
	let potentialPayout = $state(0);
	let revealedFloors = $state<{ floor: number; column: number; safe: boolean }[]>([]);
	let trapPositions = $state<number[]>([]);
	let revealing = $state(false);

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

	async function startGame() {
		if (phase !== 'setup') return;
		if (wallet.credit < bet) {
			message = 'บาทไม่พอ';
			messageType = 'info';
			return;
		}

		playBet();
		message = '';
		messageType = '';
		revealedFloors = [];
		trapPositions = [];

		const res = await fetch('/api/games/tower/start', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ bet, difficulty, cheat: cheatMode })
		});
		const data = await res.json();

		if (data.error) {
			message = data.error;
			messageType = 'info';
			return;
		}

		columns = data.columns;
		floors = data.floors;
		floorsCleared = 0;
		currentMultiplier = 1;
		potentialPayout = bet;
		wallet.credit = data.newCredit;
		phase = 'playing';
		gameInProgress.value = true;
	}

	async function pickDoor(column: number) {
		if (phase !== 'playing' || revealing) return;
		revealing = true;
		playSuspense();

		const res = await fetch('/api/games/tower/reveal', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ column })
		});
		const data = await res.json();

		if (data.error) {
			message = data.error;
			messageType = 'info';
			revealing = false;
			return;
		}

		await new Promise(r => setTimeout(r, 400));
		playReveal();

		if (data.safe) {
			revealedFloors = [...revealedFloors, { floor: floorsCleared, column, safe: true }];
			floorsCleared = data.floor;
			currentMultiplier = data.multiplier;
			potentialPayout = data.potentialPayout;
			playClick();

			// Check if all floors cleared
			if (floorsCleared >= floors) {
				await cashOut();
			}
		} else {
			// Hit trap
			playExplosion();
			revealedFloors = [...revealedFloors, { floor: floorsCleared, column, safe: false }];
			trapPositions = data.trapPositions || [];
			floorsCleared = data.floor;

			message = `โดนกับดัก! เสีย ${bet.toLocaleString()} บาท`;
			messageType = 'lose';
			playLose();

			wallet.credit = data.newCredit;
			stats.totalSpent = data.stats.totalSpent;
			stats.totalReceived = data.stats.totalReceived;

			phase = 'result';
			gameInProgress.value = false;
		}
		revealing = false;
	}

	async function cashOut() {
		if (phase !== 'playing' || floorsCleared === 0) return;
		playCashout();

		const res = await fetch('/api/games/tower/cashout', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' }
		});
		const data = await res.json();

		if (data.error) {
			message = data.error;
			messageType = 'info';
			return;
		}

		const profit = data.payout - bet;
		message = `Cash Out! x${data.multiplier} = +${profit.toLocaleString()} บาท`;
		messageType = 'win';
		playWin();

		if (profit > wallet.credit * 0.3) {
			bigWinAmount = profit;
			showBigWin = true;
			playBigWin();
		}

		wallet.credit = data.newCredit;
		stats.totalSpent = data.stats.totalSpent;
		stats.totalReceived = data.stats.totalReceived;

		phase = 'result';
		gameInProgress.value = false;
	}

	function resetGame() {
		phase = 'setup';
		message = '';
		messageType = '';
		revealedFloors = [];
		trapPositions = [];
		floorsCleared = 0;
		currentMultiplier = 1;
	}

	function getFloorStatus(floor: number, col: number): 'hidden' | 'safe' | 'trap' {
		const r = revealedFloors.find(f => f.floor === floor && f.column === col);
		if (r) return r.safe ? 'safe' : 'trap';
		// Show traps on game over
		if (phase === 'result' && trapPositions[floor] === col) return 'trap';
		return 'hidden';
	}

	$effect(() => {
		const config = DIFFICULTY_CONFIG[difficulty];
		columns = config.columns;
		floors = config.floors;
	});
</script>

<svelte:head>
	<title>Tower - BUNG TAE DUBAI</title>
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
			<button onclick={() => (showBigWin = false)} class="cursor-pointer rounded-xl bg-yellow-500 px-8 py-2.5 text-sm font-bold text-black transition hover:bg-yellow-400 active:scale-[0.98]">
				เยี่ยม!
			</button>
		</div>
	</div>
{/if}

<div class="flex flex-col items-center select-none">
	<h2 class="mb-4 text-lg font-bold text-slot-accent sm:text-xl">Tower (ปีนตึก)</h2>

	<!-- Admin cheat toggle -->
	{#if currentUser.value?.role === 'admin'}
		<label class="mb-3 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5">
			<input type="checkbox" bind:checked={cheatMode} class="h-4 w-4 accent-red-500" />
			<span class="text-xs font-bold text-red-400">โหมดโกง (ชนะเสมอ)</span>
		</label>
	{/if}

	{#if phase === 'setup'}
		<!-- Difficulty selector -->
		<div class="mb-4 w-full">
			<p class="mb-2 text-center text-xs text-slot-muted">ระดับความยาก</p>
			<div class="grid grid-cols-3 gap-2">
				{#each (['easy', 'medium', 'hard'] as const) as d}
					{@const config = DIFFICULTY_CONFIG[d]}
					<button
						onclick={() => (difficulty = d)}
						class="cursor-pointer rounded-xl border-2 px-3 py-3 text-center transition
							{difficulty === d ? 'border-slot-accent/60 bg-slot-accent/10' : 'border-slot-border bg-slot-surface hover:border-slot-accent/30'}
						"
					>
						<p class="text-sm font-bold {difficulty === d ? 'text-slot-accent' : 'text-slot-text'}">
							{d === 'easy' ? 'ง่าย' : d === 'medium' ? 'ปานกลาง' : 'ยาก'}
						</p>
						<p class="text-[10px] text-slot-muted">{config.columns} ช่อง {config.floors} ชั้น</p>
						<p class="text-[10px] text-slot-muted">x{config.baseMultiplier}/ชั้น</p>
					</button>
				{/each}
			</div>
		</div>

		<!-- Bet controls -->
		<div class="mb-4 flex w-full items-center gap-2 sm:gap-3">
			<div class="flex items-center gap-0 rounded-xl border border-slot-border bg-slot-surface">
				<button onclick={decreaseBet} class="cursor-pointer rounded-l-xl px-2.5 py-1.5 text-base sm:px-3 sm:py-2 sm:text-lg font-bold text-slot-muted transition hover:text-slot-text">−</button>
				<div class="flex min-w-[3.5rem] flex-col items-center border-x border-slot-border px-1 sm:min-w-[4.5rem]">
					<span class="text-[9px] uppercase tracking-wider text-slot-muted">BET</span>
					<input type="number" bind:value={bet} onblur={validateBet} min="1" class="w-full bg-transparent text-center text-sm font-bold tabular-nums outline-none sm:text-base [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
				</div>
				<button onclick={increaseBet} class="cursor-pointer rounded-r-xl px-2.5 py-1.5 text-base sm:px-3 sm:py-2 sm:text-lg font-bold text-slot-muted transition hover:text-slot-text">+</button>
			</div>
			<button
				onclick={startGame}
				disabled={wallet.credit < bet}
				class="flex-1 cursor-pointer rounded-xl bg-slot-accent px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:text-base"
			>
				เริ่มปีนตึก
			</button>
		</div>

	{:else if phase === 'playing' || phase === 'result'}
		<!-- Game info bar -->
		<div class="mb-3 flex w-full items-center justify-between rounded-xl border border-slot-border bg-slot-surface px-4 py-2">
			<div class="text-center">
				<p class="text-[9px] text-slot-muted">ชั้น</p>
				<p class="text-sm font-bold tabular-nums text-slot-text">{floorsCleared}/{floors}</p>
			</div>
			<div class="text-center">
				<p class="text-[9px] text-slot-muted">ตัวคูณ</p>
				<p class="text-sm font-bold tabular-nums text-green-400">x{currentMultiplier}</p>
			</div>
			<div class="text-center">
				<p class="text-[9px] text-slot-muted">กำไร</p>
				<p class="text-sm font-bold tabular-nums text-yellow-400">{potentialPayout.toLocaleString()}</p>
			</div>
		</div>

		<!-- Cash out button (playing only) -->
		{#if phase === 'playing' && floorsCleared > 0}
			<button
				onclick={cashOut}
				disabled={revealing}
				class="mb-3 w-full cursor-pointer rounded-xl bg-green-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-green-500 active:scale-[0.98] disabled:opacity-40 sm:text-base"
			>
				💰 Cash Out (x{currentMultiplier} = {potentialPayout.toLocaleString()} บาท)
			</button>
		{/if}

		<!-- Tower grid (bottom to top) -->
		<div class="mb-4 w-full overflow-y-auto max-h-[400px] rounded-xl border border-slot-border bg-slot-surface p-3">
			{#each Array.from({ length: floors }, (_, i) => floors - 1 - i) as floor}
				{@const isCurrentFloor = floor === floorsCleared && phase === 'playing'}
				<div class="mb-1 flex items-center gap-1.5 {isCurrentFloor ? '' : 'opacity-60'}">
					<span class="w-6 text-right text-[10px] tabular-nums text-slot-muted">{floor + 1}F</span>
					<div class="flex flex-1 gap-1.5">
						{#each Array.from({ length: columns }, (_, c) => c) as col}
							{@const status = getFloorStatus(floor, col)}
							<button
								onclick={() => pickDoor(col)}
								disabled={phase !== 'playing' || floor !== floorsCleared || revealing}
								class="flex-1 h-9 rounded-lg border text-sm font-bold transition
									{status === 'safe' ? 'border-green-500/60 bg-green-500/20 text-green-400' : ''}
									{status === 'trap' ? 'border-red-500/60 bg-red-500/20 text-red-400 animate-pulse' : ''}
									{status === 'hidden' && isCurrentFloor ? 'border-slot-accent/40 bg-slot-accent/10 text-slot-accent cursor-pointer hover:bg-slot-accent/20 active:scale-95' : ''}
									{status === 'hidden' && !isCurrentFloor ? 'border-slot-border bg-slot-bg text-slot-muted' : ''}
									disabled:cursor-default
								"
							>
								{#if status === 'safe'}
									✓
								{:else if status === 'trap'}
									💥
								{:else if isCurrentFloor}
									?
								{:else}
									·
								{/if}
							</button>
						{/each}
					</div>
				</div>
			{/each}
		</div>

		{#if message}
			<div class="animate-slide-up mb-3 w-full rounded-xl px-4 py-2.5 text-center text-sm font-bold
				{messageType === 'win' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : ''}
				{messageType === 'lose' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : ''}
				{messageType === 'info' ? 'bg-slot-accent/10 text-slot-accent border border-slot-accent/20' : ''}">
				{message}
			</div>
		{/if}

		{#if phase === 'result'}
			<button
				onclick={resetGame}
				class="w-full cursor-pointer rounded-xl bg-slot-accent px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] sm:text-base"
			>
				เล่นใหม่
			</button>
		{/if}
	{/if}

	<div class="mt-4 w-full rounded-xl border border-slot-border bg-slot-surface p-3 text-xs text-slot-muted">
		<p class="font-medium text-slot-text">วิธีเล่น</p>
		<p class="mt-1">เลือกประตูในแต่ละชั้น — 1 ช่องเป็นกับดัก</p>
		<p>ยิ่งปีนสูง ตัวคูณยิ่งมาก กด Cash Out เมื่อพอใจ</p>
		<p>โดนกับดัก = เสียเงินทั้งหมด</p>
	</div>
</div>
