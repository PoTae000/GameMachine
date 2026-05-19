<script lang="ts">
	import { SYMBOL_MULTIPLIERS, type SymbolType } from '$lib/games/scratchEngine';
	import { wallet, stats, gameInProgress } from '$lib/store.svelte';
	import { playBet, playScratch, playReveal, playWin, playLose, playBigWin, playRevealBig } from '$lib/sounds';

	const BET_OPTIONS = [1, 5, 10, 20, 50, 100, 200, 500];

	let bet = $state(BET_OPTIONS[0]);
	let phase: 'betting' | 'scratching' | 'result' = $state('betting');
	let grid: SymbolType[][] = $state([]);
	let revealed: boolean[][] = $state([[false,false,false],[false,false,false],[false,false,false]]);
	let matchSymbol: SymbolType | null = $state(null);
	let matchCount = $state(0);
	let multiplier = $state(0);
	let message = $state('');
	let messageType: 'win' | 'lose' | 'info' | '' = $state('');

	let showBigWin = $state(false);
	let bigWinAmount = $state(0);

	// Canvas scratching state
	let canvasEl: HTMLCanvasElement;
	let isScratching = $state(false);
	let scratchPercent = $state(0);
	let lastScratchSoundTime = 0;

	function initScratchCanvas() {
		if (!canvasEl) return;
		const ctx = canvasEl.getContext('2d')!;
		const w = canvasEl.width;
		const h = canvasEl.height;

		// Reset composite operation
		ctx.globalCompositeOperation = 'source-over';

		// Draw silver scratch-off coating
		const grad = ctx.createLinearGradient(0, 0, w, h);
		grad.addColorStop(0, '#c0c0c0');
		grad.addColorStop(0.3, '#e0e0e0');
		grad.addColorStop(0.5, '#d0d0d0');
		grad.addColorStop(0.7, '#e8e8e8');
		grad.addColorStop(1, '#b8b8b8');
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, w, h);

		// Add some texture lines
		ctx.fillStyle = 'rgba(255,255,255,0.1)';
		for (let i = 0; i < 50; i++) {
			const x = Math.random() * w;
			const y = Math.random() * h;
			ctx.fillRect(x, y, Math.random() * 8 + 2, 1);
		}

		// Add darker texture flecks
		ctx.fillStyle = 'rgba(0,0,0,0.04)';
		for (let i = 0; i < 30; i++) {
			const x = Math.random() * w;
			const y = Math.random() * h;
			ctx.fillRect(x, y, Math.random() * 4 + 1, Math.random() * 4 + 1);
		}

		// Add text
		ctx.fillStyle = 'rgba(255,255,255,0.3)';
		ctx.font = 'bold 14px sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText('SCRATCH HERE', w / 2, h / 2);
	}

	function scratch(e: MouseEvent | TouchEvent) {
		if (!canvasEl || phase !== 'scratching') return;
		const ctx = canvasEl.getContext('2d')!;
		const rect = canvasEl.getBoundingClientRect();

		let clientX: number, clientY: number;
		if ('touches' in e) {
			clientX = e.touches[0].clientX;
			clientY = e.touches[0].clientY;
		} else {
			clientX = e.clientX;
			clientY = e.clientY;
		}

		const x = (clientX - rect.left) * (canvasEl.width / rect.width);
		const y = (clientY - rect.top) * (canvasEl.height / rect.height);

		ctx.globalCompositeOperation = 'destination-out';
		ctx.beginPath();
		ctx.arc(x, y, 20, 0, Math.PI * 2);
		ctx.fill();

		// Play scratch sound periodically (not every frame)
		const now = Date.now();
		if (now - lastScratchSoundTime > 150) {
			playScratch();
			lastScratchSoundTime = now;
		}

		// Check scratch percentage
		checkScratchPercent();
	}

	function checkScratchPercent() {
		if (!canvasEl) return;
		const ctx = canvasEl.getContext('2d')!;
		const imageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
		const pixels = imageData.data;
		let transparent = 0;
		const total = pixels.length / 4;
		for (let i = 3; i < pixels.length; i += 4) {
			if (pixels[i] === 0) transparent++;
		}
		scratchPercent = (transparent / total) * 100;

		if (scratchPercent >= 50) {
			finishScratch();
		}
	}

	function finishScratch() {
		// Clear the canvas completely
		if (canvasEl) {
			const ctx = canvasEl.getContext('2d')!;
			ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
		}
		isScratching = false;
		// Reveal all and check result
		revealed = [[true,true,true],[true,true,true],[true,true,true]];
		checkAllRevealed();
	}

	function startScratch(e: MouseEvent | TouchEvent) {
		isScratching = true;
		scratch(e);
	}

	function moveScratch(e: MouseEvent | TouchEvent) {
		if (!isScratching) return;
		e.preventDefault();
		scratch(e);
	}

	function stopScratch() {
		isScratching = false;
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

	const SYMBOL_ICONS: Record<SymbolType, { svg: string; color: string; label: string; bg: string }> = {
		diamond: {
			svg: '<svg viewBox="0 0 40 40" class="h-10 w-10 sm:h-12 sm:w-12"><defs><linearGradient id="dg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#93c5fd"/><stop offset="50%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#1d4ed8"/></linearGradient><filter id="ds"><feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#3b82f6" flood-opacity="0.4"/></filter></defs><polygon points="20,2 38,20 20,38 2,20" fill="url(#dg)" filter="url(#ds)"/><polygon points="20,8 12,20 20,32 28,20" fill="white" opacity="0.15"/><polygon points="20,5 30,20 20,14" fill="white" opacity="0.2"/></svg>',
			color: '#3b82f6', label: 'เพชร', bg: 'rgba(59,130,246,0.08)'
		},
		crown: {
			svg: '<svg viewBox="0 0 40 40" class="h-10 w-10 sm:h-12 sm:w-12"><defs><linearGradient id="cg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fde68a"/><stop offset="50%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#d97706"/></linearGradient><filter id="cs"><feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#f59e0b" flood-opacity="0.4"/></filter></defs><path d="M5,30 L5,14 L12,22 L20,8 L28,22 L35,14 L35,30 Z" fill="url(#cg)" filter="url(#cs)"/><rect x="5" y="30" width="30" height="4" rx="1.5" fill="#d97706"/><circle cx="12" cy="30" r="2" fill="#fde68a"/><circle cx="20" cy="30" r="2" fill="#fde68a"/><circle cx="28" cy="30" r="2" fill="#fde68a"/><polygon points="20,8 22,14 18,14" fill="white" opacity="0.3"/></svg>',
			color: '#f59e0b', label: 'มงกุฎ', bg: 'rgba(245,158,11,0.08)'
		},
		heart: {
			svg: '<svg viewBox="0 0 40 40" class="h-10 w-10 sm:h-12 sm:w-12"><defs><linearGradient id="hg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fca5a5"/><stop offset="50%" stop-color="#ef4444"/><stop offset="100%" stop-color="#b91c1c"/></linearGradient><filter id="hs"><feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#ef4444" flood-opacity="0.4"/></filter></defs><path d="M20,35 C20,35 5,25 5,15 C5,9 9,5 14,5 C17,5 20,8 20,8 C20,8 23,5 26,5 C31,5 35,9 35,15 C35,25 20,35 20,35Z" fill="url(#hg)" filter="url(#hs)"/><ellipse cx="14" cy="13" rx="4" ry="3" fill="white" opacity="0.2" transform="rotate(-20,14,13)"/></svg>',
			color: '#ef4444', label: 'หัวใจ', bg: 'rgba(239,68,68,0.08)'
		},
		star: {
			svg: '<svg viewBox="0 0 40 40" class="h-10 w-10 sm:h-12 sm:w-12"><defs><linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#c4b5fd"/><stop offset="50%" stop-color="#8b5cf6"/><stop offset="100%" stop-color="#6d28d9"/></linearGradient><filter id="ss"><feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#8b5cf6" flood-opacity="0.4"/></filter></defs><polygon points="20,3 24,14 36,14 27,22 30,34 20,27 10,34 13,22 4,14 16,14" fill="url(#sg)" filter="url(#ss)"/><polygon points="20,7 23,14 20,12 17,14" fill="white" opacity="0.25"/></svg>',
			color: '#8b5cf6', label: 'ดาว', bg: 'rgba(139,92,246,0.08)'
		},
		circle: {
			svg: '<svg viewBox="0 0 40 40" class="h-10 w-10 sm:h-12 sm:w-12"><defs><radialGradient id="og" cx="40%" cy="35%"><stop offset="0%" stop-color="#86efac"/><stop offset="60%" stop-color="#22c55e"/><stop offset="100%" stop-color="#15803d"/></radialGradient><filter id="os"><feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#22c55e" flood-opacity="0.4"/></filter></defs><circle cx="20" cy="20" r="15" fill="url(#og)" filter="url(#os)"/><ellipse cx="15" cy="14" rx="5" ry="4" fill="white" opacity="0.2" transform="rotate(-20,15,14)"/></svg>',
			color: '#22c55e', label: 'วงกลม', bg: 'rgba(34,197,94,0.08)'
		}
	};

	let creditBefore = 0;
	let serverData: { payout: number; won: boolean; newCredit: number; stats: { totalSpent: number; totalReceived: number } } | null = null;

	async function buyCard() {
		if (wallet.credit < bet) return;

		creditBefore = wallet.credit;
		gameInProgress.value = true;

		// Call server API
		const res = await fetch('/api/games/scratch/play', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ bet })
		});
		const data = await res.json();
		if (!res.ok) { message = data.error || 'error'; messageType = 'info'; gameInProgress.value = false; return; }

		serverData = data;


		grid = data.outcome.grid;
		matchSymbol = data.outcome.result.matchSymbol;
		matchCount = data.outcome.result.matchCount;
		multiplier = data.outcome.result.multiplier;
		revealed = [[false,false,false],[false,false,false],[false,false,false]];
		message = '';
		messageType = '';
		scratchPercent = 0;
		isScratching = false;
		phase = 'scratching';
		playBet();

		// Wait for canvas to mount, then initialize
		await delay(50);
		initScratchCanvas();
	}

	// Also initialize canvas via $effect in case buyCard's delay isn't enough
	$effect(() => {
		if (phase === 'scratching' && canvasEl) {
			initScratchCanvas();
		}
	});

	function checkAllRevealed() {
		const allOpen = revealed.every((row) => row.every((c) => c));
		if (!allOpen) return;

		phase = 'result';
		gameInProgress.value = false;
		playRevealBig();
		playReveal();

		// Set final credit and stats from server
		if (serverData) {
			wallet.credit = serverData.newCredit;
			stats.totalSpent = serverData.stats.totalSpent;
			stats.totalReceived = serverData.stats.totalReceived;
		}

		if (multiplier > 0) {
			const profit = (serverData?.payout ?? 0) - bet;
			message = `${SYMBOL_ICONS[matchSymbol!].label} x${matchCount} — ชนะ +${profit.toLocaleString()} (x${multiplier})`;
			messageType = 'win';
			if (profit > creditBefore * 0.5 && profit > 0) { bigWinAmount = profit; showBigWin = true; playBigWin(); } else { playWin(); }
		} else {
			message = 'ไม่ถูกรางวัล';
			messageType = 'lose';
			playLose();
		}
	}

	function newCard() {
		gameInProgress.value = false;
		phase = 'betting';
		grid = [];
		revealed = [[false,false,false],[false,false,false],[false,false,false]];
		message = '';
		messageType = '';
		matchSymbol = null;
		matchCount = 0;
		multiplier = 0;
		scratchPercent = 0;
		isScratching = false;
	}

	function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
</script>

<svelte:head><title>Scratch Card - BUNG TAE DUBAI</title></svelte:head>

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
	<h2 class="mb-3 text-lg font-bold text-slot-accent sm:text-xl">Scratch Card ขูดการ์ด</h2>

	<!-- Scratch Card -->
	{#if phase === 'scratching' || phase === 'result'}
		<div class="scratch-card mb-4 rounded-2xl p-4 casino-shadow-lg">
			<!-- Card header -->
			<div class="mb-3 text-center">
				<div class="text-xs font-bold uppercase tracking-widest text-amber-700/60">Scratch & Win</div>
				<div class="scratch-divider my-1.5"></div>
			</div>

			<!-- Scratch area: symbols behind, canvas on top -->
			<div class="relative">
				<!-- Symbols grid (always visible behind canvas) -->
				<div class="grid grid-cols-3 gap-2.5 sm:gap-3">
					{#each grid as row, r}
						{#each row as sym, c}
							{@const isMatch = matchSymbol === sym && phase === 'result'}
							<div class="scratch-cell flex items-center justify-center rounded-xl"
								style={isMatch ? '--glow-color: ' + SYMBOL_ICONS[sym].color : ''}>
								<div class="scratch-revealed rounded-xl {isMatch ? 'animate-glow ring-2 ring-offset-1' : ''}"
									style="background: {SYMBOL_ICONS[sym].bg}; {isMatch ? 'ring-color: ' + SYMBOL_ICONS[sym].color + '40' : ''}">
									{@html SYMBOL_ICONS[sym].svg}
								</div>
							</div>
						{/each}
					{/each}
				</div>

				<!-- Scratch canvas overlay -->
				{#if phase === 'scratching'}
					<canvas
						bind:this={canvasEl}
						width="300"
						height="300"
						class="absolute inset-0 h-full w-full cursor-crosshair rounded-xl touch-none"
						onmousedown={startScratch}
						onmousemove={moveScratch}
						onmouseup={stopScratch}
						onmouseleave={stopScratch}
						ontouchstart={startScratch}
						ontouchmove={moveScratch}
						ontouchend={stopScratch}
					></canvas>
				{/if}
			</div>

			<!-- Card footer -->
			<div class="mt-3 text-center">
				<div class="scratch-divider mb-1.5"></div>
				{#if phase === 'scratching'}
					<div class="text-[10px] text-amber-700/40">ขูดเพื่อเปิดการ์ด!</div>
				{:else}
					<div class="text-[10px] text-amber-700/40">3 ตัวเหมือนกัน = ชนะ!</div>
				{/if}
			</div>
		</div>

		{#if phase === 'scratching'}
			<button onclick={finishScratch} class="mb-3 w-full cursor-pointer rounded-xl border border-slot-border bg-slot-surface px-4 py-2.5 text-xs font-bold text-slot-muted transition hover:border-slot-accent/40 hover:text-slot-text casino-shadow">เปิดทั้งหมด</button>
		{/if}
	{/if}

	{#if message}
		<div class="animate-slide-up mb-3 w-full rounded-xl px-4 py-2.5 text-center text-sm font-bold casino-shadow
			{messageType === 'win' ? 'bg-green-50 text-slot-win border border-green-200' : ''}
			{messageType === 'lose' ? 'bg-red-50 text-slot-lose border border-red-200' : ''}
			{messageType === 'info' ? 'bg-slot-accent/10 text-slot-accent border border-slot-accent/20' : ''}">{message}</div>
	{/if}

	{#if phase === 'betting'}
		<!-- Paytable -->
		<div class="mb-3 w-full rounded-xl border border-slot-border bg-slot-surface p-3 casino-shadow">
			<div class="grid grid-cols-5 gap-2 text-center">
				{#each (['diamond','crown','heart','star','circle'] as SymbolType[]) as sym}
					<div class="flex flex-col items-center gap-1">
						<div class="h-8 w-8">{@html SYMBOL_ICONS[sym].svg}</div>
						<div class="text-[10px] font-bold" style="color: {SYMBOL_ICONS[sym].color}">x{SYMBOL_MULTIPLIERS[sym]}</div>
					</div>
				{/each}
			</div>
		</div>

		<div class="mb-4 flex w-full items-center gap-2 sm:gap-3">
			<div class="flex items-center gap-0 rounded-xl border border-slot-border bg-slot-surface casino-shadow">
				<button onclick={decreaseBet} class="cursor-pointer rounded-l-xl px-2.5 py-1.5 text-base font-bold text-slot-muted transition hover:text-slot-text sm:px-3 sm:py-2 sm:text-lg">−</button>
				<div class="flex min-w-[3.5rem] flex-col items-center border-x border-slot-border px-1 sm:min-w-[4.5rem]">
					<span class="text-[9px] uppercase tracking-wider text-slot-muted">BET</span>
					<input type="number" bind:value={bet} onblur={validateBet} min="1" class="w-full bg-transparent text-center text-sm font-bold tabular-nums outline-none sm:text-base [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
				</div>
				<button onclick={increaseBet} class="cursor-pointer rounded-r-xl px-2.5 py-1.5 text-base font-bold text-slot-muted transition hover:text-slot-text sm:px-3 sm:py-2 sm:text-lg">+</button>
			</div>
			<button onclick={buyCard} disabled={wallet.credit < bet} class="flex-1 cursor-pointer rounded-xl bg-slot-accent px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 casino-shadow sm:text-base">ซื้อการ์ด</button>
		</div>
	{:else if phase === 'result'}
		<button onclick={newCard} class="w-full cursor-pointer rounded-xl bg-slot-accent px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] casino-shadow sm:text-base">การ์ดใหม่</button>
	{/if}

	<div class="mt-4 w-full rounded-xl border border-slot-border bg-slot-surface p-3 text-xs text-slot-muted casino-shadow">
		<p class="font-medium text-slot-text">วิธีเล่น</p>
		<p class="mt-1">ขูดเปิดการ์ด 3x3 — ถ้ามี 3+ ตัวเหมือนกัน จะได้รางวัล</p>
		<p>3 ตัว = x1 | 4 ตัว = x2 | 5+ ตัว = x3 (คูณกับค่า symbol)</p>
	</div>
</div>

<style>
	.scratch-card {
		background: linear-gradient(145deg, #fef3c7, #fde68a, #fcd34d, #fde68a, #fef3c7);
		border: 2px solid #d97706;
		position: relative;
		overflow: hidden;
	}
	.scratch-card::before {
		content: '';
		position: absolute;
		inset: 3px;
		border: 1px dashed #d9770640;
		border-radius: 14px;
		pointer-events: none;
	}
	.scratch-divider {
		height: 1px;
		background: linear-gradient(90deg, transparent, #d9770640, transparent);
	}
	.scratch-cell {
		width: 80px;
		height: 80px;
	}
	@media (min-width: 640px) {
		.scratch-cell { width: 96px; height: 96px; }
	}
	.scratch-revealed {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		padding: 8px;
	}
</style>
