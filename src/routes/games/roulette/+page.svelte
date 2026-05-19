<script lang="ts">
	import {
		getColor,
		getMultiplier,
		BET_TYPES,
		RED_NUMBERS,
		type BetType,
		type RouletteBet
	} from '$lib/games/rouletteEngine';
	import { wallet, stats, gameInProgress} from '$lib/store.svelte';
	import { playBet, playWin, playLose, playBigWin } from '$lib/sounds';
	import RouletteWheel from '$lib/RouletteWheel.svelte';

	const BET_OPTIONS = [1, 5, 10, 20, 50, 100, 200, 500];

	let bet = $state(BET_OPTIONS[0]);
	let selectedBetType: BetType | null = $state(null);
	let selectedNumber: number | null = $state(null);
	let spinning = $state(false);
	let resultNumber: number | null = $state(null);
	let wheelResultNumber: number | null = $state(null);
	let message = $state('');
	let messageType: 'win' | 'lose' | 'info' | '' = $state('');

	let resultBadgePop = $state(false);

	// Big win popup
	let showBigWin = $state(false);
	let bigWinAmount = $state(0);

	// Pending data from API (applied after animation completes)
	let pendingData: any = null;
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

	function selectBet(type: BetType) {
		selectedBetType = type;
		if (type !== 'number') selectedNumber = null;
	}

	function selectNumber(n: number) {
		selectedBetType = 'number';
		selectedNumber = n;
	}

	async function placeBet() {
		if (!selectedBetType || spinning) return;
		if (selectedBetType === 'number' && selectedNumber === null) return;
		if (wallet.credit < bet) {
			message = 'บาทไม่พอ';
			messageType = 'info';
			return;
		}

		creditBefore = wallet.credit;
		spinning = true;
		gameInProgress.value = true;
		message = '';
		messageType = '';
		resultNumber = null;
		resultBadgePop = false;

		// Call server API
		const body: Record<string, unknown> = { bet, betType: selectedBetType };
		if (selectedBetType === 'number') body.betValue = selectedNumber;
		const res = await fetch('/api/games/roulette/play', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		const data = await res.json();
		if (!res.ok) { message = data.error || 'error'; messageType = 'info'; spinning = false; gameInProgress.value = false; return; }

		playBet();

		// Store data, trigger wheel animation
		pendingData = data;
		wheelResultNumber = data.outcome.resultNumber;
	}

	function handleAnimComplete() {
		if (!pendingData) return;
		const data = pendingData;
		const finalResult = data.outcome.resultNumber;
		pendingData = null;

		// Show result
		resultNumber = finalResult;
		resultBadgePop = true;

		// Set final credit and stats from server
		wallet.credit = data.newCredit;
		stats.totalSpent = data.stats.totalSpent;
		stats.totalReceived = data.stats.totalReceived;

		const color = getColor(finalResult);
		const colorTh = color === 'red' ? 'แดง' : color === 'black' ? 'ดำ' : 'เขียว';

		if (data.won) {
			playWin();
			const profit = data.payout - bet;
			message = `${finalResult} (${colorTh}) — ชนะ +${profit.toLocaleString()}!`;
			messageType = 'win';
			if (profit > creditBefore * 0.5) {
				playBigWin();
				bigWinAmount = profit;
				showBigWin = true;
			}
		} else {
			playLose();
			message = `${finalResult} (${colorTh}) — ไม่ถูก`;
			messageType = 'lose';
		}

		setTimeout(() => {
			resultBadgePop = false;
			gameInProgress.value = false;
			spinning = false;
			wheelResultNumber = null;
		}, 300);
	}

	function delay(ms: number) {
		return new Promise((r) => setTimeout(r, ms));
	}

	function colorClass(n: number): string {
		if (n === 0) return 'bg-green-600 text-white';
		return RED_NUMBERS.includes(n) ? 'bg-red-600 text-white' : 'bg-gray-800 text-white';
	}
</script>

<svelte:head>
	<title>Roulette - BUNG TAE DUBAI</title>
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
	<h2 class="mb-3 text-lg font-bold text-slot-accent sm:text-xl">Roulette รูเล็ต</h2>

	<!-- Wheel + Ball Canvas -->
	<div class="mb-4">
		<RouletteWheel
			resultNumber={wheelResultNumber}
			{spinning}
			size="md"
			onAnimationComplete={handleAnimComplete}
		/>
	</div>

	<!-- Result badge -->
	{#if resultNumber !== null}
		<div class="mb-3 flex items-center gap-2 rounded-full px-5 py-1.5 shadow
			{colorClass(resultNumber)}
			{resultBadgePop ? 'animate-pop animate-shake' : 'animate-fade-in'}">
			<span class="text-xl font-bold">{resultNumber}</span>
			<span class="text-xs">{getColor(resultNumber) === 'red' ? 'แดง' : getColor(resultNumber) === 'black' ? 'ดำ' : 'เขียว'}</span>
		</div>
	{/if}

	{#if message}
		<div class="animate-slide-up mb-3 w-full rounded-xl px-4 py-2.5 text-center text-sm font-bold casino-shadow
			{messageType === 'win' ? 'bg-green-50 text-slot-win border border-green-200' : ''}
			{messageType === 'lose' ? 'bg-red-50 text-slot-lose border border-red-200' : ''}
			{messageType === 'info' ? 'bg-slot-accent/10 text-slot-accent border border-slot-accent/20' : ''}">
			{message}
		</div>
	{/if}

	<!-- Bet type selection -->
	<div class="mb-3 w-full">
		<p class="mb-2 text-xs text-slot-muted">เลือกประเภทเดิมพัน:</p>
		<div class="grid grid-cols-3 gap-1.5 sm:gap-2">
			{#each BET_TYPES as bt}
				<button
					onclick={() => selectBet(bt.type)}
					disabled={spinning}
					class="cursor-pointer rounded-lg border px-3 py-2 text-xs font-medium transition sm:text-sm
						{selectedBetType === bt.type ? 'border-slot-accent bg-slot-accent/10 text-slot-accent' : 'border-slot-border bg-slot-surface text-slot-text hover:border-slot-accent/40'}
						disabled:opacity-40"
				>
					{bt.label} (x{bt.multiplier})
				</button>
			{/each}
		</div>
	</div>

	<!-- Number grid -->
	<div class="mb-3 w-full">
		<p class="mb-2 text-xs text-slot-muted">หรือเลือกเลข (x36):</p>
		<div class="grid grid-cols-9 gap-1 sm:grid-cols-12">
			{#each Array.from({ length: 37 }, (_, i) => i) as n}
				<button
					onclick={() => selectNumber(n)}
					disabled={spinning}
					class="flex h-8 w-full items-center justify-center rounded text-xs font-bold transition
						{colorClass(n)}
						{selectedBetType === 'number' && selectedNumber === n ? 'ring-2 ring-slot-accent ring-offset-1' : ''}
						disabled:opacity-40"
				>
					{n}
				</button>
			{/each}
		</div>
	</div>

	<!-- Bet amount + spin -->
	<div class="mb-4 flex w-full items-center gap-2 sm:gap-3">
		<div class="flex items-center gap-0 rounded-xl border border-slot-border bg-slot-surface casino-shadow">
			<button onclick={decreaseBet} disabled={spinning} class="cursor-pointer rounded-l-xl px-2.5 py-1.5 text-base sm:px-3 sm:py-2 sm:text-lg font-bold text-slot-muted transition hover:text-slot-text disabled:cursor-not-allowed disabled:opacity-30">−</button>
			<div class="flex min-w-[3.5rem] flex-col items-center border-x border-slot-border px-1 sm:min-w-[4.5rem]">
				<span class="text-[9px] uppercase tracking-wider text-slot-muted">BET</span>
				<input type="number" bind:value={bet} onblur={validateBet} disabled={spinning} min="1" class="w-full bg-transparent text-center text-sm font-bold tabular-nums outline-none disabled:opacity-60 sm:text-base [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
			</div>
			<button onclick={increaseBet} disabled={spinning} class="cursor-pointer rounded-r-xl px-2.5 py-1.5 text-base sm:px-3 sm:py-2 sm:text-lg font-bold text-slot-muted transition hover:text-slot-text disabled:cursor-not-allowed disabled:opacity-30">+</button>
		</div>
		<button
			onclick={placeBet}
			disabled={spinning || !selectedBetType || (selectedBetType === 'number' && selectedNumber === null) || wallet.credit < bet}
			class="flex-1 cursor-pointer rounded-xl bg-slot-accent px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:text-base"
		>
			{spinning ? 'กำลังหมุน...' : 'หมุน'}
		</button>
	</div>

	<div class="mt-4 w-full rounded-xl border border-slot-border bg-slot-surface p-3 text-xs text-slot-muted casino-shadow">
		<p class="font-medium text-slot-text">วิธีเล่น</p>
		<p class="mt-1">เลือกเดิมพัน แดง/ดำ/คู่/คี่/สูง/ต่ำ = x2 | เลขตรง = x36</p>
	</div>
</div>
