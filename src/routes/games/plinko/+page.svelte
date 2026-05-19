<script lang="ts">
	import { ROWS, BUCKETS, getMultipliers, type RiskLevel } from '$lib/games/plinkoEngine';
	import { wallet, stats, gameInProgress } from '$lib/store.svelte';
	import { onMount } from 'svelte';
	import { playBet, playBounce, playWin, playLose, playBigWin } from '$lib/sounds';

	// ── Constants ──
	const BET_OPTIONS = [1, 5, 10, 20, 50, 100, 200, 500];
	const GRAVITY = 0.15;
	const DAMPING = 0.55;
	const PEG_R = 4;
	const BALL_R = 5;
	const COLORS = ['#f59e0b', '#ef4444', '#3b82f6', '#22c55e', '#8b5cf6', '#ec4899'];
	const MARGIN_PCT = 6;
	const PEG_TOP = 0.07;
	const PEG_BOT = 0.74;
	const BUCKET_Y = 0.77;
	// ── Reactive state (template) ──
	let bet = $state(BET_OPTIONS[0]);
	let risk: RiskLevel = $state('medium');
	let message = $state('');
	let messageType: 'win' | 'lose' | 'info' | '' = $state('');
	let showBigWin = $state(false);
	let bigWinAmount = $state(0);
	let activeBalls = $state(0);
	let bucketFlash = $state<Set<number>>(new Set());

	let mults = $derived(getMultipliers(risk));

	// ── Canvas ──
	let canvasEl: HTMLCanvasElement;
	let wrapEl: HTMLDivElement;
	let cW = 360;
	let cH = 480;
	let animId = 0;

	// ── Non-reactive physics ──
	interface Peg { x: number; y: number; row: number; }
	interface Ball {
		x: number; y: number; vx: number; vy: number;
		path: number[]; nextRow: number;
		bet: number; creditBefore: number;
		targetBucket: number; mults: number[];
		color: string; settled: boolean; settleTime: number;
		serverPayout: number; serverNewCredit: number; serverStats: { totalSpent: number; totalReceived: number };
	}
	interface FText { x: number; y: number; text: string; color: string; alpha: number; }

	let pegs: Peg[] = [];
	let balls: Ball[] = [];
	let ftexts: FText[] = [];
	let colorIdx = 0;
	let lastBounceSound = 0;

	// ── Geometry ──
	function rebuildPegs() {
		const mx = cW * MARGIN_PCT / 100;
		const usable = cW - 2 * mx;
		const sp = usable / (BUCKETS - 1);
		const topY = cH * PEG_TOP;
		const botY = cH * PEG_BOT;
		const rh = (botY - topY) / (ROWS - 1);
		pegs = [];
		for (let r = 0; r < ROWS; r++) {
			const n = r + 2;
			const off = (ROWS - 1 - r) / 2 * sp;
			for (let c = 0; c < n; c++) {
				pegs.push({ x: mx + off + c * sp, y: topY + r * rh, row: r });
			}
		}
	}

	// Bucket inset for alignment with pegs
	let bucketInset = $derived(MARGIN_PCT - (100 - 2 * MARGIN_PCT) / (BUCKETS - 1) / 2);

	// ── Setup ──
	onMount(() => {
		resize();
		const ro = new ResizeObserver(resize);
		if (wrapEl) ro.observe(wrapEl);
		animId = requestAnimationFrame(loop);
		return () => { cancelAnimationFrame(animId); ro.disconnect(); };
	});

	function resize() {
		if (!wrapEl || !canvasEl) return;
		const w = wrapEl.clientWidth;
		cW = w;
		cH = Math.round(w * 1.1);
		const dpr = window.devicePixelRatio || 1;
		canvasEl.width = cW * dpr;
		canvasEl.height = cH * dpr;
		canvasEl.style.width = cW + 'px';
		canvasEl.style.height = cH + 'px';
		const ctx = canvasEl.getContext('2d');
		if (ctx) ctx.scale(dpr, dpr);
		rebuildPegs();
	}

	// ── Physics loop ──
	function loop() {
		step();
		draw();
		animId = requestAnimationFrame(loop);
	}

	function step() {
		const bucketLine = cH * BUCKET_Y;

		for (const b of balls) {
			if (b.settled) continue;

			b.vy += GRAVITY;
			if (b.vy > 10) b.vy = 10;
			b.x += b.vx;
			b.y += b.vy;

			// Walls
			if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx) * 0.5; }
			if (b.x > cW - BALL_R) { b.x = cW - BALL_R; b.vx = -Math.abs(b.vx) * 0.5; }

			// Peg collisions
			for (const p of pegs) {
				const dx = b.x - p.x, dy = b.y - p.y;
				const d2 = dx * dx + dy * dy;
				const minD = BALL_R + PEG_R;
				if (d2 < minD * minD && d2 > 0.01) {
					const d = Math.sqrt(d2);
					const nx = dx / d, ny = dy / d;
					b.x = p.x + nx * (minD + 0.5);
					b.y = p.y + ny * (minD + 0.5);
					const dot = b.vx * nx + b.vy * ny;
					b.vx = (b.vx - 2 * dot * nx) * DAMPING;
					b.vy = (b.vy - 2 * dot * ny) * DAMPING;
					// Throttled bounce sound (max every 80ms)
					const now = performance.now();
					if (now - lastBounceSound > 80) { lastBounceSound = now; playBounce(); }
					// Path bias
					if (p.row >= b.nextRow && b.nextRow < ROWS) {
						const goRight = b.path[b.nextRow + 1] > b.path[b.nextRow];
						b.vx += goRight ? 1.5 : -1.5;
						b.nextRow = p.row + 1;
					}
					if (b.vy < 1) b.vy = 1;
				}
			}

			// Gravity toward target bucket — stronger as ball falls lower
			const progress = Math.min(b.y / bucketLine, 1);
			if (progress > 0.5) {
				const mx = cW * MARGIN_PCT / 100;
				const sp = (cW - 2 * mx) / (BUCKETS - 1);
				const targetX = mx + b.targetBucket * sp;
				const drift = (targetX - b.x) * 0.03 * Math.pow((progress - 0.5) * 2, 2);
				b.vx += drift;
			}

			// Settle
			if (b.y >= bucketLine) {
				// Snap to target bucket position
				const mx = cW * MARGIN_PCT / 100;
				const sp = (cW - 2 * mx) / (BUCKETS - 1);
				b.x = mx + b.targetBucket * sp;
				b.settled = true;
				b.settleTime = Date.now();
				b.y = bucketLine;
				settle(b);
			}
		}

		// Ball-ball collisions
		for (let i = 0; i < balls.length; i++) {
			if (balls[i].settled) continue;
			for (let j = i + 1; j < balls.length; j++) {
				if (balls[j].settled) continue;
				bounceBalls(balls[i], balls[j]);
			}
		}

		// Floating texts
		for (const ft of ftexts) { ft.y -= 0.5; ft.alpha -= 0.012; }
		ftexts = ftexts.filter(ft => ft.alpha > 0);

		// Cleanup settled balls
		const now = Date.now();
		balls = balls.filter(b => !b.settled || now - b.settleTime < 100);

		// Update reactive count only on change
		const count = balls.filter(b => !b.settled).length;
		if (count !== activeBalls) activeBalls = count;
	}

	function bounceBalls(a: Ball, b: Ball) {
		const dx = b.x - a.x, dy = b.y - a.y;
		const d2 = dx * dx + dy * dy;
		const minD = BALL_R * 2;
		if (d2 < minD * minD && d2 > 0.01) {
			const d = Math.sqrt(d2);
			const nx = dx / d, ny = dy / d;
			const overlap = minD - d;
			a.x -= nx * overlap / 2; a.y -= ny * overlap / 2;
			b.x += nx * overlap / 2; b.y += ny * overlap / 2;
			const rv = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
			if (rv > 0) {
				a.vx -= rv * nx * 0.5; a.vy -= rv * ny * 0.5;
				b.vx += rv * nx * 0.5; b.vy += rv * ny * 0.5;
			}
		}
	}

	function getBucketFromX(x: number): number {
		const mx = cW * MARGIN_PCT / 100;
		const sp = (cW - 2 * mx) / (BUCKETS - 1);
		return Math.max(0, Math.min(BUCKETS - 1, Math.round((x - mx) / sp)));
	}

	function settle(b: Ball) {
		const bucket = b.targetBucket;
		const mult = b.mults[bucket];
		const payout = b.serverPayout;

		// Apply final credit and stats from server
		wallet.credit = b.serverNewCredit;
		stats.totalSpent = b.serverStats.totalSpent;
		stats.totalReceived = b.serverStats.totalReceived;

		if (payout > b.bet) {
			const profit = payout - b.bet;
			message = `x${mult} — ชนะ +${profit.toLocaleString()}!`;
			messageType = 'win';
			playWin();
			if (profit > b.creditBefore * 0.5) { bigWinAmount = profit; showBigWin = true; playBigWin(); }
		} else if (payout > 0) {
			message = `x${mult} — ได้คืน ${payout.toLocaleString()}`;
			messageType = payout === b.bet ? 'info' : 'lose';
			if (payout < b.bet) playLose();
		} else {
			message = `x${mult} — ไม่ได้รางวัล`;
			messageType = 'lose';
			playLose();
		}
		gameInProgress.value = false;

		// Floating text
		const mx = cW * MARGIN_PCT / 100;
		const sp = (cW - 2 * mx) / (BUCKETS - 1);
		ftexts.push({
			x: mx + bucket * sp,
			y: cH * BUCKET_Y - 12,
			text: mult >= 1 ? `+${payout.toLocaleString()}` : `x${mult}`,
			color: mult >= 1.5 ? '#22c55e' : mult >= 1 ? '#a78bfa' : '#ef4444',
			alpha: 1
		});

		// Flash bucket
		const newFlash = new Set(bucketFlash);
		newFlash.add(bucket);
		bucketFlash = newFlash;
		setTimeout(() => {
			const next = new Set(bucketFlash);
			next.delete(bucket);
			bucketFlash = next;
		}, 500);
	}

	// ── Rendering ──
	function draw() {
		const ctx = canvasEl?.getContext('2d');
		if (!ctx) return;
		ctx.clearRect(0, 0, cW, cH);

		// Pegs
		for (const p of pegs) {
			const g = ctx.createRadialGradient(p.x - PEG_R * 0.3, p.y - PEG_R * 0.3, 0, p.x, p.y, PEG_R);
			g.addColorStop(0, '#cbd5e1');
			g.addColorStop(0.5, '#94a3b8');
			g.addColorStop(1, '#475569');
			ctx.beginPath();
			ctx.arc(p.x, p.y, PEG_R, 0, Math.PI * 2);
			ctx.fillStyle = g;
			ctx.fill();
		}

		// Balls
		for (const b of balls) {
			if (b.settled) continue;
			const g = ctx.createRadialGradient(b.x - BALL_R * 0.3, b.y - BALL_R * 0.3, 0, b.x, b.y, BALL_R);
			g.addColorStop(0, lighten(b.color));
			g.addColorStop(0.7, b.color);
			g.addColorStop(1, darken(b.color));
			ctx.beginPath();
			ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
			ctx.fillStyle = g;
			ctx.fill();
		}

		// Floating texts
		ctx.font = 'bold 12px Kanit, sans-serif';
		ctx.textAlign = 'center';
		for (const ft of ftexts) {
			ctx.globalAlpha = ft.alpha;
			ctx.fillStyle = ft.color;
			ctx.fillText(ft.text, ft.x, ft.y);
		}
		ctx.globalAlpha = 1;
	}

	function lighten(c: string) {
		const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
		return `rgb(${Math.min(255, r + 80)},${Math.min(255, g + 80)},${Math.min(255, b + 80)})`;
	}
	function darken(c: string) {
		const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
		return `rgb(${Math.max(0, r - 60)},${Math.max(0, g - 60)},${Math.max(0, b - 60)})`;
	}

	// ── Drop (non-blocking, allows spam) ──
	async function drop() {
		if (wallet.credit < bet) return;

		const currentBet = bet;
		const creditBefore = wallet.credit;
		const currentMults = [...mults];
		gameInProgress.value = true;

		// Call server API
		const res = await fetch('/api/games/plinko/play', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ bet: currentBet, risk })
		});
		if (!res.ok) {
			const err = await res.json().catch(() => ({ error: 'เกิดข้อผิดพลาด' }));
			message = err.error || 'เกิดข้อผิดพลาด';
			messageType = 'info';
			gameInProgress.value = false;
			return;
		}
		const data = await res.json();
		const { path, bucket } = data.outcome;


		playBet();
		const color = COLORS[colorIdx++ % COLORS.length];
		balls.push({
			x: cW / 2 + (Math.random() - 0.5) * 10,
			y: BALL_R + 2,
			vx: (Math.random() - 0.5) * 0.5,
			vy: 0,
			path, nextRow: 0,
			bet: currentBet, creditBefore,
			targetBucket: bucket, mults: currentMults,
			color, settled: false, settleTime: 0,
			serverPayout: data.payout, serverNewCredit: data.newCredit, serverStats: data.stats
		});
	}

	// ── UI helpers ──
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
	function bucketColor(mult: number): string {
		if (mult >= 10) return 'bg-red-500 text-white';
		if (mult >= 5) return 'bg-orange-500 text-white';
		if (mult >= 3) return 'bg-amber-500 text-white';
		if (mult >= 1.5) return 'bg-blue-500 text-white';
		if (mult >= 1) return 'bg-slot-accent/20 text-slot-accent';
		if (mult >= 0.5) return 'bg-slot-muted/20 text-slot-muted';
		return 'bg-slot-border text-slot-muted';
	}
</script>

<svelte:head><title>Plinko - BUNG TAE DUBAI</title></svelte:head>

{#if showBigWin}
	<div class="animate-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
		<div class="animate-modal w-full max-w-sm rounded-2xl bg-gradient-to-b from-yellow-900/90 to-yellow-950/95 p-6 text-center shadow-2xl border border-yellow-500/40">
			<div class="mb-2 text-5xl">🎉</div>
			<p class="mb-1 text-lg font-bold text-yellow-400">BIG WIN!</p>
			<p class="my-3 text-4xl font-black tabular-nums text-yellow-300 sm:text-5xl">+{bigWinAmount.toLocaleString()}</p>
			<p class="mb-4 text-sm text-yellow-500/80">บาท</p>
			<button onclick={() => (showBigWin = false)} class="cursor-pointer rounded-xl bg-yellow-500 px-8 py-2.5 text-sm font-bold text-black transition hover:bg-yellow-400 active:scale-[0.98]">เยี่ยม!</button>
		</div>
	</div>
{/if}

<div class="flex flex-col items-center select-none">
	<h2 class="mb-4 text-lg font-bold text-slot-accent sm:text-xl">Plinko พลิงโกะ</h2>

	<!-- Board -->
	<div bind:this={wrapEl} class="relative mb-4 w-full max-w-sm overflow-hidden rounded-2xl border-2 border-indigo-500/40 casino-shadow-lg"
		 style="background: linear-gradient(180deg, #1e1b4b 0%, #312e81 50%, #3730a3 100%)">
		<canvas bind:this={canvasEl}></canvas>

		<!-- Buckets (HTML overlay, positioned at ball settle line) -->
		<div class="absolute grid gap-px"
			 style="top: {BUCKET_Y * 100}%; left: {bucketInset}%; right: {bucketInset}%; grid-template-columns: repeat({BUCKETS}, 1fr)">
			{#each mults as mult, i}
				<div class="flex items-center justify-center rounded py-1 text-[7px] font-bold sm:text-[9px]
					{bucketColor(mult)}"
					style={bucketFlash.has(i) ? 'box-shadow: inset 0 0 8px 2px rgba(255,255,255,0.7);' : ''}>
					{mult}x
				</div>
			{/each}
		</div>
	</div>

	{#if message}
		<div class="animate-slide-up mb-3 w-full rounded-xl px-4 py-2.5 text-center text-sm font-bold casino-shadow
			{messageType === 'win' ? 'bg-green-50 text-slot-win border border-green-200' : ''}
			{messageType === 'lose' ? 'bg-red-50 text-slot-lose border border-red-200' : ''}
			{messageType === 'info' ? 'bg-slot-accent/10 text-slot-accent border border-slot-accent/20' : ''}">{message}</div>
	{/if}

	<div class="mb-3 flex w-full items-center justify-center gap-3">
		<span class="text-sm text-slot-muted">ความเสี่ยง:</span>
		<div class="flex gap-1">
			{#each (['low', 'medium', 'high'] as const) as r}
				<button
					onclick={() => (risk = r)}
					disabled={activeBalls > 0}
					class="cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-bold transition
						{risk === r ? 'border-slot-accent bg-slot-accent/10 text-slot-accent' : 'border-slot-border bg-slot-surface text-slot-text hover:border-slot-accent/40'}
						disabled:opacity-40"
				>
					{r === 'low' ? 'ต่ำ' : r === 'medium' ? 'กลาง' : 'สูง'}
				</button>
			{/each}
		</div>
	</div>

	<div class="mb-4 flex w-full items-center gap-2 sm:gap-3">
		<div class="flex items-center gap-0 rounded-xl border border-slot-border bg-slot-surface casino-shadow">
			<button onclick={decreaseBet} class="cursor-pointer rounded-l-xl px-2.5 py-1.5 text-base sm:px-3 sm:py-2 sm:text-lg font-bold text-slot-muted transition hover:text-slot-text disabled:cursor-not-allowed disabled:opacity-30">−</button>
			<div class="flex min-w-[3.5rem] flex-col items-center border-x border-slot-border px-1 sm:min-w-[4.5rem]">
				<span class="text-[9px] uppercase tracking-wider text-slot-muted">BET</span>
				<input type="number" bind:value={bet} onblur={validateBet} min="1" class="w-full bg-transparent text-center text-sm font-bold tabular-nums outline-none disabled:opacity-60 sm:text-base [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
			</div>
			<button onclick={increaseBet} class="cursor-pointer rounded-r-xl px-2.5 py-1.5 text-base sm:px-3 sm:py-2 sm:text-lg font-bold text-slot-muted transition hover:text-slot-text disabled:cursor-not-allowed disabled:opacity-30">+</button>
		</div>
		<button onclick={drop} disabled={wallet.credit < bet}
			class="flex-1 cursor-pointer rounded-xl bg-slot-accent px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:text-base">
			ปล่อยลูกบอล{activeBalls > 0 ? ` (${activeBalls})` : ''}
		</button>
	</div>

	<div class="mt-4 w-full rounded-xl border border-slot-border bg-slot-surface p-3 text-xs text-slot-muted casino-shadow">
		<p class="font-medium text-slot-text">วิธีเล่น</p>
		<p class="mt-1">ปล่อยลูกบอลตกผ่านหมุด ลุ้น multiplier — กดรัวๆ ได้!</p>
		<p>ลูกบอลชนกันจะเด้งออก ความเสี่ยงสูง = โอกาสได้ x50 แต่เสียง่ายกว่า</p>
	</div>
</div>
