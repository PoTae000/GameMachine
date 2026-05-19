<script lang="ts">
	import { getColor } from '$lib/games/rouletteEngine';
	import { playSpin, playBounce, playTick, playHeartbeat } from '$lib/sounds';
	import { onMount } from 'svelte';

	let {
		resultNumber = null,
		spinning = false,
		size = 'md',
		onAnimationComplete = () => {},
		enableSounds = true
	}: {
		resultNumber: number | null;
		spinning: boolean;
		size?: 'sm' | 'md';
		onAnimationComplete?: () => void;
		enableSounds?: boolean;
	} = $props();

	// European wheel order
	const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
	const SEG_DEG = 360 / 37;
	const CX = 150, CY = 150, R_OUTER = 133, R_INNER = 52;

	// Physics constants (in SVG viewBox 300x300 units)
	const TRACK_R = 128;
	const DEFLECTOR_R = 122;
	const BALL_RADIUS = 6;

	// Precompute annular (donut) wheel segment paths + text positions
	const segments = WHEEL_ORDER.map((num, i) => {
		const startDeg = i * SEG_DEG;
		const endDeg = (i + 1) * SEG_DEG;
		const midDeg = startDeg + SEG_DEG / 2;

		const toRad = (d: number) => (d - 90) * Math.PI / 180;
		const sr = toRad(startDeg);
		const er = toRad(endDeg);
		const mr = toRad(midDeg);

		const x1o = CX + R_OUTER * Math.cos(sr);
		const y1o = CY + R_OUTER * Math.sin(sr);
		const x2o = CX + R_OUTER * Math.cos(er);
		const y2o = CY + R_OUTER * Math.sin(er);

		const x1i = CX + R_INNER * Math.cos(sr);
		const y1i = CY + R_INNER * Math.sin(sr);
		const x2i = CX + R_INNER * Math.cos(er);
		const y2i = CY + R_INNER * Math.sin(er);

		const textR = (R_OUTER + R_INNER) / 2;
		const tx = CX + textR * Math.cos(mr);
		const ty = CY + textR * Math.sin(mr);

		const col = getColor(num);
		const fill = col === 'green' ? '#16a34a' : col === 'red' ? '#dc2626' : '#1e1e1e';

		let textRot = midDeg;
		if (midDeg > 90 && midDeg < 270) textRot += 180;

		const path = `M${x1o},${y1o} A${R_OUTER},${R_OUTER} 0 0,1 ${x2o},${y2o} L${x2i},${y2i} A${R_INNER},${R_INNER} 0 0,0 ${x1i},${y1i} Z`;

		return { num, path, fill, tx, ty, textRot };
	});

	let wheelEl: HTMLDivElement;
	let canvasEl: HTMLCanvasElement;
	let wheelAngle = 0;
	let rafId = 0;

	// Ball state (not $state - updated in rAF loop)
	let ball = { angle: 0, radius: 0, angVel: 0, radVel: 0, phase: 'idle' as 'idle' | 'track' | 'drop' | 'settle' | 'done', bounces: 0, settleOffset: 0 };

	// Track last result to detect changes
	let lastTriggeredResult: number | null = null;

	onMount(() => {
		setTimeout(handleResize, 50);
		return () => { if (rafId) cancelAnimationFrame(rafId); };
	});

	// Trigger animation when resultNumber changes from null to a number
	$effect(() => {
		const rn = resultNumber;
		if (rn !== null && rn !== lastTriggeredResult) {
			lastTriggeredResult = rn;
			triggerSpin(rn);
		} else if (rn === null) {
			lastTriggeredResult = null;
			// Reset ball
			ball.phase = 'idle';
			if (canvasEl) {
				const c = canvasEl.getContext('2d');
				if (c) c.clearRect(0, 0, canvasEl.width, canvasEl.height);
			}
		}
	});

	async function triggerSpin(finalResult: number) {
		const idx = WHEEL_ORDER.indexOf(finalResult);
		if (idx === -1) return;

		// Calculate wheel target rotation
		const segCenter = idx * SEG_DEG + SEG_DEG / 2;
		const targetMod = (360 - segCenter + 360) % 360;
		const currentMod = ((wheelAngle % 360) + 360) % 360;
		let delta = targetMod - currentMod;
		if (delta <= 0) delta += 360;
		const fullRotations = (8 + Math.floor(Math.random() * 4)) * 360;

		const startAngle = wheelAngle;
		const endAngle = startAngle + fullRotations + delta;

		if (enableSounds) playSpin();

		handleResize();

		await runAnimation(startAngle, endAngle, idx);
		wheelAngle = endAngle;

		onAnimationComplete();
	}

	// Cubic bezier easing
	function bezierVal(p0: number, p1: number, p2: number, p3: number, t: number): number {
		const mt = 1 - t;
		return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
	}

	function cubicBezierEase(t: number): number {
		let lo = 0, hi = 1;
		for (let i = 0; i < 20; i++) {
			const mid = (lo + hi) / 2;
			if (bezierVal(0, 0.15, 0.20, 1, mid) < t) lo = mid;
			else hi = mid;
		}
		const bt = (lo + hi) / 2;
		return bezierVal(0, 0.80, 1.00, 1, bt);
	}

	function runAnimation(startAngle: number, endAngle: number, targetIdx: number): Promise<void> {
		return new Promise((resolve) => {
			const DURATION = 9000;
			const startTime = performance.now();
			let lastTickAngle = 0;
			let heartbeatPlayed = false;

			// Init ball
			ball.angle = Math.random() * Math.PI * 2;
			ball.radius = TRACK_R;
			ball.angVel = -(0.16 + Math.random() * 0.04);
			ball.radVel = 0;
			ball.phase = 'track';
			ball.bounces = 0;
			ball.settleOffset = 0;

			function frame(now: number) {
				const elapsed = now - startTime;
				const t = Math.min(elapsed / DURATION, 1);
				const eased = cubicBezierEase(t);
				const currentAngle = startAngle + (endAngle - startAngle) * eased;

				if (wheelEl) wheelEl.style.transform = `rotate(${currentAngle}deg)`;

				// Wheel tick sound
				const angleDiff = Math.abs(currentAngle - lastTickAngle);
				if (angleDiff > 30 && t < 0.85 && enableSounds) {
					playTick();
					lastTickAngle = currentAngle;
				}

				// Suspense heartbeat
				if (t >= 0.60 && t <= 0.65 && !heartbeatPlayed && enableSounds) {
					playHeartbeat();
					heartbeatPlayed = true;
				}

				updateBall(t, currentAngle, targetIdx);
				drawBall();

				if (t < 1) {
					rafId = requestAnimationFrame(frame);
				} else {
					ball.phase = 'done';
					drawBall();
					resolve();
				}
			}

			rafId = requestAnimationFrame(frame);
		});
	}

	function updateBall(progress: number, wheelAngleDeg: number, targetIdx: number) {
		const pocketLocalDeg = targetIdx * SEG_DEG + SEG_DEG / 2;
		const currentTargetRad = (pocketLocalDeg + wheelAngleDeg) * Math.PI / 180;
		const SETTLE_R = R_OUTER - 16;

		if (progress < 0.48) {
			ball.phase = 'track';
			ball.angVel *= 0.9965;
			ball.angle += ball.angVel;
			ball.radius = TRACK_R + Math.sin(ball.angle * 8) * 0.5;
		} else if (progress < 0.68) {
			ball.phase = 'drop';
			const dropT = (progress - 0.48) / 0.20;
			ball.angVel *= 0.988;
			ball.angle += ball.angVel;

			const targetR = TRACK_R - (TRACK_R - SETTLE_R) * dropT * dropT;
			ball.radius += (targetR - ball.radius) * 0.08;

			if (dropT > 0.3 && dropT < 0.35 && ball.bounces === 0) {
				ball.angVel += (Math.random() - 0.5) * 0.03;
				ball.bounces++;
				if (enableSounds) playBounce();
			}
			if (dropT > 0.6 && dropT < 0.65 && ball.bounces === 1) {
				ball.angVel += (Math.random() - 0.5) * 0.02;
				ball.bounces++;
				if (enableSounds) playBounce();
			}
		} else {
			const settleT = Math.min((progress - 0.68) / 0.32, 1);
			const ease = settleT * settleT * (3 - 2 * settleT);

			if (ball.phase !== 'settle') {
				ball.phase = 'settle';
				let offset = ball.angle - currentTargetRad;
				while (offset > Math.PI) offset -= Math.PI * 2;
				while (offset < -Math.PI) offset += Math.PI * 2;
				ball.settleOffset = offset;
			}

			ball.angle = currentTargetRad + ball.settleOffset * (1 - ease);
			ball.angVel = 0;
			ball.radius += (SETTLE_R - ball.radius) * (0.1 + ease * 0.3);
		}

		ball.radius = Math.min(ball.radius, TRACK_R + 1);
	}

	function drawBall() {
		if (!canvasEl) return;
		const c = canvasEl.getContext('2d');
		if (!c) return;
		const W = canvasEl.width;
		const scale = W / 300;
		const cx = CX * scale;
		const cy = CY * scale;

		c.clearRect(0, 0, W, W);

		if (ball.phase === 'idle') return;

		const r = ball.radius * scale;
		const a = ball.angle;
		const x = cx + r * Math.sin(a);
		const y = cy - r * Math.cos(a);
		const br = BALL_RADIUS * scale;

		// Shadow
		c.beginPath();
		c.arc(x + 1.5 * scale, y + 1.5 * scale, br, 0, Math.PI * 2);
		c.fillStyle = 'rgba(0,0,0,0.35)';
		c.fill();

		// Ball body
		const grad = c.createRadialGradient(x - br * 0.3, y - br * 0.3, br * 0.1, x, y, br);
		grad.addColorStop(0, '#ffffff');
		grad.addColorStop(0.3, '#f5f5f5');
		grad.addColorStop(0.7, '#cccccc');
		grad.addColorStop(1, '#888888');
		c.beginPath();
		c.arc(x, y, br, 0, Math.PI * 2);
		c.fillStyle = grad;
		c.fill();
		c.strokeStyle = '#aaa';
		c.lineWidth = 0.3 * scale;
		c.stroke();

		// Specular highlight
		c.beginPath();
		c.arc(x - br * 0.25, y - br * 0.3, br * 0.3, 0, Math.PI * 2);
		c.fillStyle = 'rgba(255,255,255,0.7)';
		c.fill();
	}

	function handleResize() {
		if (!canvasEl || !wheelEl) return;
		const w = wheelEl.offsetWidth;
		const h = wheelEl.offsetHeight;
		const dpr = window.devicePixelRatio || 1;
		canvasEl.width = w * dpr;
		canvasEl.height = h * dpr;
		canvasEl.style.width = w + 'px';
		canvasEl.style.height = h + 'px';
	}

	const sizeClasses = {
		sm: 'h-[200px] w-[200px] sm:h-[220px] sm:w-[220px]',
		md: 'h-[240px] w-[240px] sm:h-[280px] sm:w-[280px] md:h-[320px] md:w-[320px]'
	};
</script>

<svelte:window onresize={handleResize} />

<div class="relative">
	<!-- Ball canvas overlay -->
	<canvas
		bind:this={canvasEl}
		class="pointer-events-none absolute inset-0 z-10"
	></canvas>

	<div
		bind:this={wheelEl}
		class={sizeClasses[size]}
	>
		<svg viewBox="0 0 300 300" class="h-full w-full">
			<defs>
				<linearGradient id="rw_rim" x1="0" y1="0" x2="1" y2="1">
					<stop offset="0%" stop-color="#a07828"/>
					<stop offset="25%" stop-color="#6b4423"/>
					<stop offset="50%" stop-color="#a07828"/>
					<stop offset="75%" stop-color="#6b4423"/>
					<stop offset="100%" stop-color="#a07828"/>
				</linearGradient>
				<radialGradient id="rw_bowl">
					<stop offset="0%" stop-color="black" stop-opacity="0"/>
					<stop offset="60%" stop-color="black" stop-opacity="0"/>
					<stop offset="100%" stop-color="black" stop-opacity="0.35"/>
				</radialGradient>
				<radialGradient id="rw_rim3d">
					<stop offset="88%" stop-color="black" stop-opacity="0"/>
					<stop offset="95%" stop-color="black" stop-opacity="0.15"/>
					<stop offset="100%" stop-color="black" stop-opacity="0.35"/>
				</radialGradient>
				<radialGradient id="rw_hub" cx="42%" cy="38%">
					<stop offset="0%" stop-color="#a78bfa"/>
					<stop offset="50%" stop-color="#7c3aed"/>
					<stop offset="100%" stop-color="#4c1d95"/>
				</radialGradient>
			</defs>

			<!-- Outer rim -->
			<circle cx="150" cy="150" r="148" fill="url(#rw_rim)" stroke="#3a2010" stroke-width="1"/>
			<circle cx="150" cy="150" r="148" fill="url(#rw_rim3d)"/>
			<circle cx="150" cy="150" r="147" fill="none" stroke="#c9a84c" stroke-width="0.4" opacity="0.4"/>
			<circle cx="150" cy="150" r="141" fill="none" stroke="#a08030" stroke-width="0.4" opacity="0.5"/>

			<!-- Ball track -->
			<circle cx="150" cy="150" r="139" fill="#0c0c0c"/>
			<circle cx="150" cy="150" r="139" fill="none" stroke="#222" stroke-width="0.5"/>
			<circle cx="150" cy="150" r="137" fill="none" stroke="#333" stroke-width="0.3" opacity="0.5"/>

			<!-- Diamond deflectors (8 evenly spaced) -->
			{#each Array.from({length: 8}, (_, i) => i) as i}
				{@const deg = i * 45}
				{@const rad = (deg - 90) * Math.PI / 180}
				{@const dx = CX + DEFLECTOR_R * Math.cos(rad)}
				{@const dy = CY + DEFLECTOR_R * Math.sin(rad)}
				<polygon
					points="{dx},{dy - 4} {dx + 2.5},{dy} {dx},{dy + 4} {dx - 2.5},{dy}"
					fill="#c9a84c"
					stroke="#8b6914"
					stroke-width="0.3"
					transform="rotate({deg}, {dx}, {dy})"
				/>
			{/each}

			<!-- Segment ring outer border -->
			<circle cx="150" cy="150" r={R_OUTER} fill="none" stroke="#c9b458" stroke-width="0.7"/>

			<!-- Numbered pocket segments -->
			{#each segments as seg}
				<path d={seg.path} fill={seg.fill} stroke="#c9b458" stroke-width="0.3"/>
			{/each}

			<!-- Segment ring inner border -->
			<circle cx="150" cy="150" r={R_INNER} fill="none" stroke="#c9b458" stroke-width="0.7"/>

			<!-- Pocket divider accents -->
			{#each segments as seg, i}
				{@const deg = i * SEG_DEG}
				{@const rad = (deg - 90) * Math.PI / 180}
				{@const x1 = CX + R_INNER * Math.cos(rad)}
				{@const y1 = CY + R_INNER * Math.sin(rad)}
				{@const x2 = CX + R_OUTER * Math.cos(rad)}
				{@const y2 = CY + R_OUTER * Math.sin(rad)}
				<line {x1} {y1} {x2} {y2} stroke="#c9b458" stroke-width="0.15" opacity="0.4"/>
			{/each}

			<!-- Segment numbers -->
			{#each segments as seg}
				<text
					x={seg.tx}
					y={seg.ty}
					text-anchor="middle"
					dominant-baseline="central"
					fill="white"
					font-size="8"
					font-weight="bold"
					font-family="sans-serif"
					transform="rotate({seg.textRot}, {seg.tx}, {seg.ty})"
				>{seg.num}</text>
			{/each}

			<!-- Bowl shadow overlay -->
			<circle cx="150" cy="150" r="137" fill="url(#rw_bowl)" pointer-events="none"/>

			<!-- Center turret -->
			<circle cx="150" cy="150" r="46" fill="#111" stroke="#c9b458" stroke-width="0.8"/>
			<circle cx="150" cy="150" r="38" fill="url(#rw_hub)"/>
			<circle cx="150" cy="150" r="38" fill="none" stroke="#a78bfa" stroke-width="0.3" opacity="0.4"/>
			<ellipse cx="143" cy="142" rx="16" ry="10" fill="white" opacity="0.07" transform="rotate(-30, 143, 142)"/>
			<text x="150" y="151" text-anchor="middle" dominant-baseline="central" fill="white" font-size="7" font-weight="bold" font-family="sans-serif">BUNG</text>
		</svg>
	</div>
</div>
