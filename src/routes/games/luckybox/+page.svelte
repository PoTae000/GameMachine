<script lang="ts">
	import { wallet, stats, gameInProgress, currentUser } from '$lib/store.svelte';
	import { BOX_COUNT, MULTIPLIERS } from '$lib/games/luckyboxEngine';
	import { playBet, playWin, playLose, playBigWin, playClick, playSuspense, playReveal } from '$lib/sounds';

	const BET_OPTIONS = [1, 5, 10, 20, 50, 100, 200, 500];

	type Phase = 'idle' | 'opening' | 'result';

	let bet = $state(BET_OPTIONS[0]);
	let phase: Phase = $state('idle');
	let message = $state('');
	let messageType: 'win' | 'lose' | 'info' | '' = $state('');
	let cheatMode = $state(false);

	let chosenBox: number | null = $state(null);
	let allBoxes: number[] | null = $state(null);
	let wonMultiplier: number = $state(0);

	// Big win popup
	let showBigWin = $state(false);
	let bigWinAmount = $state(0);

	const BOX_COLORS = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500'];
	const BOX_EMOJIS = ['🎁', '📦', '🎀', '💝', '🎊'];

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

	function getMultLabel(mult: number): string {
		if (mult === 0) return '💀 x0';
		return `x${mult}`;
	}

	async function pickBox(box: number) {
		if (phase !== 'idle') return;
		if (wallet.credit < bet) {
			message = 'บาทไม่พอ';
			messageType = 'info';
			return;
		}

		playBet();
		phase = 'opening';
		gameInProgress.value = true;
		message = '';
		messageType = '';
		chosenBox = box;
		allBoxes = null;
		wonMultiplier = 0;

		playSuspense();

		const res = await fetch('/api/games/luckybox/play', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ bet, box, cheat: cheatMode })
		});
		const data = await res.json();

		if (data.error) {
			message = data.error;
			messageType = 'info';
			phase = 'idle';
			gameInProgress.value = false;
			return;
		}

		await new Promise(r => setTimeout(r, 1200));
		playReveal();
		allBoxes = data.outcome.allBoxes;
		wonMultiplier = data.outcome.multiplier;

		await new Promise(r => setTimeout(r, 500));
		phase = 'result';

		if (data.won) {
			const profit = data.payout - bet;
			message = `x${wonMultiplier}! ได้ +${profit.toLocaleString()} บาท`;
			messageType = 'win';
			playWin();
			if (profit > wallet.credit * 0.5) {
				bigWinAmount = profit;
				showBigWin = true;
				playBigWin();
			}
		} else if (wonMultiplier === 0) {
			message = `กล่องว่าง! เสีย ${bet.toLocaleString()} บาท`;
			messageType = 'lose';
			playLose();
		} else {
			// x1.5 — small win but payout < bet counted as loss by API (won=false when mult <= 1)
			const payout = Math.round(bet * wonMultiplier * 100) / 100;
			message = `x${wonMultiplier}! ได้ ${payout.toLocaleString()} บาท`;
			messageType = 'win';
			playWin();
		}

		wallet.credit = data.newCredit;
		stats.totalSpent = data.stats.totalSpent;
		stats.totalReceived = data.stats.totalReceived;
		gameInProgress.value = false;

		setTimeout(() => { phase = 'idle'; chosenBox = null; allBoxes = null; }, 3000);
	}
</script>

<svelte:head>
	<title>Lucky Box - BUNG TAE DUBAI</title>
</svelte:head>

{#if showBigWin}
	<div class="animate-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
		<div class="animate-modal w-full max-w-sm rounded-2xl bg-gradient-to-b from-yellow-900/90 to-yellow-950/95 p-6 text-center shadow-2xl border border-yellow-500/40">
			<div class="mb-2 text-5xl">🎁</div>
			<p class="mb-1 text-lg font-bold text-yellow-400 drop-shadow">LUCKY!</p>
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
	<h2 class="mb-4 text-lg font-bold text-slot-accent sm:text-xl">Lucky Box (กล่องโชคดี)</h2>

	<!-- Admin cheat toggle -->
	{#if currentUser.value?.role === 'admin'}
		<label class="mb-3 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5">
			<input type="checkbox" bind:checked={cheatMode} class="h-4 w-4 accent-red-500" />
			<span class="text-xs font-bold text-red-400">โหมดโกง (ชนะเสมอ)</span>
		</label>
	{/if}

	<!-- Boxes area -->
	<div class="mb-6 w-full">
		<p class="mb-3 text-center text-xs text-slot-muted">
			{phase === 'idle' ? 'เลือกกล่อง 1 ใบ!' : phase === 'opening' ? 'กำลังเปิด...' : 'ผลลัพธ์!'}
		</p>
		<div class="grid grid-cols-5 gap-2 sm:gap-3">
			{#each Array.from({ length: BOX_COUNT }, (_, i) => i) as i}
				{@const isChosen = chosenBox === i}
				{@const isRevealed = allBoxes !== null}
				{@const mult = allBoxes ? allBoxes[i] : null}
				<button
					onclick={() => pickBox(i)}
					disabled={phase !== 'idle' || wallet.credit < bet}
					class="relative cursor-pointer rounded-xl border-2 px-2 py-4 text-center transition-all duration-300
						{isChosen && isRevealed ? (mult && mult > 1 ? 'border-green-500 bg-green-500/20 scale-110 shadow-lg shadow-green-500/30' : mult === 0 ? 'border-red-500 bg-red-500/20 scale-95' : 'border-yellow-500 bg-yellow-500/20') : ''}
						{!isChosen && isRevealed ? 'border-slot-border bg-slot-surface opacity-50 scale-95' : ''}
						{!isRevealed ? 'border-slot-border bg-slot-surface hover:border-slot-accent/40 hover:scale-105 active:scale-95' : ''}
						disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100
					"
				>
					{#if isRevealed && mult !== null}
						<span class="text-2xl sm:text-3xl">{mult === 0 ? '💀' : mult >= 3 ? '💎' : '🪙'}</span>
						<p class="mt-1 text-xs font-black {mult === 0 ? 'text-red-400' : mult >= 3 ? 'text-yellow-400' : 'text-green-400'}">{getMultLabel(mult)}</p>
					{:else}
						<span class="text-2xl sm:text-3xl {phase === 'opening' && isChosen ? 'animate-bounce' : ''}">{BOX_EMOJIS[i]}</span>
						<p class="mt-1 text-[10px] text-slot-muted">{i + 1}</p>
					{/if}
				</button>
			{/each}
		</div>
	</div>

	{#if message}
		<div class="animate-slide-up mb-3 w-full rounded-xl px-4 py-2.5 text-center text-sm font-bold
			{messageType === 'win' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : ''}
			{messageType === 'lose' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : ''}
			{messageType === 'info' ? 'bg-slot-accent/10 text-slot-accent border border-slot-accent/20' : ''}">
			{message}
		</div>
	{/if}

	<!-- Bet controls -->
	<div class="mb-4 flex w-full items-center gap-2 sm:gap-3">
		<div class="flex items-center gap-0 rounded-xl border border-slot-border bg-slot-surface">
			<button onclick={decreaseBet} disabled={phase !== 'idle'} class="cursor-pointer rounded-l-xl px-2.5 py-1.5 text-base sm:px-3 sm:py-2 sm:text-lg font-bold text-slot-muted transition hover:text-slot-text disabled:cursor-not-allowed disabled:opacity-30">−</button>
			<div class="flex min-w-[3.5rem] flex-col items-center border-x border-slot-border px-1 sm:min-w-[4.5rem]">
				<span class="text-[9px] uppercase tracking-wider text-slot-muted">BET</span>
				<input type="number" bind:value={bet} onblur={validateBet} disabled={phase !== 'idle'} min="1" class="w-full bg-transparent text-center text-sm font-bold tabular-nums outline-none disabled:opacity-60 sm:text-base [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
			</div>
			<button onclick={increaseBet} disabled={phase !== 'idle'} class="cursor-pointer rounded-r-xl px-2.5 py-1.5 text-base sm:px-3 sm:py-2 sm:text-lg font-bold text-slot-muted transition hover:text-slot-text disabled:cursor-not-allowed disabled:opacity-30">+</button>
		</div>
		<div class="flex-1 rounded-xl bg-slot-surface border border-slot-border px-3 py-2 text-center">
			<span class="text-[9px] uppercase tracking-wider text-slot-muted">MAX WIN</span>
			<p class="text-sm font-bold tabular-nums text-green-400">x5</p>
		</div>
	</div>

	<div class="mt-4 w-full rounded-xl border border-slot-border bg-slot-surface p-3 text-xs text-slot-muted">
		<p class="font-medium text-slot-text">วิธีเล่น</p>
		<p class="mt-1">เลือกกล่อง 1 ใน 5 กล่อง</p>
		<p>แต่ละกล่องซ่อนตัวคูณต่างกัน: x0, x1.5, x2, x3, x5</p>
		<p>โชคดี = x5 | โชคร้าย = x0 (เสียหมด)</p>
	</div>
</div>
