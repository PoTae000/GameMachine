<script lang="ts">
	import { SEGMENTS } from '$lib/games/wheelEngine';
	import { wallet, stats, gameInProgress } from '$lib/store.svelte';
	import { playBet, playSpin, playTick, playWin, playLose, playBigWin, playHeartbeat } from '$lib/sounds';

	const BET_OPTIONS = [1, 5, 10, 20, 50, 100, 200, 500];
	const SEG_DEG = 360 / SEGMENTS.length;

	let bet = $state(BET_OPTIONS[0]);
	let spinning = $state(false);
	let rotation = $state(0);
	let wheelTransition = $state(false);
	let resultIdx: number | null = $state(null);
	let message = $state('');
	let messageType: 'win' | 'lose' | 'info' | '' = $state('');

	let resultPop = $state(false);

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

	function raf(): Promise<void> { return new Promise(r => requestAnimationFrame(() => r())); }

	async function spin() {
		if (spinning || wallet.credit < bet) return;

		const creditBefore = wallet.credit;
		spinning = true;
		gameInProgress.value = true;
		message = '';
		messageType = '';
		resultIdx = null;
		resultPop = false;
		playBet();

		// Call server API
		const res = await fetch('/api/games/wheel/play', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ bet })
		});
		if (!res.ok) {
			const err = await res.json().catch(() => ({ error: 'เกิดข้อผิดพลาด' }));
			message = err.error || 'เกิดข้อผิดพลาด';
			messageType = 'info';
			spinning = false;
			gameInProgress.value = false;
			return;
		}
		const data = await res.json();
		const idx = data.outcome.segmentIndex;


		// Calculate rotation to land on idx
		const segCenter = idx * SEG_DEG + SEG_DEG / 2;
		const target = (360 - segCenter + 360) % 360;

		// Normalize rotation to avoid huge accumulated values
		const currentMod = ((rotation % 360) + 360) % 360;
		wheelTransition = false;
		rotation = currentMod;
		await raf(); // Let browser render the snap (visually identical)

		let delta = target - currentMod;
		if (delta <= 0) delta += 360;
		const fullSpins = (8 + Math.floor(Math.random() * 4)) * 360;

		// Enable transition first, then change rotation next frame
		wheelTransition = true;
		await raf();
		rotation = currentMod + fullSpins + delta;
		playSpin();

		// Decelerating tick sounds (same style as roulette)
		const tickTimeouts: ReturnType<typeof setTimeout>[] = [];
		let tickT = 0;
		let tickGap = 0.08;
		while (tickT < 6.5) {
			const t = tickT;
			tickTimeouts.push(setTimeout(() => playTick(), t * 1000));
			tickT += tickGap;
			tickGap *= 1.06;
		}

		// Wait for transition to finish (8s total)
		await delay(5500);
		playHeartbeat();
		await delay(2800);

		tickTimeouts.forEach(clearTimeout);
		wheelTransition = false;
		resultIdx = idx;
		resultPop = true;

		// Apply final credit and stats from server
		wallet.credit = data.newCredit;
		stats.totalSpent = data.stats.totalSpent;
		stats.totalReceived = data.stats.totalReceived;

		const seg = SEGMENTS[idx];
		const payout = data.payout;

		if (payout > bet) {
			const profit = payout - bet;
			message = `${seg.label} — ชนะ +${profit.toLocaleString()}!`;
			messageType = 'win';
			playWin();
			if (profit > creditBefore * 0.5) { bigWinAmount = profit; showBigWin = true; playBigWin(); }
		} else if (payout > 0) {
			message = `${seg.label} — ได้คืน ${payout.toLocaleString()}`;
			messageType = 'info';
		} else {
			message = `${seg.label} — ไม่ได้รางวัล`;
			messageType = 'lose';
			playLose();
		}
		await delay(400);
		resultPop = false;
		gameInProgress.value = false;
		spinning = false;
	}

	function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

	// Precompute SVG geometry
	const CX = 150, CY = 150, R = 134;

	const segPaths = SEGMENTS.map((seg, i) => {
		const startRad = ((i * SEG_DEG - 90) * Math.PI) / 180;
		const endRad = (((i + 1) * SEG_DEG - 90) * Math.PI) / 180;
		const midRad = (((i + 0.5) * SEG_DEG - 90) * Math.PI) / 180;
		const x1 = CX + R * Math.cos(startRad);
		const y1 = CY + R * Math.sin(startRad);
		const x2 = CX + R * Math.cos(endRad);
		const y2 = CY + R * Math.sin(endRad);
		const tx = CX + R * 0.65 * Math.cos(midRad);
		const ty = CY + R * 0.65 * Math.sin(midRad);
		let textRot = i * SEG_DEG + SEG_DEG / 2;
		if (textRot > 90 && textRot < 270) textRot += 180;

		// Slightly brighter version of the color for outer edge highlight
		return { path: `M${CX},${CY} L${x1},${y1} A${R},${R} 0 0,1 ${x2},${y2} Z`, fill: seg.color, label: seg.label, tx, ty, textRot };
	});

	// Light bulbs on the rim (one per segment midpoint)
	const BULB_R = 143;
	const bulbs = SEGMENTS.map((_, i) => {
		const midRad = (((i + 0.5) * SEG_DEG - 90) * Math.PI) / 180;
		return { cx: CX + BULB_R * Math.cos(midRad), cy: CY + BULB_R * Math.sin(midRad) };
	});

	// Pegs at segment boundaries (where the pointer clicks)
	const PEG_R = R + 1;
	const pegs = SEGMENTS.map((_, i) => {
		const rad = ((i * SEG_DEG - 90) * Math.PI) / 180;
		return { cx: CX + PEG_R * Math.cos(rad), cy: CY + PEG_R * Math.sin(rad) };
	});
</script>

<svelte:head><title>Wheel of Fortune - BUNG TAE DUBAI</title></svelte:head>

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
	<h2 class="mb-4 text-lg font-bold text-slot-accent sm:text-xl">Wheel of Fortune วงล้อนำโชค</h2>

	<!-- Wheel -->
	<div class="relative mb-4">
		<!-- Pointer arrow -->
		<div class="absolute top-0 left-1/2 z-20 -translate-x-1/2 -translate-y-1">
			<svg width="22" height="30" viewBox="0 0 22 30" fill="none">
				<polygon points="11,30 1,0 21,0" fill="#facc15" stroke="#ca8a04" stroke-width="1"/>
				<polygon points="11,25 5,5 17,5" fill="#fde68a" opacity="0.35"/>
			</svg>
		</div>

		<div
			class="h-[250px] w-[250px] sm:h-[290px] sm:w-[290px] md:h-[320px] md:w-[320px] {wheelTransition ? 'wheel-spinning' : ''}"
			style="transform: rotate({rotation}deg)"
		>
			<svg viewBox="0 0 300 300" class="h-full w-full">
				<defs>
					<!-- Rim metallic gradient -->
					<linearGradient id="wf_rim" x1="0" y1="0" x2="1" y2="1">
						<stop offset="0%" stop-color="#c9a84c"/>
						<stop offset="20%" stop-color="#8b6914"/>
						<stop offset="40%" stop-color="#c9a84c"/>
						<stop offset="60%" stop-color="#8b6914"/>
						<stop offset="80%" stop-color="#c9a84c"/>
						<stop offset="100%" stop-color="#8b6914"/>
					</linearGradient>
					<!-- Rim inner shadow for 3D depth -->
					<radialGradient id="wf_rim3d">
						<stop offset="88%" stop-color="black" stop-opacity="0"/>
						<stop offset="94%" stop-color="black" stop-opacity="0.12"/>
						<stop offset="100%" stop-color="black" stop-opacity="0.3"/>
					</radialGradient>
					<!-- Bowl shadow (concave illusion) -->
					<radialGradient id="wf_bowl">
						<stop offset="0%" stop-color="black" stop-opacity="0"/>
						<stop offset="65%" stop-color="black" stop-opacity="0"/>
						<stop offset="100%" stop-color="black" stop-opacity="0.3"/>
					</radialGradient>
					<!-- Center hub gradient -->
					<radialGradient id="wf_hub" cx="42%" cy="38%">
						<stop offset="0%" stop-color="#a78bfa"/>
						<stop offset="50%" stop-color="#7c3aed"/>
						<stop offset="100%" stop-color="#4c1d95"/>
					</radialGradient>
					</defs>

				<!-- Outer rim - metallic gold ring -->
				<circle cx="150" cy="150" r="148" fill="url(#wf_rim)" stroke="#5c3d1a" stroke-width="1"/>
				<circle cx="150" cy="150" r="148" fill="url(#wf_rim3d)"/>
				<!-- Rim decorative rings -->
				<circle cx="150" cy="150" r="147" fill="none" stroke="#d4a94c" stroke-width="0.4" opacity="0.4"/>
				<circle cx="150" cy="150" r="136" fill="none" stroke="#8b6914" stroke-width="0.4" opacity="0.4"/>

				<!-- Dark base under segments -->
				<circle cx="150" cy="150" r={R + 1} fill="#0a0a0a"/>

				<!-- Colored segments -->
				{#each segPaths as seg}
					<path d={seg.path} fill={seg.fill} stroke="#0a0a0a" stroke-width="0.8"/>
				{/each}

				<!-- Segment outer border ring -->
				<circle cx="150" cy="150" r={R} fill="none" stroke="#c9a84c" stroke-width="0.8"/>

				<!-- Pegs at segment boundaries -->
				{#each pegs as peg}
					<circle cx={peg.cx} cy={peg.cy} r="2.8" fill="#c9a84c" stroke="#6b4a1a" stroke-width="0.5"/>
				{/each}

				<!-- Light bulbs on the rim -->
				{#each bulbs as bulb, i}
					<circle cx={bulb.cx} cy={bulb.cy} r="3.5"
						fill={i % 2 === 0 ? '#fde68a' : '#fef9c3'}
						stroke="#c9a84c" stroke-width="0.3"
						opacity="0.85"/>
				{/each}

				<!-- Segment text labels -->
				{#each segPaths as seg}
					<text
						x={seg.tx} y={seg.ty}
						text-anchor="middle" dominant-baseline="central"
						fill="white" font-size="10" font-weight="bold" font-family="sans-serif"
						transform="rotate({seg.textRot}, {seg.tx}, {seg.ty})"
					>{seg.label}</text>
				{/each}

				<!-- Bowl shadow overlay for concave depth -->
				<circle cx="150" cy="150" r={R} fill="url(#wf_bowl)" pointer-events="none"/>

				<!-- Center hub -->
				<circle cx="150" cy="150" r="34" fill="#111" stroke="#c9a84c" stroke-width="1"/>
				<circle cx="150" cy="150" r="26" fill="url(#wf_hub)"/>
				<circle cx="150" cy="150" r="26" fill="none" stroke="#a78bfa" stroke-width="0.3" opacity="0.4"/>
				<!-- Hub specular highlight -->
				<ellipse cx="145" cy="144" rx="12" ry="8" fill="white" opacity="0.07" transform="rotate(-30, 145, 144)"/>
				<!-- Center dot -->
				<circle cx="150" cy="150" r="4" fill="#c9a84c" stroke="#8b6914" stroke-width="0.5"/>
			</svg>
		</div>
	</div>

	{#if resultIdx !== null}
		<div class="mb-3 rounded-full px-5 py-1.5 text-center {resultPop ? 'animate-pop animate-shake' : 'animate-fade-in'}" style="background: {SEGMENTS[resultIdx].color}20">
			<span class="text-lg font-bold" style="color: {SEGMENTS[resultIdx].color}">{SEGMENTS[resultIdx].label}</span>
		</div>
	{/if}

	{#if message}
		<div class="animate-slide-up mb-3 w-full rounded-xl px-4 py-2.5 text-center text-sm font-bold casino-shadow
			{messageType === 'win' ? 'bg-green-50 text-slot-win border border-green-200' : ''}
			{messageType === 'lose' ? 'bg-red-50 text-slot-lose border border-red-200' : ''}
			{messageType === 'info' ? 'bg-slot-accent/10 text-slot-accent border border-slot-accent/20' : ''}">{message}</div>
	{/if}

	<div class="mb-4 flex w-full items-center gap-2 sm:gap-3">
		<div class="flex items-center gap-0 rounded-xl border border-slot-border bg-slot-surface casino-shadow">
			<button onclick={decreaseBet} disabled={spinning} class="cursor-pointer rounded-l-xl px-2.5 py-1.5 text-base sm:px-3 sm:py-2 sm:text-lg font-bold text-slot-muted transition hover:text-slot-text disabled:cursor-not-allowed disabled:opacity-30">−</button>
			<div class="flex min-w-[3.5rem] flex-col items-center border-x border-slot-border px-1 sm:min-w-[4.5rem]">
				<span class="text-[9px] uppercase tracking-wider text-slot-muted">BET</span>
				<input type="number" bind:value={bet} onblur={validateBet} disabled={spinning} min="1" class="w-full bg-transparent text-center text-sm font-bold tabular-nums outline-none disabled:opacity-60 sm:text-base [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
			</div>
			<button onclick={increaseBet} disabled={spinning} class="cursor-pointer rounded-r-xl px-2.5 py-1.5 text-base sm:px-3 sm:py-2 sm:text-lg font-bold text-slot-muted transition hover:text-slot-text disabled:cursor-not-allowed disabled:opacity-30">+</button>
		</div>
		<button onclick={spin} disabled={spinning || wallet.credit < bet} class="flex-1 cursor-pointer rounded-xl bg-slot-accent px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:text-base">
			{spinning ? 'กำลังหมุน...' : 'หมุน'}
		</button>
	</div>

	<div class="mt-4 w-full rounded-xl border border-slot-border bg-slot-surface p-3 text-xs text-slot-muted casino-shadow">
		<p class="font-medium text-slot-text">วิธีเล่น</p>
		<p class="mt-1">หมุนวงล้อ ลุ้นรับ multiplier สูงสุด x10!</p>
		<p>x0 = เสียเงิน | x0.5 = ได้คืนครึ่ง | x1.5-x10 = ชนะ!</p>
	</div>
</div>

<style>
	.wheel-spinning {
		transition: transform 8s cubic-bezier(0.23, 1, 0.32, 1);
	}
</style>
