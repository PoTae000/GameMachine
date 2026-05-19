<script lang="ts">
	import { type SicboBet, type SicboBetType, type SicboResult } from '$lib/games/sicboEngine';
	import { wallet, stats, gameInProgress } from '$lib/store.svelte';
	import { playBet, playDiceRoll, playSuspense, playWin, playLose, playBigWin, playDiceShake, playSuspenseLong, playHeartbeat } from '$lib/sounds';

	const BET_OPTIONS = [1, 5, 10, 20, 50, 100, 200, 500];

	let bet = $state(BET_OPTIONS[0]);
	let betType: SicboBetType | null = $state(null);
	let totalValue: number = $state(10);
	let rolling = $state(false);
	let result: SicboResult | null = $state(null);
	let message = $state('');
	let messageType: 'win' | 'lose' | 'info' | '' = $state('');
	let animDice: [number, number, number] = $state([1, 1, 1]);
	let diceSettled: [boolean, boolean, boolean] = $state([false, false, false]);
	let resultGlowColor = $state('');
	let winBetHighlight = $state('');

	// Dot positions for each dice face value
	const DOTS: Record<number, [number, number][]> = {
		1: [[50, 50]],
		2: [[30, 30], [70, 70]],
		3: [[30, 30], [50, 50], [70, 70]],
		4: [[30, 30], [70, 30], [30, 70], [70, 70]],
		5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
		6: [[28, 25], [72, 25], [28, 50], [72, 50], [28, 75], [72, 75]]
	};
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

	function selectBet(type: SicboBetType) {
		betType = type;
	}

	async function roll() {
		if (!betType || rolling) return;
		if (wallet.credit < bet) {
			message = 'บาทไม่พอ';
			messageType = 'info';
			return;
		}

		const creditBefore = wallet.credit;
		rolling = true;
		gameInProgress.value = true;
		playBet();
		playDiceRoll();
		message = '';
		messageType = '';
		result = null;
		diceSettled = [false, false, false];
		resultGlowColor = '';
		winBetHighlight = '';

		// Call server API
		const body: Record<string, unknown> = { bet, betType };
		if (betType === 'total') body.totalValue = totalValue;
		const res = await fetch('/api/games/sicbo/play', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (!res.ok) {
			const err = await res.json().catch(() => ({ error: 'เกิดข้อผิดพลาด' }));
			message = err.error || 'เกิดข้อผิดพลาด';
			messageType = 'info';
			rolling = false;
			gameInProgress.value = false;
			return;
		}
		const data = await res.json();
		const diceResult: SicboResult = data.outcome;


		// Random cycling
		for (let i = 0; i < 18; i++) {
			animDice = [
				Math.floor(Math.random() * 6) + 1,
				Math.floor(Math.random() * 6) + 1,
				Math.floor(Math.random() * 6) + 1
			];
			await delay(50 + i * 12);
		}

		// Settle dice one by one
		playSuspenseLong();
		for (let d = 0; d < 3; d++) {
			if (d === 2) { playHeartbeat(); await delay(600); }
			animDice[d] = diceResult.dice[d];
			animDice = [...animDice] as [number, number, number];
			diceSettled[d] = true;
			diceSettled = [...diceSettled] as [boolean, boolean, boolean];
			playDiceShake();
			await delay(d === 2 ? 500 : 400);
		}

		await delay(400);
		result = diceResult;

		// Apply final credit and stats from server
		wallet.credit = data.newCredit;
		stats.totalSpent = data.stats.totalSpent;
		stats.totalReceived = data.stats.totalReceived;

		if (data.won) {
			resultGlowColor = '#16a34a';
			winBetHighlight = betType === 'total' ? `total-${totalValue}` : betType;
			const profit = data.payout - bet;
			message = `${diceResult.dice.join('+')}=${diceResult.total} — ชนะ +${profit.toLocaleString()}! (x${data.payout / bet})`;
			messageType = 'win';
			if (profit > creditBefore * 0.5) { bigWinAmount = profit; showBigWin = true; playBigWin(); } else { playWin(); }
		} else {
			resultGlowColor = '#dc2626';
			message = `${diceResult.dice.join('+')}=${diceResult.total} — ไม่ถูก`;
			messageType = 'lose';
			playLose();
		}

		await delay(500);
		resultGlowColor = '';
		gameInProgress.value = false;
		rolling = false;
	}

	function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

	function getTotalMult(v: number): number {
		if (v === 3 || v === 18) return 60;
		if (v === 4 || v === 17) return 50;
		if (v === 5 || v === 16) return 30;
		if (v === 6 || v === 15) return 18;
		if (v === 7 || v === 14) return 12;
		if (v === 8 || v === 13) return 8;
		if (v === 9 || v === 12) return 7;
		return 6;
	}
</script>

<svelte:head><title>Sicbo ไฮโล - BUNG TAE DUBAI</title></svelte:head>

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
	<h2 class="mb-3 text-lg font-bold text-slot-accent sm:text-xl">Sicbo ไฮโล</h2>

	<!-- Dice area -->
	<div class="mb-4 w-full rounded-2xl p-5 sm:p-6 casino-felt casino-felt-gold">
		<div class="flex gap-3 sm:gap-4 justify-center items-center">
			{#each animDice as d, i}
				<div class="dice-flat {rolling && !diceSettled[i] ? 'dice-cycling' : ''} {diceSettled[i] ? 'dice-pop' : ''}"
					>
					{#each DOTS[d] as [x, y]}
						<div class="dice-flat-dot" style="left: {x}%; top: {y}%"></div>
					{/each}
				</div>
			{/each}
		</div>

		{#if result}
			<div class="mt-3 text-center animate-bounce-in">
				<span class="inline-block rounded-full px-5 py-1 text-lg font-black"
					style="color: {resultGlowColor || '#6d28d9'}; background: {resultGlowColor ? resultGlowColor + '15' : '#6d28d920'}">
					{result.total}
				</span>
			</div>
		{/if}
	</div>

	{#if message}
		<div class="animate-slide-up mb-3 w-full rounded-xl px-4 py-2.5 text-center text-sm font-bold casino-shadow
			{messageType === 'win' ? 'bg-green-50 text-slot-win border border-green-200' : ''}
			{messageType === 'lose' ? 'bg-red-50 text-slot-lose border border-red-200' : ''}
			{messageType === 'info' ? 'bg-slot-accent/10 text-slot-accent border border-slot-accent/20' : ''}">{message}</div>
	{/if}

	<!-- Bet board -->
	<div class="mb-3 w-full rounded-xl border border-slot-border bg-slot-surface p-3 casino-shadow">
		<!-- High/Low main bets -->
		<div class="grid grid-cols-2 gap-2 mb-2">
			<button
				onclick={() => selectBet('low')}
				disabled={rolling}
				class="sicbo-bet cursor-pointer rounded-xl border-2 px-4 py-3.5 text-center font-bold transition
					{betType === 'low' ? 'border-blue-500 bg-blue-500/10 text-blue-600' : 'border-slot-border bg-slot-bg text-slot-text hover:border-blue-400/50'}
					{winBetHighlight === 'low' ? 'animate-glow' : ''}
					disabled:opacity-40"
				style={winBetHighlight === 'low' ? '--glow-color: #16a34a' : ''}
			>
				<div class="text-sm">ต่ำ</div>
				<div class="text-[10px] opacity-60">4-10</div>
				<div class="mt-0.5 text-xs font-black">x2</div>
			</button>
			<button
				onclick={() => selectBet('high')}
				disabled={rolling}
				class="sicbo-bet cursor-pointer rounded-xl border-2 px-4 py-3.5 text-center font-bold transition
					{betType === 'high' ? 'border-red-500 bg-red-500/10 text-red-600' : 'border-slot-border bg-slot-bg text-slot-text hover:border-red-400/50'}
					{winBetHighlight === 'high' ? 'animate-glow' : ''}
					disabled:opacity-40"
				style={winBetHighlight === 'high' ? '--glow-color: #16a34a' : ''}
			>
				<div class="text-sm">สูง</div>
				<div class="text-[10px] opacity-60">11-17</div>
				<div class="mt-0.5 text-xs font-black">x2</div>
			</button>
		</div>

		<!-- Triple -->
		<button
			onclick={() => selectBet('triple')}
			disabled={rolling}
			class="sicbo-bet mb-2 w-full cursor-pointer rounded-xl border-2 px-4 py-3 text-center font-bold transition
				{betType === 'triple' ? 'border-amber-500 bg-amber-500/10 text-amber-600' : 'border-slot-border bg-slot-bg text-slot-text hover:border-amber-400/50'}
				{winBetHighlight === 'triple' ? 'animate-glow' : ''}
				disabled:opacity-40"
			style={winBetHighlight === 'triple' ? '--glow-color: #16a34a' : ''}
		>
			<span class="text-sm">ทริปเปิ้ล</span>
			<span class="ml-1 text-[10px] opacity-60">(เลขเหมือน 3 ลูก)</span>
			<span class="ml-1 text-xs font-black">x30</span>
		</button>

		<!-- Total numbers grid -->
		<div class="mb-1 flex items-center gap-1">
			<div class="h-px flex-1 bg-slot-border"></div>
			<span class="text-[10px] text-slot-muted px-2">ทายเลขรวม</span>
			<div class="h-px flex-1 bg-slot-border"></div>
		</div>
		<div class="grid grid-cols-5 gap-1.5">
			{#each Array.from({ length: 16 }, (_, i) => i + 3) as v}
				{@const mult = getTotalMult(v)}
				{@const isHigh = mult >= 30}
				<button
					onclick={() => { selectBet('total'); totalValue = v; }}
					disabled={rolling}
					class="sicbo-bet cursor-pointer rounded-lg border px-1 py-1.5 text-center transition
						{betType === 'total' && totalValue === v ? 'border-slot-accent bg-slot-accent/10 text-slot-accent' : ''}
						{betType !== 'total' || totalValue !== v ? (isHigh ? 'border-amber-300 bg-amber-50 text-amber-800 hover:border-amber-400' : 'border-slot-border bg-slot-bg text-slot-text hover:border-slot-accent/40') : ''}
						{winBetHighlight === 'total-' + v ? 'animate-glow' : ''}
						disabled:opacity-40"
					style={winBetHighlight === 'total-' + v ? '--glow-color: #16a34a' : ''}
				>
					<div class="text-sm font-bold">{v}</div>
					<div class="text-[8px] {isHigh ? 'text-amber-600 font-bold' : 'text-slot-muted'}">x{mult}</div>
				</button>
			{/each}
		</div>
	</div>

	<div class="mb-4 flex w-full items-center gap-2 sm:gap-3">
		<div class="flex items-center gap-0 rounded-xl border border-slot-border bg-slot-surface casino-shadow">
			<button onclick={decreaseBet} disabled={rolling} class="cursor-pointer rounded-l-xl px-2.5 py-1.5 text-base sm:px-3 sm:py-2 sm:text-lg font-bold text-slot-muted transition hover:text-slot-text disabled:cursor-not-allowed disabled:opacity-30">−</button>
			<div class="flex min-w-[3.5rem] flex-col items-center border-x border-slot-border px-1 sm:min-w-[4.5rem]">
				<span class="text-[9px] uppercase tracking-wider text-slot-muted">BET</span>
				<input type="number" bind:value={bet} onblur={validateBet} disabled={rolling} min="1" class="w-full bg-transparent text-center text-sm font-bold tabular-nums outline-none disabled:opacity-60 sm:text-base [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
			</div>
			<button onclick={increaseBet} disabled={rolling} class="cursor-pointer rounded-r-xl px-2.5 py-1.5 text-base sm:px-3 sm:py-2 sm:text-lg font-bold text-slot-muted transition hover:text-slot-text disabled:cursor-not-allowed disabled:opacity-30">+</button>
		</div>
		<button
			onclick={roll}
			disabled={rolling || !betType || wallet.credit < bet}
			class="flex-1 cursor-pointer rounded-xl bg-slot-accent px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 casino-shadow sm:text-base"
		>
			{rolling ? 'กำลังเขย่า...' : 'ทอยเต๋า'}
		</button>
	</div>

	<div class="mt-4 w-full rounded-xl border border-slot-border bg-slot-surface p-3 text-xs text-slot-muted casino-shadow">
		<p class="font-medium text-slot-text">วิธีเล่น</p>
		<p class="mt-1">เขย่าลูกเต๋า 3 ลูก เลือกเดิมพัน สูง/ต่ำ/ทริปเปิ้ล/เลขรวม</p>
		<p>ทริปเปิ้ลจะไม่นับเป็นสูง/ต่ำ | เลขรวมยิ่งยาก multiplier ยิ่งสูง</p>
	</div>
</div>

<style>
	.sicbo-bet {
		box-shadow: 0 1px 3px rgba(0,0,0,0.06);
	}
	.dice-flat {
		position: relative;
		width: 60px;
		height: 60px;
		border-radius: 16%;
		background: linear-gradient(145deg, #ffffff 0%, #f8f8f8 50%, #eaeaea 100%);
		border: 1px solid #c8c8c8;
		box-shadow: 0 2px 8px rgba(0,0,0,0.15), inset 0 1px 2px rgba(255,255,255,0.8);
		transition: box-shadow 0.3s;
	}
	@media (min-width: 640px) {
		.dice-flat { width: 72px; height: 72px; }
	}
	.dice-cycling {
		animation: dice-cycle-flash 0.12s ease-in-out infinite alternate;
	}
	@keyframes dice-cycle-flash {
		0% { background: linear-gradient(145deg, #ffffff 0%, #f8f8f8 50%, #eaeaea 100%); }
		100% { background: linear-gradient(145deg, #f0f0f0 0%, #e8e8e8 50%, #ddd 100%); }
	}
	.dice-pop {
		animation: dice-pop-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	@keyframes dice-pop-in {
		0% { transform: scale(0.85); }
		50% { transform: scale(1.1); }
		100% { transform: scale(1); }
	}
	.dice-flat-dot {
		position: absolute;
		width: 18%;
		height: 18%;
		border-radius: 50%;
		background: radial-gradient(circle at 40% 35%, #3a3a3a, #1a1a1a 60%, #111 100%);
		box-shadow: inset 0 1px 2px rgba(255,255,255,0.15), 0 1px 2px rgba(0,0,0,0.2);
		transform: translate(-50%, -50%);
	}
</style>
