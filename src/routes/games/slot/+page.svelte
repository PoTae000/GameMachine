<script lang="ts">
	import {
		SYMBOLS,
		COLS,
		ROWS,
		BET_OPTIONS,
		FREE_SPIN_COST_MULTIPLIER,
		PAYLINES,
		PAYLINE_MULTIPLIERS,
		PAYLINE_NAMES,
		evaluateGrid,
		type Grid,
		type SpinResult
	} from '$lib/slotEngine';
	import { SYMBOL_SVGS } from '$lib/symbolSvgs';
	import { wallet, stats, gameInProgress } from '$lib/store.svelte';
	import { playSlotSpin, playReelStop, playWin, playLose, playBigWin, playBet } from '$lib/sounds';
	import { onMount } from 'svelte';
	import {
		reelLandColumn,
		bigWinCelebration,
		freeSpinPopup,
		freeSpinCountUp,
		spinButtonPress,
		modalEntrance,
		gridShake,
		type GsapTimeline,
		type GsapTween
	} from '$lib/animations';

	let bet = $state(BET_OPTIONS[0]);
	let spinning = $state(false);
	let skipRequested = $state(false);
	let autoSkip = $state(false);
	let grid: Grid = $state(
		Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => SYMBOLS[0]))
	);
	let result: SpinResult | null = $state(null);
	let message = $state('');
	let messageType: 'win' | 'lose' | 'info' | 'free' | '' = $state('');

	let freeSpins = $state(0);
	let freeSpinTotal = $state(0);

	// Free spin summary
	let freeSpinSessionPayout = $state(0);
	let showFreeSpinSummary = $state(false);
	let freeSpinDisplayCount = $state(0);
	let wasFreeSpinMode = $state(false);

	// Per-column animation state
	let colState: ('idle' | 'spinning' | 'landing')[] = $state([
		'idle',
		'idle',
		'idle',
		'idle',
		'idle'
	]);
	let winCells: string[] = $state([]);

	let freeSpinMultiplier = $state(1);
	let freeSpinRound = $state(0);

	let isFreeSpinMode = $derived(freeSpins > 0);
	const FREE_SPIN_PRICE = 150;
	const FREE_SPIN_BET = 10;
	let savedBetBeforeFreeSpin = $state(0);
	let autoSpin = $state(false);

	// Buy Free Spin confirmation
	let showBuyConfirm = $state(false);

	// Stop auto-spin when game is forfeited (gameInProgress set to false by layout)
	$effect(() => {
		if (!gameInProgress.value && autoSpin) {
			autoSpin = false;
		}
	});


	// Big win popup
	let showBigWin = $state(false);
	let bigWinAmount = $state(0);

	// Free spin won popup
	let showFreeSpinWon = $state(false);
	let freeSpinsWonCount = $state(0);

	// Spinning reel display — cycle random symbols for realistic effect
	const REEL_SYMBOLS = SYMBOLS.filter(s => s.id !== 'scatter');
	let spinSymbols: Grid = $state(
		Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => REEL_SYMBOLS[0]))
	);
	let spinIntervalId: ReturnType<typeof setInterval> | null = null;

	// Element references for GSAP animations
	let reelGridEl: HTMLDivElement | undefined = $state();
	let spinBtnEl: HTMLButtonElement | undefined = $state();
	let bigWinBackdropEl: HTMLDivElement | undefined = $state();
	let bigWinModalEl: HTMLDivElement | undefined = $state();
	let bigWinEmojiEl: HTMLDivElement | undefined = $state();
	let bigWinTitleEl: HTMLParagraphElement | undefined = $state();
	let bigWinAmountEl: HTMLParagraphElement | undefined = $state();
	let bigWinConfettiEl: HTMLDivElement | undefined = $state();
	let freeSpinWonBackdropEl: HTMLDivElement | undefined = $state();
	let freeSpinWonModalEl: HTMLDivElement | undefined = $state();
	let freeSpinSummaryBackdropEl: HTMLDivElement | undefined = $state();
	let freeSpinSummaryModalEl: HTMLDivElement | undefined = $state();
	let buyConfirmBackdropEl: HTMLDivElement | undefined = $state();
	let buyConfirmModalEl: HTMLDivElement | undefined = $state();


	// Active GSAP timeline for cleanup
	let activeBigWinTimeline: GsapTimeline | null = null;
	let activeFreeSpinCountTween: GsapTween | null = null;



	function randomReelSymbol() {
		return REEL_SYMBOLS[Math.floor(Math.random() * REEL_SYMBOLS.length)];
	}

	function startSpinAnimation() {
		// Set random symbols once — CSS handles the visual spin effect
		for (let col = 0; col < COLS; col++) {
			for (let row = 0; row < ROWS; row++) {
				spinSymbols[col][row] = randomReelSymbol();
			}
		}
	}

	function stopSpinAnimation() {
		// No-op — no interval to clear
	}
	function saveFreeSpinState() {
		if (typeof localStorage === 'undefined') return;
		if (freeSpins > 0 || wasFreeSpinMode) {
			localStorage.setItem('freeSpinState', JSON.stringify({
				freeSpins, bet, freeSpinSessionPayout, freeSpinTotal, wasFreeSpinMode, freeSpinMultiplier, freeSpinRound
			}));
		} else {
			localStorage.removeItem('freeSpinState');
		}
	}

	function clearFreeSpinState() {
		if (typeof localStorage !== 'undefined') localStorage.removeItem('freeSpinState');
	}

	onMount(() => {
		// Restore auto-skip state from localStorage
		if (typeof localStorage !== 'undefined') {
			autoSkip = localStorage.getItem('slotAutoSkip') === 'true';
		}
		// Restore free spin state from localStorage
		if (typeof localStorage !== 'undefined') {
			const saved = localStorage.getItem('freeSpinState');
			if (saved) {
				try {
					const state = JSON.parse(saved);
					freeSpins = state.freeSpins ?? 0;
					bet = state.bet ?? BET_OPTIONS[0];
					freeSpinSessionPayout = state.freeSpinSessionPayout ?? 0;
					freeSpinTotal = state.freeSpinTotal ?? 0;
					wasFreeSpinMode = state.wasFreeSpinMode ?? false;
					freeSpinMultiplier = state.freeSpinMultiplier ?? 1;
					freeSpinRound = state.freeSpinRound ?? 0;
					if (freeSpins > 0 && autoSpin) {
						setTimeout(() => handleSpin(), 500);
					}
				} catch { /* ignore */ }
			}
		}

		return () => {
			// Cleanup GSAP on unmount
			if (activeBigWinTimeline) activeBigWinTimeline.kill();
			if (activeFreeSpinCountTween) activeFreeSpinCountTween.kill();
		};
	});

	function toggleAutoSkip() {
		autoSkip = !autoSkip;
		if (typeof localStorage !== 'undefined') localStorage.setItem('slotAutoSkip', autoSkip ? 'true' : 'false');
		if (spinning && autoSkip) skipRequested = true;
	}

	function setMessage(msg: string, type: 'win' | 'lose' | 'info' | 'free') {
		message = msg;
		messageType = type;
	}

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

	/**
	 * Get reel cell elements for a specific column, used for GSAP reel landing.
	 */
	function getReelCellElements(col: number): HTMLElement[] {
		if (!reelGridEl) return [];
		const cells: HTMLElement[] = [];
		for (let row = 0; row < ROWS; row++) {
			const index = row * COLS + col;
			const cell = reelGridEl.children[index] as HTMLElement;
			if (cell) {
				const inner = cell.querySelector('.reel-symbol-inner') as HTMLElement;
				if (inner) cells.push(inner);
			}
		}
		return cells;
	}

	/**
	 * Animate GSAP reel landing for a column — elastic bounce.
	 */
	function animateReelLand(col: number) {
		const cellEls = getReelCellElements(col);
		reelLandColumn(cellEls);
	}

	async function handleSpin() {
		if (spinning || showFreeSpinSummary) return;

		const isFree = freeSpins > 0;

		if (!isFree && wallet.credit < bet) {
			autoSpin = false;
			setMessage('บาทไม่พอ กรุณาเบิกทุน', 'info');
			return;
		}

		if (isFree && !wasFreeSpinMode) {
			wasFreeSpinMode = true;
			freeSpinSessionPayout = 0;
			freeSpinRound = 0;
			freeSpinMultiplier = 1;
		}

		// Spin button press micro-animation
		if (spinBtnEl && !autoSpin && !autoSpin) {
			spinButtonPress(spinBtnEl);
		}

		const creditBefore = wallet.credit;
		spinning = true;
		gameInProgress.value = true;

		if (!isFree) {
			playBet();
			wallet.credit -= bet;
		}
		if (isFree) {
			freeSpins--;
			freeSpinRound++;
			freeSpinMultiplier = freeSpinRound >= 5 ? 1.5 : 1;
		}
		saveFreeSpinState();

		message = '';
		messageType = '';
		result = null;
		winCells = [];

		colState = ['spinning', 'spinning', 'spinning', 'spinning', 'spinning'];
		startSpinAnimation();
		skipRequested = false;
		if (autoSkip) skipRequested = true;
		const stopSpin = playSlotSpin(3.0);

		let data: any;
		try {
			const res = await fetch('/api/games/slot/play', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ bet, freeSpin: isFree, freeSpinMultiplier: isFree ? freeSpinMultiplier : 1 })
			});
			data = await res.json();
			if (!res.ok) {
				stopSpinAnimation();
				stopSpin();
				spinning = false;
				gameInProgress.value = false;
				if (!isFree) wallet.credit += bet;
				if (isFree) { freeSpins++; freeSpinRound--; freeSpinMultiplier = Math.min(2, 1 + Math.floor(freeSpinRound / 5)); }
				colState = ['idle', 'idle', 'idle', 'idle', 'idle'];
				setMessage(data.error || 'เกิดข้อผิดพลาด', 'info');
				return;
			}
		} catch {
			stopSpinAnimation();
			stopSpin();
			spinning = false;
			gameInProgress.value = false;
			if (!isFree) wallet.credit += bet;
			if (isFree) { freeSpins++; freeSpinRound--; freeSpinMultiplier = Math.min(2, 1 + Math.floor(freeSpinRound / 5)); }
			colState = ['idle', 'idle', 'idle', 'idle', 'idle'];
			setMessage('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', 'info');
			return;
		}

		const newGrid: Grid = data.outcome.grid;
		const spinResult: SpinResult = {
			grid: newGrid,
			lineWins: data.outcome.lineWins,
			scatterCount: data.outcome.scatterCount,
			freeSpinsWon: data.outcome.freeSpinsWon,
			totalPayout: data.outcome.totalPayout
		};

			if (!skipRequested) {
			await delay(500);

			for (let col = 0; col < COLS; col++) {
				if (skipRequested) break;

				if (col > 0 && col < COLS - 1) await delay(150);
				grid[col] = newGrid[col];
				colState[col] = 'landing';
				playReelStop();

				requestAnimationFrame(() => animateReelLand(col));

				if (!skipRequested) await delay(250);
				colState[col] = 'idle';
			}
		}

		// Resolve all remaining columns instantly
		stopSpinAnimation();
		for (let col = 0; col < COLS; col++) {
			grid[col] = newGrid[col];
			colState[col] = 'idle';
		}
		stopSpin();
		skipRequested = false;

		await delay(50);

		result = spinResult;

		// Mark winning cells for visual highlight
		const cells: string[] = [];
		for (const lw of spinResult.lineWins) {
			const line = PAYLINES[lw.lineIndex];
			for (let col = 0; col < lw.count; col++) {
				cells.push(`${col}-${line[col]}`);
			}
		}
		for (let col = 0; col < 5; col++) {
			for (let row = 0; row < ROWS; row++) {
				if (grid[col][row].id === 'scatter' && spinResult.scatterCount >= 4) {
					cells.push(`${col}-${row}`);
				}
			}
		}
		winCells = cells;



		if (spinResult.freeSpinsWon > 0) {
			freeSpins += spinResult.freeSpinsWon;
			freeSpinTotal += spinResult.freeSpinsWon;
			saveFreeSpinState();
		}

		const actualPayout = data.payout ?? spinResult.totalPayout;

		if (actualPayout > 0 || spinResult.freeSpinsWon > 0) {
			wallet.credit = data.newCredit;
			stats.totalSpent = data.stats.totalSpent;
			stats.totalReceived = data.stats.totalReceived;
			if (isFree) freeSpinSessionPayout += actualPayout;
			const parts: string[] = [];
			const bonusWins = spinResult.lineWins.filter((w: any) => w.patternMultiplier > 1);
			if (bonusWins.length > 0) {
				const bonusNames = bonusWins.map((w: any) => `${w.patternName} x${w.patternMultiplier}`).join(', ');
				parts.push(bonusNames);
			}
			if (actualPayout > 0) {
				if (isFree && freeSpinMultiplier > 1) {
					parts.push(`+${spinResult.totalPayout.toLocaleString()} x${freeSpinMultiplier} = ${actualPayout.toLocaleString()}`);
				} else if (isFree) {
					parts.push(`+${actualPayout.toLocaleString()}`);
				} else {
					const netDisplay = actualPayout - bet;
					if (netDisplay >= 0) {
						parts.push(`+${netDisplay.toLocaleString()}`);
					} else {
						parts.push(`${netDisplay.toLocaleString()}`);
					}
				}
			}
			if (spinResult.freeSpinsWon > 0) parts.push(`Free Spin x${spinResult.freeSpinsWon}!`);
			const netResult = isFree ? actualPayout : actualPayout - bet;
			if (netResult < 0 && spinResult.freeSpinsWon === 0) {
				setMessage(parts.join(' | '), 'lose');
				playLose();
			} else {
				setMessage(parts.join(' | '), spinResult.freeSpinsWon > 0 ? 'free' : 'win');
				playWin();
			}

			// === Win Tier Celebration System ===
			const winRatio = actualPayout / bet;
			if (actualPayout > 0 && reelGridEl) {
				if (winRatio > 10) {
					gridShake(reelGridEl, 'heavy');
				} else if (winRatio > 5) {
					gridShake(reelGridEl, 'medium');
				} else if (winRatio > 2) {
					gridShake(reelGridEl, 'light');
				}
			}

			if (!isFree && actualPayout > 0) {
				const profit = actualPayout - bet;
				if (profit > creditBefore * 0.5 && profit > 0) {
					bigWinAmount = profit;
					showBigWin = true;
					playBigWin();
					// GSAP big win celebration is triggered via $effect
				}
			}
		} else {
			wallet.credit = data.newCredit;
			stats.totalSpent = data.stats.totalSpent;
			stats.totalReceived = data.stats.totalReceived;
			if (isFree) {
				setMessage('ไม่ถูกรางวัล', 'lose');
			} else {
				setMessage(`-${bet.toLocaleString()}`, 'lose');
			}
			playLose();
		}

		spinning = false;

		const willAutoFree = freeSpins > 0 && autoSpin;
		const willAutoNormal = !isFree && autoSpin && wallet.credit >= bet;
		const willContinue = willAutoFree || willAutoNormal || spinResult.freeSpinsWon > 0;
		if (!willContinue) gameInProgress.value = false;

		if (spinResult.freeSpinsWon > 0) {
			freeSpinsWonCount = spinResult.freeSpinsWon;
			showFreeSpinWon = true;
			return;
		}

		if (freeSpins > 0 && autoSpin) {
			await delay(400);
			if (autoSpin && freeSpins > 0) { handleSpin(); }
			else { gameInProgress.value = false; }
		} else if (freeSpins <= 0 && wasFreeSpinMode) {
			wasFreeSpinMode = false;
			gameInProgress.value = false;
			await showFreeSpinResult(freeSpinSessionPayout);
		} else if (!isFree && autoSpin && wallet.credit >= bet) {
			await delay(400);
			if (autoSpin && wallet.credit >= bet) { handleSpin(); }
			else { gameInProgress.value = false; }
		} else if (!isFree && autoSpin && wallet.credit < bet) {
			autoSpin = false;
			gameInProgress.value = false;
		}
	}

	async function showFreeSpinResult(total: number) {
		showFreeSpinSummary = true;
		freeSpinDisplayCount = 0;

		// Use GSAP for smooth counter animation
		await delay(100); // Let modal render

		if (activeFreeSpinCountTween) activeFreeSpinCountTween.kill();
		activeFreeSpinCountTween = freeSpinCountUp(total, (value) => {
			freeSpinDisplayCount = value;
		});
	}

	function dismissFreeSpinSummary() {
		showFreeSpinSummary = false;
		freeSpinSessionPayout = 0;
		if (activeFreeSpinCountTween) { activeFreeSpinCountTween.kill(); activeFreeSpinCountTween = null; }
		if (savedBetBeforeFreeSpin > 0) {
			bet = savedBetBeforeFreeSpin;
			savedBetBeforeFreeSpin = 0;
		}
		clearFreeSpinState();
	}

	async function dismissFreeSpinWon() {
		showFreeSpinWon = false;
		if (freeSpins > 0 && autoSpin) {
			await delay(400);
			if (autoSpin && freeSpins > 0) handleSpin();
		} else if (freeSpins <= 0 && wasFreeSpinMode) {
			wasFreeSpinMode = false;
			await showFreeSpinResult(freeSpinSessionPayout);
		}
	}

	function confirmBuyFreeSpin() {
		showBuyConfirm = true;
	}

	async function buyFreeSpin() {
		showBuyConfirm = false;
		if (wallet.credit < FREE_SPIN_PRICE) {
			setMessage('บาทไม่พอ', 'info');
			return;
		}
		try {
			const res = await fetch('/api/games/slot/buy-freespin', { method: 'POST' });
			const data = await res.json();
			if (!res.ok) {
				setMessage(data.error || 'เกิดข้อผิดพลาด', 'info');
				return;
			}
			wallet.credit = data.newCredit;
			if (data.stats) {
				stats.totalSpent = data.stats.totalSpent;
				stats.totalReceived = data.stats.totalReceived;
			}
		} catch {
			setMessage('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', 'info');
			return;
		}
		savedBetBeforeFreeSpin = bet;
		bet = FREE_SPIN_BET;
		freeSpins += 10;
		freeSpinTotal += 10;
		setMessage(`ซื้อ Free Spin 10 รอบ (−${FREE_SPIN_PRICE.toLocaleString()})`, 'free');
		saveFreeSpinState();
	}

	function cancelBuyFreeSpin() {
		showBuyConfirm = false;
	}

	function dismissBigWin() {
		showBigWin = false;
		if (activeBigWinTimeline) { activeBigWinTimeline.kill(); activeBigWinTimeline = null; }
	}


	function delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	// GSAP modal entrance effects — triggered when modals become visible
	$effect(() => {
		if (showBigWin && bigWinBackdropEl && bigWinModalEl && bigWinEmojiEl && bigWinTitleEl && bigWinAmountEl && bigWinConfettiEl) {
			activeBigWinTimeline = bigWinCelebration(
				bigWinBackdropEl,
				bigWinModalEl,
				bigWinEmojiEl,
				bigWinTitleEl,
				bigWinAmountEl,
				bigWinAmount,
				bigWinConfettiEl
			);
		}
	});

	$effect(() => {
		if (showFreeSpinWon && freeSpinWonBackdropEl && freeSpinWonModalEl) {
			freeSpinPopup(freeSpinWonBackdropEl, freeSpinWonModalEl);
		}
	});

	$effect(() => {
		if (showFreeSpinSummary && freeSpinSummaryBackdropEl && freeSpinSummaryModalEl) {
			modalEntrance(freeSpinSummaryBackdropEl, freeSpinSummaryModalEl);
		}
	});

	$effect(() => {
		if (showBuyConfirm && buyConfirmBackdropEl && buyConfirmModalEl) {
			modalEntrance(buyConfirmBackdropEl, buyConfirmModalEl);
		}
	});
</script>

<svelte:head>
	<title>Slot Machine - BUNG TAE DUBAI</title>
</svelte:head>

<!-- Big Win Modal — GSAP animated -->
{#if showBigWin}
	<div bind:this={bigWinBackdropEl} class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
		<div bind:this={bigWinModalEl} class="relative w-full max-w-sm rounded-2xl bg-gradient-to-b from-yellow-900/90 to-yellow-950/95 p-6 text-center shadow-2xl border border-yellow-500/40 overflow-hidden">
			<div bind:this={bigWinConfettiEl} class="gsap-confetti-container absolute inset-0 pointer-events-none overflow-hidden"></div>
			<div bind:this={bigWinEmojiEl} class="relative mb-2 text-5xl">🎉</div>
			<p bind:this={bigWinTitleEl} class="relative mb-1 text-lg font-bold text-yellow-400 drop-shadow">BIG WIN!</p>
			<p bind:this={bigWinAmountEl} class="relative my-3 text-4xl font-black tabular-nums text-yellow-300 drop-shadow sm:text-5xl">
				+{bigWinAmount.toLocaleString()}
			</p>
			<p class="relative mb-4 text-sm text-yellow-500/80">บาท</p>
			<button
				onclick={dismissBigWin}
				class="relative cursor-pointer rounded-xl bg-yellow-500 px-8 py-2.5 text-sm font-bold text-black transition hover:bg-yellow-400 active:scale-[0.98]"
			>
				เยี่ยม!
			</button>
		</div>
	</div>
{/if}

<!-- Free Spin Won Modal — GSAP animated -->
{#if showFreeSpinWon}
	<div bind:this={freeSpinWonBackdropEl} class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
		<div bind:this={freeSpinWonModalEl} class="w-full max-w-sm rounded-2xl bg-gradient-to-b from-purple-900/90 to-purple-950/95 p-6 text-center shadow-2xl border border-purple-500/40">
			<div class="mb-2 text-5xl">🎯</div>
			<p class="mb-1 text-lg font-bold text-purple-300">FREE SPIN!</p>
			<p class="my-3 text-4xl font-black tabular-nums text-purple-200 sm:text-5xl">x{freeSpinsWonCount}</p>
			<p class="mb-4 text-sm text-purple-400/80">Scatter {freeSpinsWonCount === 10 ? '4' : freeSpinsWonCount === 15 ? '5' : '6+'} ตัว — ได้ {freeSpinsWonCount} รอบฟรี!</p>
			<button
				onclick={dismissFreeSpinWon}
				class="cursor-pointer rounded-xl bg-purple-500 px-8 py-2.5 text-sm font-bold text-white transition hover:bg-purple-400 active:scale-[0.98]"
			>
				เริ่มหมุนฟรี!
			</button>
		</div>
	</div>
{/if}

<!-- Free Spin Summary Modal — GSAP animated -->
{#if showFreeSpinSummary}
	<div bind:this={freeSpinSummaryBackdropEl} class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
		<div bind:this={freeSpinSummaryModalEl} class="w-full max-w-sm rounded-2xl bg-slot-surface p-6 text-center shadow-xl">
			<p class="mb-1 text-sm text-slot-muted">Free Spin สิ้นสุด</p>
			<p class="mb-1 text-xs text-slot-muted">รวมรางวัลที่ได้</p>
			<p class="my-4 text-4xl font-bold tabular-nums text-slot-accent sm:text-5xl">
				{freeSpinDisplayCount.toLocaleString()}
			</p>
			<p class="mb-4 text-sm text-slot-muted">บาท</p>
			<button
				onclick={dismissFreeSpinSummary}
				class="cursor-pointer rounded-xl bg-slot-accent px-8 py-2.5 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98]"
			>
				ตกลง
			</button>
		</div>
	</div>
{/if}

<!-- Buy Free Spin Confirm Modal — GSAP animated -->
{#if showBuyConfirm}
	<div bind:this={buyConfirmBackdropEl} class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
		<div bind:this={buyConfirmModalEl} class="w-full max-w-sm rounded-2xl bg-slot-surface p-6 text-center shadow-xl">
			<p class="mb-2 text-sm font-medium text-slot-text">ยืนยันซื้อ Free Spin</p>
			<p class="mb-4 text-xs text-slot-muted">
				ซื้อ Free Spin 10 รอบ ในราคา
				<span class="font-bold text-slot-text">{FREE_SPIN_PRICE.toLocaleString()}</span> บาท
			</p>
			<div class="flex gap-2">
				<button
					onclick={cancelBuyFreeSpin}
					class="flex-1 cursor-pointer rounded-xl border border-slot-border px-4 py-2.5 text-sm font-medium text-slot-muted transition hover:bg-slot-bg"
				>
					ยกเลิก
				</button>
				<button
					onclick={buyFreeSpin}
					class="flex-1 cursor-pointer rounded-xl bg-slot-lose px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98]"
				>
					ซื้อ
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Fullscreen slot layout -->
<div class="relative flex h-full flex-col select-none">
	<!-- Reel grid: natural size based on cells -->
	<div class="px-1.5 pt-4 sm:px-3 sm:pt-5">
		<div
			class="relative w-full overflow-hidden rounded-t-2xl border-2 border-b-0 border-slot-accent/30 p-0.5 sm:p-1 casino-shadow-lg"
			style="background: linear-gradient(180deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)"
		>
			<div bind:this={reelGridEl} class="grid grid-cols-5 gap-px sm:gap-0.5">
				{#each [0, 1, 2, 3, 4] as row}
					{#each [0, 1, 2, 3, 4] as col}
						{@const displayCell = colState[col] === 'spinning' ? spinSymbols[col]?.[row] : grid[col]?.[row]}
						{@const state = colState[col]}
						{@const isWin = winCells.includes(`${col}-${row}`)}
						<div
							data-cell="{col}-{row}"
							class="reel-cell flex aspect-square items-center justify-center overflow-hidden rounded-sm sm:rounded bg-slot-bg"
							class:win-cell-gold={isWin && state === 'idle'}
						>
							{#if displayCell}
								<div
									class="reel-symbol-inner flex h-full w-full items-center justify-center
										{state === 'spinning' ? 'animate-reel-cycle' : ''}"
								>
									{@html SYMBOL_SVGS[displayCell.id]}
								</div>
							{/if}
						</div>
					{/each}
				{/each}
			</div>

		</div>
	</div>

	<!-- Win display bar (below grid) -->
	<div class="shrink-0 mx-1.5 sm:mx-3 rounded-b-xl border border-t-0 px-3 py-1 sm:py-1.5
		{messageType === 'win' ? 'slot-win-bar' : 'border-slot-accent/20 bg-slot-surface/80'}">
		{#if message}
			<p class="relative z-10 text-center text-[11px] font-bold sm:text-xs
				{messageType === 'win' ? 'text-amber-700' : ''}
				{messageType === 'lose' ? 'text-slot-lose' : ''}
				{messageType === 'info' ? 'text-slot-accent' : ''}
				{messageType === 'free' ? 'text-amber-600' : ''}"
			>
				{message}
			</p>
		{:else if isFreeSpinMode}
			<p class="text-center text-[10px] font-bold text-slot-accent sm:text-[11px]">FREE SPIN เหลือ {freeSpins} รอบ</p>
		{:else}
			<p class="text-center text-[10px] text-slot-muted sm:text-[11px]">กดหมุนเพื่อเริ่มเกม</p>
		{/if}
	</div>

	<!-- Free Spin persistent bar (visible during free spin) -->
	{#if isFreeSpinMode}
		<div class="shrink-0 mx-1.5 sm:mx-3 mt-1">
			<div class="animate-fade-in flex flex-wrap items-center justify-center gap-x-2 gap-y-1 sm:gap-x-3 rounded-lg bg-slot-accent/10 border border-slot-accent/30 px-2 py-1 sm:px-3 sm:py-1.5">
				<span class="text-[10px] font-bold text-slot-accent sm:text-xs">FREE SPIN</span>
				<span class="text-[9px] text-slot-muted sm:text-[11px]">เหลือ {freeSpins} รอบ</span>
				<span class="hidden sm:inline text-slot-accent/40">|</span>
				<span class="text-[9px] font-bold text-slot-accent sm:text-[11px]">x{freeSpinMultiplier}</span>
				<span class="hidden sm:inline text-slot-accent/40">|</span>
				<span class="text-[9px] text-slot-muted sm:text-[11px]">{freeSpinSessionPayout.toLocaleString()} บาท</span>
			</div>
		</div>
	{/if}

	<!-- Controls: Spin button centered, Bet left, Skip+FS right -->
	<div class="shrink-0 px-2 pb-2 pt-6 sm:px-4 sm:pb-5 sm:pt-10">
		<div class="relative mx-auto flex w-full items-center py-1">
			<!-- Left: Bet controls + credit (expand toward center) -->
			<div class="flex flex-1 items-center justify-end pr-4 sm:pr-6">
				<div class="flex flex-col items-center gap-1">
					<span class="text-[10px] tabular-nums text-slot-muted sm:text-xs" style="font-family: 'Courier New', Consolas, monospace;">
						{wallet.credit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿
					</span>
					<div class="flex items-center gap-0 rounded-xl border border-slot-border bg-slot-surface">
						<button
							onclick={decreaseBet}
							disabled={spinning || isFreeSpinMode}
							class="cursor-pointer rounded-l-xl px-3.5 py-1.5 text-sm font-bold text-slot-muted transition hover:text-slot-text disabled:cursor-not-allowed disabled:opacity-30 sm:px-5 sm:py-2 sm:text-base"
						>
							−
						</button>
						<div class="flex w-[72px] flex-col items-center border-x border-slot-border px-2 sm:w-[90px]">
							<span class="text-[6px] uppercase tracking-wider text-slot-muted sm:text-[7px]">BET</span>
							<input
								type="number"
								bind:value={bet}
								onblur={validateBet}
								disabled={spinning || isFreeSpinMode}
								min="1"
								class="w-full bg-transparent text-center text-xs font-bold tabular-nums outline-none disabled:opacity-60 sm:text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
							/>
						</div>
						<button
							onclick={increaseBet}
							disabled={spinning || isFreeSpinMode}
							class="cursor-pointer rounded-r-xl px-3.5 py-1.5 text-sm font-bold text-slot-muted transition hover:text-slot-text disabled:cursor-not-allowed disabled:opacity-30 sm:px-5 sm:py-2 sm:text-base"
						>
							+
						</button>
					</div>
				</div>
			</div>

			<!-- Center: Spin button -->
			<div class="z-10 shrink-0">
				<button
					bind:this={spinBtnEl}
					onclick={handleSpin}
					disabled={spinning || showFreeSpinSummary || autoSpin || (!isFreeSpinMode && wallet.credit < bet)}
					class="spin-btn cursor-pointer rounded-full
						disabled:cursor-not-allowed disabled:opacity-40
						{isFreeSpinMode ? 'spin-btn--free' : 'spin-btn--normal'}
						{spinning ? 'spin-btn--spinning' : ''}"
				>
					<span class="spin-btn__border"></span>
					<span class="spin-btn__shine"></span>
					{#if spinning}
						<span class="spin-btn__text spin-btn__text--spinning">SPIN</span>
					{:else if isFreeSpinMode}
						<span class="spin-btn__text">FREE</span>
					{:else}
						<span class="spin-btn__text">SPIN</span>
					{/if}
				</button>
			</div>

			<!-- Right: Auto + Skip + Buy FS (expand toward center) -->
			<div class="flex flex-1 items-center justify-start pl-4 sm:pl-6">
				<div class="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-2">
					<div class="flex items-center gap-1.5">
						<button
							onclick={() => { autoSpin = !autoSpin; if (autoSpin && !spinning) { if (isFreeSpinMode && freeSpins > 0) handleSpin(); else if (!isFreeSpinMode && wallet.credit >= bet) handleSpin(); } if (!autoSpin && !spinning) gameInProgress.value = false; }}
							class="cursor-pointer rounded-lg border px-3.5 py-1 text-[10px] font-bold transition sm:px-5 sm:py-1.5 sm:text-xs
								{autoSpin ? 'border-green-500 bg-green-500/10 text-green-400' : 'border-slot-border bg-slot-surface text-slot-muted hover:text-slot-text'}"
						>
							AUTO
						</button>
						<button
							onclick={toggleAutoSkip}
							class="cursor-pointer rounded-lg border px-3.5 py-1 text-[10px] font-bold transition sm:px-5 sm:py-1.5 sm:text-xs
								{autoSkip ? 'border-slot-accent bg-slot-accent/10 text-slot-accent' : 'border-slot-border bg-slot-surface text-slot-muted hover:text-slot-text'}"
						>
							{autoSkip ? 'ข้าม ON' : 'ข้าม'}
						</button>
					</div>
					<button
						onclick={confirmBuyFreeSpin}
						disabled={spinning || isFreeSpinMode || wallet.credit < FREE_SPIN_PRICE}
						class="cursor-pointer rounded-lg border border-slot-lose/30 bg-slot-lose/5 px-3.5 py-1 text-[10px] font-medium text-slot-lose transition hover:bg-slot-lose/10 disabled:cursor-not-allowed disabled:opacity-40 sm:px-5 sm:py-1.5 sm:text-xs"
					>
						ซื้อ Free Spin ฿{FREE_SPIN_PRICE}
					</button>
				</div>
			</div>
		</div>
	</div>

</div>
