<script lang="ts">
	import { wallet, stats, gameInProgress, currentUser } from '$lib/store.svelte';
	import { RPS_WIN_MULTIPLIER, type RPSChoice } from '$lib/games/rpsEngine';
	import { playBet, playWin, playLose, playBigWin, playClick, playReveal } from '$lib/sounds';

	const BET_OPTIONS = [1, 5, 10, 20, 50, 100, 200, 500];

	type Phase = 'idle' | 'shaking' | 'revealing' | 'result';

	let bet = $state(BET_OPTIONS[0]);
	let phase: Phase = $state('idle');
	let playerChoice: RPSChoice | null = $state(null);
	let houseChoice: RPSChoice | null = $state(null);
	let result: 'win' | 'lose' | 'draw' | null = $state(null);
	let message = $state('');
	let messageType: 'win' | 'lose' | 'info' | '' = $state('');
	let shakeCount = $state(0);
	let cheatMode = $state(false);

	// Big win popup
	let showBigWin = $state(false);
	let bigWinAmount = $state(0);

	const CHOICES: { id: RPSChoice; emoji: string; label: string }[] = [
		{ id: 'rock', emoji: '✊', label: 'ค้อน' },
		{ id: 'paper', emoji: '✋', label: 'กระดาษ' },
		{ id: 'scissors', emoji: '✌️', label: 'กรรไกร' }
	];

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

	function getEmoji(choice: RPSChoice | null): string {
		if (!choice) return '❓';
		return CHOICES.find(c => c.id === choice)?.emoji ?? '❓';
	}

	async function play(choice: RPSChoice) {
		if (phase !== 'idle') return;
		if (wallet.credit < bet) {
			message = 'บาทไม่พอ';
			messageType = 'info';
			return;
		}

		playerChoice = choice;
		houseChoice = null;
		result = null;
		message = '';
		messageType = '';
		playBet();
		phase = 'shaking';
		gameInProgress.value = true;

		// Fire API call
		const apiPromise = fetch('/api/games/rps/play', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ bet, choice, cheat: cheatMode })
		}).then(r => r.json());

		// Shake animation: 3 counts
		for (let i = 1; i <= 3; i++) {
			shakeCount = i;
			playClick();
			await new Promise(r => setTimeout(r, 500));
		}

		const data = await apiPromise;

		if (data.error) {
			message = data.error;
			messageType = 'info';
			phase = 'idle';
			gameInProgress.value = false;
			return;
		}

		// Reveal
		playReveal();
		phase = 'revealing';
		houseChoice = data.outcome.houseChoice;
		result = data.outcome.result;

		await new Promise(r => setTimeout(r, 600));
		phase = 'result';

		if (data.outcome.result === 'win') {
			const profit = data.payout - bet;
			message = `ชนะ! +${profit.toLocaleString()} บาท`;
			messageType = 'win';
			playWin();
			if (profit > wallet.credit * 0.5) {
				bigWinAmount = profit;
				showBigWin = true;
				playBigWin();
			}
		} else if (data.outcome.result === 'draw') {
			message = 'เสมอ! ได้เงินคืน';
			messageType = 'info';
		} else {
			message = `แพ้! เสีย ${bet.toLocaleString()} บาท`;
			messageType = 'lose';
			playLose();
		}

		wallet.credit = data.newCredit;
		stats.totalSpent = data.stats.totalSpent;
		stats.totalReceived = data.stats.totalReceived;
		gameInProgress.value = false;

		setTimeout(() => { phase = 'idle'; shakeCount = 0; }, 2500);
	}
</script>

<svelte:head>
	<title>Rock Paper Scissors - BUNG TAE DUBAI</title>
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
	<h2 class="mb-4 text-lg font-bold text-slot-accent sm:text-xl">เป่ายิ้งฉุบ</h2>

	<!-- Admin cheat toggle -->
	{#if currentUser.value?.role === 'admin'}
		<label class="mb-3 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5">
			<input type="checkbox" bind:checked={cheatMode} class="h-4 w-4 accent-red-500" />
			<span class="text-xs font-bold text-red-400">โหมดโกง (ชนะเสมอ)</span>
		</label>
	{/if}

	<!-- Battle area -->
	<div class="relative mb-6 flex w-full items-center justify-center gap-6 sm:gap-10">
		<!-- Player side -->
		<div class="flex flex-col items-center">
			<p class="mb-2 text-xs font-bold text-slot-muted">คุณ</p>
			<div class="flex h-24 w-24 items-center justify-center rounded-2xl border-2 sm:h-28 sm:w-28
				{result === 'win' ? 'border-green-500/60 bg-green-500/10 shadow-lg shadow-green-500/20' : ''}
				{result === 'lose' ? 'border-red-500/60 bg-red-500/10 scale-90' : ''}
				{result === 'draw' ? 'border-yellow-500/60 bg-yellow-500/10' : ''}
				{!result ? 'border-slot-border bg-slot-surface' : ''}
				transition-all duration-300
				{phase === 'shaking' ? 'animate-bounce' : ''}
			">
				<span class="text-4xl sm:text-5xl">{getEmoji(playerChoice)}</span>
			</div>
		</div>

		<!-- VS -->
		<div class="flex flex-col items-center">
			{#if phase === 'shaking'}
				<span class="text-2xl font-black text-slot-accent animate-pulse">{shakeCount}</span>
			{:else}
				<span class="text-lg font-bold text-slot-muted">VS</span>
			{/if}
		</div>

		<!-- House side -->
		<div class="flex flex-col items-center">
			<p class="mb-2 text-xs font-bold text-slot-muted">เจ้ามือ</p>
			<div class="flex h-24 w-24 items-center justify-center rounded-2xl border-2 sm:h-28 sm:w-28
				{result === 'lose' ? 'border-green-500/60 bg-green-500/10 shadow-lg shadow-green-500/20' : ''}
				{result === 'win' ? 'border-red-500/60 bg-red-500/10 scale-90' : ''}
				{result === 'draw' ? 'border-yellow-500/60 bg-yellow-500/10' : ''}
				{!result ? 'border-slot-border bg-slot-surface' : ''}
				transition-all duration-300
				{phase === 'shaking' ? 'animate-bounce' : ''}
			">
				<span class="text-4xl sm:text-5xl transition-all duration-300 {phase === 'revealing' || phase === 'result' ? 'scale-100' : ''}">{phase === 'shaking' ? '❓' : getEmoji(houseChoice)}</span>
			</div>
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

	<!-- Choice buttons -->
	<div class="mb-4 w-full">
		<p class="mb-2 text-center text-xs text-slot-muted">เลือกอาวุธ</p>
		<div class="grid grid-cols-3 gap-3">
			{#each CHOICES as c}
				<button
					onclick={() => play(c.id)}
					disabled={phase !== 'idle' || wallet.credit < bet}
					class="cursor-pointer rounded-xl border-2 border-slot-border bg-slot-surface px-3 py-4 text-center transition hover:border-slot-accent/40 hover:bg-slot-accent/5 active:scale-[0.95] disabled:cursor-not-allowed disabled:opacity-40"
				>
					<span class="text-3xl sm:text-4xl">{c.emoji}</span>
					<p class="mt-1 text-xs font-bold text-slot-text">{c.label}</p>
				</button>
			{/each}
		</div>
	</div>

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
			<span class="text-[9px] uppercase tracking-wider text-slot-muted">WIN</span>
			<p class="text-sm font-bold tabular-nums text-green-400">x{RPS_WIN_MULTIPLIER}</p>
		</div>
	</div>

	<div class="mt-4 w-full rounded-xl border border-slot-border bg-slot-surface p-3 text-xs text-slot-muted">
		<p class="font-medium text-slot-text">วิธีเล่น</p>
		<p class="mt-1">เลือก ค้อน / กระดาษ / กรรไกร</p>
		<p>ชนะ = x{RPS_WIN_MULTIPLIER} | เสมอ = ได้เงินคืน | แพ้ = เสียเงิน</p>
	</div>
</div>
