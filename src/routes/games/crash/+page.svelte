<script lang="ts">
	import { wallet, stats, gameInProgress, currentUser } from '$lib/store.svelte';
	import { onMount } from 'svelte';
	import { playBet, playTick, playExplosion, playWin, playLose, playCashout, playBigWin, playHeartbeat, playSuspenseLong } from '$lib/sounds';

	const BET_OPTIONS = [1, 5, 10, 20, 50, 100, 200, 500];
	const MAX_ANIMATION_MULTIPLIER = 100;

	let bet = $state(BET_OPTIONS[0]);
	let phase: 'betting' | 'running' | 'crashed' | 'cashed_out' = $state('betting');
	let crashPoint = $state(0);
	let currentMultiplier = $state(1.0);
	let cashedOutAt = $state(0);
	let message = $state('');
	let messageType: 'win' | 'lose' | 'info' | '' = $state('');
	let graphPoints: { x: number; y: number }[] = $state([]);
	let elapsed = $state(0);
	let cashingOut = $state(false);

	let showBigWin = $state(false);
	let bigWinAmount = $state(0);
	let creditBefore = 0;

	let animFrameId = 0;
	let startTime = 0;
	let tickSoundInterval = 0;
	let heartbeatInterval = 0;
	let heartbeatActive = $state(false);
	let serverCheckInterval = 0;

	onMount(() => {
		return () => { cancelAnimationFrame(animFrameId); clearInterval(tickSoundInterval); clearInterval(heartbeatInterval); clearInterval(serverCheckInterval); };
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

	async function start() {
		if (wallet.credit < bet) return;

		cancelAnimationFrame(animFrameId);
		clearInterval(tickSoundInterval);
		clearInterval(heartbeatInterval);
		heartbeatActive = false;

		creditBefore = wallet.credit;
		message = '';
		messageType = '';
		cashedOutAt = 0;
		crashPoint = 0;
		graphPoints = [{ x: 0, y: 1 }];
		elapsed = 0;
		cashingOut = false;

		try {
			const res = await fetch('/api/games/crash/start', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ bet })
			});
			const data = await res.json();
			if (!res.ok || !data.started) {
				message = data.error || 'Failed to start game';
				messageType = 'lose';
				return;
			}
			wallet.credit = data.newCredit;
		} catch {
			message = 'Connection error';
			messageType = 'lose';
			return;
		}

		phase = 'running';
		gameInProgress.value = true;
		currentMultiplier = 1.0;
		startTime = performance.now();
		playBet();
		tickSoundInterval = setInterval(() => { if (phase === 'running') playTick(); }, 400) as unknown as number;
		serverCheckInterval = setInterval(() => { if (phase === 'running') checkServerCrash(); }, 500) as unknown as number;
		tick();
	}

	function tick() {
		if (phase !== 'running') return;

		const now = performance.now();
		elapsed = (now - startTime) / 1000;
		currentMultiplier = Math.round(Math.pow(Math.E, elapsed * 0.4) * 100) / 100;

		graphPoints = [...graphPoints, { x: elapsed, y: currentMultiplier }];

		if (currentMultiplier >= 2 && !heartbeatActive) {
			heartbeatActive = true;
			playHeartbeat();
			heartbeatInterval = setInterval(() => {
				if (phase === 'running') playHeartbeat();
			}, 1200) as unknown as number;
		}

		if (currentMultiplier >= MAX_ANIMATION_MULTIPLIER) {
			cashOut();
			return;
		}

		animFrameId = requestAnimationFrame(tick);
	}

	async function checkServerCrash() {
		if (phase !== 'running') return;
		try {
			const res = await fetch('/api/games/crash/tick', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ multiplier: currentMultiplier })
			});
			const data = await res.json();
			if (data.crashed && phase === 'running') {
				crashPoint = data.crashPoint;
				currentMultiplier = crashPoint;
				graphPoints = [...graphPoints, { x: elapsed, y: crashPoint }];
				triggerCrash();
			}
		} catch { /* ignore network errors during check */ }
	}

	async function triggerCrash() {
		cancelAnimationFrame(animFrameId);
		clearInterval(tickSoundInterval);
		clearInterval(heartbeatInterval);
		clearInterval(serverCheckInterval);
		heartbeatActive = false;

		phase = 'crashed';
		gameInProgress.value = false;
		playSuspenseLong();
		playExplosion();
		playLose();
		message = `CRASHED @ ${crashPoint.toFixed(2)}x — เสีย ${bet.toLocaleString()}`;
		messageType = 'lose';

		try {
			const res = await fetch('/api/games/crash/cashout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ multiplier: crashPoint + 1 })
			});
			const data = await res.json();
			if (res.ok) {
				wallet.credit = data.newCredit;
				if (data.stats) {
					stats.totalSpent = data.stats.totalSpent;
					stats.totalReceived = data.stats.totalReceived;
				}
			}
		} catch { /* session will expire on its own */ }
	}

	async function cashOut() {
		if (phase !== 'running' || cashingOut) return;
		cashingOut = true;
		cancelAnimationFrame(animFrameId);
		clearInterval(tickSoundInterval);
		clearInterval(heartbeatInterval);
		clearInterval(serverCheckInterval);
		heartbeatActive = false;

		const requestedMultiplier = currentMultiplier;

		try {
			const res = await fetch('/api/games/crash/cashout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ multiplier: requestedMultiplier })
			});
			const data = await res.json();

			if (!res.ok) {
				message = data.error || 'Cashout failed';
				messageType = 'lose';
				phase = 'crashed';
				gameInProgress.value = false;
				cashingOut = false;
				return;
			}

			wallet.credit = data.newCredit;
			if (data.stats) {
				stats.totalSpent = data.stats.totalSpent;
				stats.totalReceived = data.stats.totalReceived;
			}
			if (data.graduated && currentUser.value) {
				currentUser.value = { ...currentUser.value, isNewUser: false };
			}

			if (data.crashed) {
				crashPoint = data.crashPoint;
				currentMultiplier = crashPoint;
				graphPoints = [...graphPoints, { x: elapsed, y: crashPoint }];
				phase = 'crashed';
				playSuspenseLong();
				playExplosion();
				playLose();
				message = `CRASHED @ ${crashPoint.toFixed(2)}x — เสีย ${bet.toLocaleString()}`;
				messageType = 'lose';
				gameInProgress.value = false;
			} else {
				cashedOutAt = data.cashoutMultiplier;
				currentMultiplier = cashedOutAt;
				phase = 'cashed_out';
				playCashout();
				playWin();
				const profit = data.payout - bet;
				message = `Cash Out @ ${cashedOutAt.toFixed(2)}x — ชนะ +${profit.toLocaleString()}`;
				messageType = 'win';
				gameInProgress.value = false;
				if (profit > creditBefore * 0.5 && profit > 0) { bigWinAmount = profit; showBigWin = true; playBigWin(); }
			}
		} catch {
			message = 'Connection error';
			messageType = 'lose';
			phase = 'crashed';
			gameInProgress.value = false;
		}
		cashingOut = false;
	}

	function newGame() {
		cancelAnimationFrame(animFrameId);
		clearInterval(tickSoundInterval);
		clearInterval(heartbeatInterval);
		clearInterval(serverCheckInterval);

		phase = 'betting';
		currentMultiplier = 1.0;
		crashPoint = 0;
		graphPoints = [];
		elapsed = 0;
		cashedOutAt = 0;
		message = '';
		messageType = '';
		heartbeatActive = false;
	}

	// --- Graph helpers ---
	const GW = 360, GH = 220, GP = 36;

	function maxYScale() {
		return Math.max(currentMultiplier, crashPoint, cashedOutAt, 3);
	}

	function toSvg(p: { x: number; y: number }): { x: number; y: number } {
		const maxX = Math.max(elapsed, 3);
		const maxY = maxYScale();
		return {
			x: GP + (p.x / maxX) * (GW - GP * 2),
			y: GH - GP - ((p.y - 1) / (maxY - 1)) * (GH - GP * 2)
		};
	}

	function getLinePath(pts: { x: number; y: number }[]): string {
		if (pts.length < 2) return '';
		const svgPts = pts.map(toSvg);
		return svgPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
	}

	function getAreaPath(pts: { x: number; y: number }[]): string {
		if (pts.length < 2) return '';
		const line = getLinePath(pts);
		const svgPts = pts.map(toSvg);
		const bottom = GH - GP;
		return `${line} L${svgPts[svgPts.length - 1].x.toFixed(1)},${bottom} L${svgPts[0].x.toFixed(1)},${bottom} Z`;
	}

	function getGridLines() {
		const maxY = maxYScale();
		const lines: { y: number; label: string }[] = [];
		const step = maxY <= 5 ? 1 : maxY <= 10 ? 2 : maxY <= 25 ? 5 : 10;
		for (let v = 1; v <= maxY; v += step) {
			const y = GH - GP - ((v - 1) / (maxY - 1)) * (GH - GP * 2);
			lines.push({ y, label: `${v}x` });
		}
		return lines;
	}

	function getTimeLabels() {
		const maxX = Math.max(elapsed, 3);
		const labels: { x: number; label: string }[] = [];
		const step = maxX <= 5 ? 1 : maxX <= 15 ? 3 : maxX <= 30 ? 5 : 10;
		for (let t = 0; t <= maxX; t += step) {
			const x = GP + (t / maxX) * (GW - GP * 2);
			labels.push({ x, label: `${t}s` });
		}
		return labels;
	}

	function getEndPoint() {
		if (graphPoints.length === 0) return { x: GP, y: GH - GP };
		return toSvg(graphPoints[graphPoints.length - 1]);
	}

	function getCurveColor(): string {
		if (phase === 'crashed') return '#ef4444';
		if (phase === 'cashed_out') return '#22c55e';
		if (currentMultiplier >= 5) return '#eab308';
		return '#22c55e';
	}

	function getMultColor(): string {
		if (phase === 'crashed') return '#dc2626';
		if (phase === 'cashed_out') return '#15803d';
		if (currentMultiplier >= 5) return '#b45309';
		if (currentMultiplier >= 3) return '#15803d';
		if (currentMultiplier >= 2) return '#059669';
		return '#16a34a';
	}
</script>

<svelte:head><title>Crash - BUNG TAE DUBAI</title></svelte:head>

{#if showBigWin}
	<div class="animate-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
		<div class="animate-modal w-full max-w-sm rounded-2xl bg-gradient-to-b from-yellow-900/90 to-yellow-950/95 p-6 text-center shadow-2xl border border-yellow-500/40">
			<p class="mb-1 text-lg font-bold text-yellow-400">BIG WIN!</p>
			<p class="my-3 text-4xl font-black tabular-nums text-yellow-300 sm:text-5xl animate-neon">+{bigWinAmount.toLocaleString()}</p>
			<p class="mb-4 text-sm text-yellow-500/80">บาท</p>
			<button onclick={() => (showBigWin = false)} class="cursor-pointer rounded-xl bg-yellow-500 px-8 py-2.5 text-sm font-bold text-black transition hover:bg-yellow-400 active:scale-[0.98]">เยี่ยม!</button>
		</div>
	</div>
{/if}

<div class="flex flex-col items-center select-none relative">
	<h2 class="mb-3 text-lg font-bold text-slot-accent sm:text-xl">Crash</h2>

	<!-- Graph -->
	<div class="crash-graph mb-3 w-full max-w-sm overflow-hidden relative rounded-2xl border border-slot-border casino-shadow">
		<!-- Multiplier overlay -->
		<div class="absolute top-3 left-0 right-0 z-10 text-center pointer-events-none">
			<div class="text-4xl font-black tabular-nums sm:text-5xl transition-all duration-150"
				style="color: {getMultColor()};">
				{currentMultiplier.toFixed(2)}x
			</div>
			{#if phase === 'crashed'}
				<div class="mt-0.5 text-sm font-black text-red-600 crash-explode tracking-wider">CRASHED</div>
			{:else if phase === 'cashed_out'}
				<div class="mt-0.5 animate-bounce-in text-sm font-bold text-green-600 tracking-wider">CASHED OUT</div>
			{:else if phase === 'running'}
				<div class="mt-0.5 text-[10px] font-medium text-gray-400 tabular-nums">{elapsed.toFixed(1)}s</div>
			{/if}
		</div>

		<svg viewBox="0 0 {GW} {GH}" class="w-full" style="height: 230px;">
			<defs>
				<linearGradient id="crash-fill" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color={getCurveColor()} stop-opacity="0.12"/>
					<stop offset="70%" stop-color={getCurveColor()} stop-opacity="0.03"/>
					<stop offset="100%" stop-color={getCurveColor()} stop-opacity="0"/>
				</linearGradient>
			</defs>

			<!-- Background -->
			<rect x="0" y="0" width={GW} height={GH} fill="#fafafa" rx="16"/>

			<!-- Grid lines (horizontal) -->
			{#each getGridLines() as line}
				<line x1={GP} y1={line.y} x2={GW - GP} y2={line.y} stroke="#e5e7eb" stroke-width="0.5"/>
				<text x={GP - 6} y={line.y + 3} text-anchor="end" font-size="8" fill="#9ca3af" font-family="system-ui, sans-serif" font-weight="500">{line.label}</text>
			{/each}

			<!-- Time labels (vertical) -->
			{#each getTimeLabels() as label}
				<line x1={label.x} y1={GP} x2={label.x} y2={GH - GP} stroke="#f3f4f6" stroke-width="0.5"/>
				<text x={label.x} y={GH - GP + 14} text-anchor="middle" font-size="8" fill="#9ca3af" font-family="system-ui, sans-serif">{label.label}</text>
			{/each}

			<!-- Axes -->
			<line x1={GP} y1={GH - GP} x2={GW - GP} y2={GH - GP} stroke="#d1d5db" stroke-width="1"/>
			<line x1={GP} y1={GP} x2={GP} y2={GH - GP} stroke="#d1d5db" stroke-width="1"/>

			<!-- Curve -->
			{#if graphPoints.length >= 2}
				<path d={getAreaPath(graphPoints)} fill="url(#crash-fill)"/>
				<path d={getLinePath(graphPoints)} fill="none"
					stroke={getCurveColor()} stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
					shape-rendering="geometricPrecision"/>
			{/if}

			<!-- Endpoint dot -->
			{#if graphPoints.length >= 2}
				{@const ep = getEndPoint()}
				<circle cx={ep.x} cy={ep.y} r="4" fill={getCurveColor()}
					class="{phase === 'running' ? 'crash-dot-pulse' : ''}"/>
			{/if}

			<!-- Crash point dashed line -->
			{#if phase === 'crashed' && crashPoint > 1}
				{@const cy = GH - GP - ((crashPoint - 1) / (maxYScale() - 1)) * (GH - GP * 2)}
				<line x1={GP} y1={cy} x2={GW - GP} y2={cy} stroke="#ef4444" stroke-width="0.8" stroke-dasharray="4,3" opacity="0.4"/>
				<text x={GW - GP + 4} y={cy + 3} font-size="8" fill="#ef4444" font-family="system-ui, sans-serif" font-weight="700" opacity="0.6">{crashPoint.toFixed(2)}x</text>
			{/if}
		</svg>
	</div>

	{#if message}
		<div class="animate-slide-up mb-3 w-full rounded-xl px-4 py-2.5 text-center text-sm font-bold casino-shadow
			{messageType === 'win' ? 'bg-green-50 text-slot-win border border-green-200' : ''}
			{messageType === 'lose' ? 'bg-red-50 text-slot-lose border border-red-200' : ''}
			{messageType === 'info' ? 'bg-slot-accent/10 text-slot-accent border border-slot-accent/20' : ''}">{message}</div>
	{/if}

	{#if phase === 'betting'}
		<div class="mb-4 flex w-full items-center gap-2 sm:gap-3">
			<div class="flex items-center gap-0 rounded-xl border border-slot-border bg-slot-surface casino-shadow">
				<button onclick={decreaseBet} class="cursor-pointer rounded-l-xl px-2.5 py-1.5 text-base font-bold text-slot-muted transition hover:text-slot-text sm:px-3 sm:py-2 sm:text-lg">−</button>
				<div class="flex min-w-[3.5rem] flex-col items-center border-x border-slot-border px-1 sm:min-w-[4.5rem]">
					<span class="text-[9px] uppercase tracking-wider text-slot-muted">BET</span>
					<input type="number" bind:value={bet} onblur={validateBet} min="1" class="w-full bg-transparent text-center text-sm font-bold tabular-nums outline-none sm:text-base [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
				</div>
				<button onclick={increaseBet} class="cursor-pointer rounded-r-xl px-2.5 py-1.5 text-base font-bold text-slot-muted transition hover:text-slot-text sm:px-3 sm:py-2 sm:text-lg">+</button>
			</div>
			<button onclick={start} disabled={wallet.credit < bet} class="flex-1 cursor-pointer rounded-xl bg-slot-accent px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 casino-shadow sm:text-base">เริ่มเกม</button>
		</div>
	{:else if phase === 'running'}
		<button onclick={cashOut} disabled={cashingOut} class="crash-cashout w-full cursor-pointer rounded-xl px-6 py-4 text-lg font-black text-white transition active:scale-[0.97] disabled:opacity-60 sm:text-xl">
			{cashingOut ? 'CASHING OUT...' : `CASH OUT (${currentMultiplier.toFixed(2)}x)`}
		</button>
		{:else}
		<button onclick={newGame} class="w-full cursor-pointer rounded-xl bg-slot-accent px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] casino-shadow sm:text-base">เล่นใหม่</button>
	{/if}

	<div class="mt-4 w-full rounded-xl border border-slot-border bg-slot-surface p-3 text-xs text-slot-muted casino-shadow">
		<p class="font-medium text-slot-text">วิธีเล่น</p>
		<p class="mt-1">วางเดิมพัน → กราฟ multiplier จะพุ่งขึ้นเรื่อยๆ</p>
		<p>กด Cash Out ก่อน Crash = ชนะ! ถ้าไม่ทัน = เสียทั้งหมด</p>
	</div>
</div>

<style>
	.crash-graph {
		background: linear-gradient(180deg, #fafafa 0%, #f5f5f5 100%);
	}
	.crash-cashout {
		background: linear-gradient(135deg, #22c55e, #16a34a);
		box-shadow: 0 4px 20px rgba(34, 197, 94, 0.4), inset 0 1px 0 rgba(255,255,255,0.2);
		animation: cashout-pulse 1s ease-in-out infinite;
	}
	@keyframes cashout-pulse {
		0%,100% { box-shadow: 0 4px 20px rgba(34, 197, 94, 0.4), inset 0 1px 0 rgba(255,255,255,0.2); }
		50% { box-shadow: 0 4px 30px rgba(34, 197, 94, 0.6), 0 0 40px rgba(34, 197, 94, 0.2), inset 0 1px 0 rgba(255,255,255,0.2); }
	}
	.crash-dot-pulse {
		animation: dot-pulse 0.6s ease-in-out infinite;
	}
	@keyframes dot-pulse {
		0%,100% { r: 3; }
		50% { r: 4.5; }
	}
	.crash-explode {
		animation: crash-flash 0.4s ease-out;
	}
	@keyframes crash-flash {
		0% { opacity: 0; transform: scale(1.5); }
		50% { opacity: 1; }
		100% { transform: scale(1); }
	}
</style>
