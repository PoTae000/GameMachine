<script lang="ts">
	import { renderCoinHeads, renderCoinTails } from '$lib/coinSvg';
	import { COINFLIP_MULTIPLIER, type CoinSide } from '$lib/games/coinflipEngine';
	import { wallet, stats, gameInProgress} from '$lib/store.svelte';
	import { playBet, playCoinFlip, playWin, playLose, playBigWin, playHeartbeat } from '$lib/sounds';
	import { onMount } from 'svelte';

	const BET_OPTIONS = [1, 5, 10, 20, 50, 100, 200, 500];

	let bet = $state(BET_OPTIONS[0]);
	let guess: CoinSide | null = $state(null);
	let flipping = $state(false);
	let result: CoinSide | null = $state(null);
	let message = $state('');
	let messageType: 'win' | 'lose' | 'info' | '' = $state('');

	// Animation state
	let coinY = $state(0);
	let coinRotateX = $state(0);
	let coinScale = $state(1);
	let coinShadowScale = $state(1);
	let coinShadowOpacity = $state(0.15);
	let showFace = $state(false);
	let animFrameId = 0;

	// Result effects
	let resultPop = $state(false);
	let resultGlow: 'win' | 'lose' | '' = $state('');

	// Big win popup
	let showBigWin = $state(false);
	let bigWinAmount = $state(0);

	onMount(() => {
		return () => cancelAnimationFrame(animFrameId);
	});

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

	// Smooth easing functions
	function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3); }
	function easeInOutQuad(t: number) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

	async function play() {
		if (!guess || flipping) return;
		if (wallet.credit < bet) {
			message = 'บาทไม่พอ';
			messageType = 'info';
			return;
		}

		const creditBefore = wallet.credit;
		playBet();
		flipping = true;
		gameInProgress.value = true;
		message = '';
		messageType = '';
		result = null;
		showFace = false;
		resultPop = false;
		resultGlow = '';

		// Start animation AND API call at the same time
		playCoinFlip();
		const apiPromise = fetch('/api/games/coinflip/play', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ bet, guess })
		}).then(r => r.json());

		// Start spinning immediately (first phase: fast spin up + toss)
		const spinUpDuration = 800;
		const spinUpStart = performance.now();
		let spinUpAngle = 0;

		function spinUp(now: number) {
			const elapsed = now - spinUpStart;
			const t = Math.min(elapsed / spinUpDuration, 1);
			const ease = t * t; // accelerate
			spinUpAngle = 360 * 3 * ease;
			coinRotateX = spinUpAngle;
			coinY = -180 * easeOutCubic(t);
			coinScale = 1 - 0.1 * easeOutCubic(t);
			coinShadowScale = 1 + 1.5 * easeOutCubic(t);
			coinShadowOpacity = 0.15 * (1 - t * 0.7);
			if (t < 1) {
				animFrameId = requestAnimationFrame(spinUp);
			}
		}
		animFrameId = requestAnimationFrame(spinUp);

		// Wait for API response
		const data = await apiPromise;
		if (data.error) {
			cancelAnimationFrame(animFrameId);
			coinY = 0; coinScale = 1; coinRotateX = 0;
			coinShadowScale = 1; coinShadowOpacity = 0.15;
			message = data.error;
			messageType = 'info';
			flipping = false;
			gameInProgress.value = false;
			return;
		}

		const finalResult: CoinSide = data.outcome.result;

		// Continue from where spinUp left off
		const baseAngle = spinUpAngle;
		const extraSpins = 4 + Math.floor(Math.random() * 2);
		const targetHalf = finalResult === 'tails' ? 1 : 0;
		const totalHalfTurns = extraSpins * 2 + targetHalf;
		const targetAngleX = baseAngle + totalHalfTurns * 180;

		const duration = 1600;
		const startTime = performance.now();

		function animate(now: number) {
			const elapsed = now - startTime;
			const t = Math.min(elapsed / duration, 1);

			// Phase 1: Fall down (0 → 0.55)
			if (t < 0.55) {
				const p = t / 0.55;
				const ease = easeInOutQuad(p);
				coinY = -180 * (1 - ease);
				coinScale = 0.9 + 0.1 * ease;
				coinShadowScale = 2.5 - 1.5 * ease;
				coinShadowOpacity = 0.15 * (0.3 + ease * 0.7);
			}
			// Phase 2: Soft bounce (0.55 → 0.8)
			else if (t < 0.8) {
				const p = (t - 0.55) / 0.25;
				const arc = Math.sin(p * Math.PI);
				coinY = -30 * arc;
				coinScale = 1;
				coinShadowScale = 1 + 0.2 * arc;
				coinShadowOpacity = 0.15;
			}
			// Phase 3: Settle (0.8 → 1)
			else {
				const p = (t - 0.8) / 0.2;
				const arc = Math.sin(p * Math.PI);
				coinY = -6 * arc;
				coinScale = 1;
				coinShadowScale = 1;
				coinShadowOpacity = 0.15;
			}

			// Spin: decelerates from baseAngle to targetAngleX
			const spinEase = 1 - Math.pow(1 - t, 4);
			coinRotateX = baseAngle + (targetAngleX - baseAngle) * spinEase;

			if (t < 1) {
				animFrameId = requestAnimationFrame(animate);
			} else {
				// Settle
				coinY = 0;
				coinScale = 1;
				coinRotateX = targetAngleX;
				coinShadowScale = 1;
				coinShadowOpacity = 0.15;
				showFace = true;
				result = finalResult;

				resultPop = true;
				resultGlow = data.won ? 'win' : 'lose';

				if (data.won) {
					const profit = data.payout - bet;
					message = `${finalResult === 'heads' ? 'หัว' : 'ก้อย'} — ถูก! +${profit.toLocaleString()}`;
					messageType = 'win';
					playWin();
					if (profit > creditBefore * 0.5) {
						bigWinAmount = profit;
						showBigWin = true;
						playBigWin();
					}
				} else {
					message = `${finalResult === 'heads' ? 'หัว' : 'ก้อย'} — ผิด! เสีย ${bet.toLocaleString()}`;
					messageType = 'lose';
					playLose();
				}

				wallet.credit = data.newCredit;
				stats.totalSpent = data.stats.totalSpent;
				stats.totalReceived = data.stats.totalReceived;

				setTimeout(() => { resultPop = false; resultGlow = ''; }, 800);
				gameInProgress.value = false;
				flipping = false;
			}
		}

		// spinUp already done, now continue with the landing animation
		cancelAnimationFrame(animFrameId);
		animFrameId = requestAnimationFrame(animate);
	}
</script>

<svelte:head>
	<title>Coin Flip - BUNG TAE DUBAI</title>
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
	<h2 class="mb-4 text-lg font-bold text-slot-accent sm:text-xl">Coin Flip</h2>

	<!-- Coin area -->
	<div class="relative mb-6 flex h-64 items-end justify-center sm:h-72" style="perspective: 900px">
		<!-- Shadow under coin -->
		<div
			class="absolute bottom-4 left-1/2 h-4 w-24 -translate-x-1/2 rounded-full bg-black/20 blur-md sm:w-28"
			style="transform: translateX(-50%) scaleX({coinShadowScale}); opacity: {coinShadowOpacity};"
		></div>

		<div
			class="relative h-36 w-36 sm:h-44 sm:w-44 {resultPop ? 'animate-pop' : ''}"
			style="transform: translateY({coinY}px) scale({coinScale}); transform-style: preserve-3d;"
		>
			<!-- Heads face -->
			<div
				class="absolute inset-0 flex items-center justify-center rounded-full"
				style="backface-visibility: hidden; transform: rotateX({coinRotateX}deg);
					{resultGlow === 'win' && result === 'heads' ? 'box-shadow: 0 0 30px rgba(245,158,11,0.5);' : ''}
					{resultGlow === 'lose' && result === 'heads' ? 'box-shadow: 0 0 20px rgba(239,68,68,0.3);' : ''}"
			>
				{@html renderCoinHeads(160)}
			</div>
			<!-- Tails face -->
			<div
				class="absolute inset-0 flex items-center justify-center rounded-full"
				style="backface-visibility: hidden; transform: rotateX({coinRotateX + 180}deg);
					{resultGlow === 'win' && result === 'tails' ? 'box-shadow: 0 0 30px rgba(148,163,184,0.5);' : ''}
					{resultGlow === 'lose' && result === 'tails' ? 'box-shadow: 0 0 20px rgba(239,68,68,0.3);' : ''}"
			>
				{@html renderCoinTails(160)}
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

	<!-- Guess selection -->
	<div class="mb-4 w-full">
		<p class="mb-2 text-center text-xs text-slot-muted">เลือกฝั่ง</p>
		<div class="grid grid-cols-2 gap-3">
			<button
				onclick={() => (guess = 'heads')}
				disabled={flipping}
				class="cursor-pointer rounded-xl border-2 px-4 py-3.5 text-center transition
					{guess === 'heads' ? 'border-amber-500/60 bg-amber-500/10 shadow-lg shadow-amber-500/10' : 'border-slot-border bg-slot-surface hover:border-amber-500/30 hover:bg-amber-500/5'}
					disabled:opacity-40"
			>
				<div class="flex justify-center">{@html renderCoinHeads(52)}</div>
				<p class="mt-1.5 text-sm font-bold {guess === 'heads' ? 'text-amber-400' : 'text-slot-text'}">หัว</p>
			</button>
			<button
				onclick={() => (guess = 'tails')}
				disabled={flipping}
				class="cursor-pointer rounded-xl border-2 px-4 py-3.5 text-center transition
					{guess === 'tails' ? 'border-slate-400/60 bg-slate-400/10 shadow-lg shadow-slate-400/10' : 'border-slot-border bg-slot-surface hover:border-slate-400/30 hover:bg-slate-400/5'}
					disabled:opacity-40"
			>
				<div class="flex justify-center">{@html renderCoinTails(52)}</div>
				<p class="mt-1.5 text-sm font-bold {guess === 'tails' ? 'text-slate-300' : 'text-slot-text'}">ก้อย</p>
			</button>
		</div>
	</div>

	<div class="mb-4 flex w-full items-center gap-2 sm:gap-3">
		<div class="flex items-center gap-0 rounded-xl border border-slot-border bg-slot-surface">
			<button onclick={decreaseBet} disabled={flipping} class="cursor-pointer rounded-l-xl px-2.5 py-1.5 text-base sm:px-3 sm:py-2 sm:text-lg font-bold text-slot-muted transition hover:text-slot-text disabled:cursor-not-allowed disabled:opacity-30">−</button>
			<div class="flex min-w-[3.5rem] flex-col items-center border-x border-slot-border px-1 sm:min-w-[4.5rem]">
				<span class="text-[9px] uppercase tracking-wider text-slot-muted">BET</span>
				<input type="number" bind:value={bet} onblur={validateBet} disabled={flipping} min="1" class="w-full bg-transparent text-center text-sm font-bold tabular-nums outline-none disabled:opacity-60 sm:text-base [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
			</div>
			<button onclick={increaseBet} disabled={flipping} class="cursor-pointer rounded-r-xl px-2.5 py-1.5 text-base sm:px-3 sm:py-2 sm:text-lg font-bold text-slot-muted transition hover:text-slot-text disabled:cursor-not-allowed disabled:opacity-30">+</button>
		</div>
		<button
			onclick={play}
			disabled={flipping || !guess || wallet.credit < bet}
			class="flex-1 cursor-pointer rounded-xl bg-slot-accent px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:text-base"
		>
			{flipping ? 'กำลังโยน...' : 'โยนเหรียญ'}
		</button>
	</div>

	<div class="mt-4 w-full rounded-xl border border-slot-border bg-slot-surface p-3 text-xs text-slot-muted">
		<p class="font-medium text-slot-text">วิธีเล่น</p>
		<p class="mt-1">เลือกหัวหรือก้อย แล้วโยนเหรียญ</p>
		<p>ทายถูก = x{COINFLIP_MULTIPLIER}</p>
	</div>
</div>
