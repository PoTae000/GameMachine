<script lang="ts">
	let { value = 1, rolling = false, settled = false, glowing = false, glowColor = '' }: {
		value: number;
		rolling?: boolean;
		settled?: boolean;
		glowing?: boolean;
		glowColor?: string;
	} = $props();

	// Map value to rotation that shows that face forward
	const FACE_ROTATIONS: Record<number, string> = {
		1: 'rotateX(0deg) rotateY(0deg)',
		2: 'rotateX(0deg) rotateY(-90deg)',
		3: 'rotateX(-90deg) rotateY(0deg)',
		4: 'rotateX(90deg) rotateY(0deg)',
		5: 'rotateX(0deg) rotateY(90deg)',
		6: 'rotateX(0deg) rotateY(180deg)'
	};

	let cubeRotation = $derived(
		rolling ? '' : FACE_ROTATIONS[value] || FACE_ROTATIONS[1]
	);

	// Dot positions for each face value (percentage-based)
	const DOTS: Record<number, [number, number][]> = {
		1: [[50, 50]],
		2: [[30, 30], [70, 70]],
		3: [[30, 30], [50, 50], [70, 70]],
		4: [[30, 30], [70, 30], [30, 70], [70, 70]],
		5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
		6: [[28, 25], [72, 25], [28, 50], [72, 50], [28, 75], [72, 75]]
	};
</script>

<div class="dice-scene"
	class:dice-settled={settled}
	class:dice-glowing={glowing}
	style={glowColor ? `--glow-color: ${glowColor}` : ''}>
	<div class="dice-cube"
		class:dice-rolling={rolling}
		style={!rolling ? `transform: ${cubeRotation}` : ''}>
		{#each [1, 2, 3, 4, 5, 6] as face}
			<div class="dice-face dice-face-{face}">
				{#each DOTS[face] as [x, y]}
					<div class="dice-dot" style="left: {x}%; top: {y}%"></div>
				{/each}
			</div>
		{/each}
	</div>
</div>

<style>
	.dice-scene {
		width: 64px;
		height: 64px;
		perspective: 300px;
	}
	@media (min-width: 640px) {
		.dice-scene { width: 76px; height: 76px; }
	}
	.dice-settled {
		animation: dice-bounce 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.dice-glowing {
		filter: drop-shadow(0 0 8px var(--glow-color, #6d28d9));
		animation: dice-glow-pulse 0.8s ease-in-out infinite;
	}
	@keyframes dice-glow-pulse {
		0%,100% { filter: drop-shadow(0 0 4px var(--glow-color, #6d28d9)); }
		50% { filter: drop-shadow(0 0 12px var(--glow-color, #6d28d9)); }
	}
	@keyframes dice-bounce {
		0% { transform: scale(0.8) translateY(-10px); }
		50% { transform: scale(1.08) translateY(2px); }
		70% { transform: scale(0.96) translateY(-1px); }
		100% { transform: scale(1) translateY(0); }
	}

	.dice-cube {
		width: 100%;
		height: 100%;
		position: relative;
		transform-style: preserve-3d;
		transition: transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
	}
	.dice-rolling {
		animation: dice-roll-3d 0.4s linear infinite;
	}
	@keyframes dice-roll-3d {
		0% { transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg); }
		25% { transform: rotateX(90deg) rotateY(45deg) rotateZ(20deg); }
		50% { transform: rotateX(180deg) rotateY(135deg) rotateZ(-10deg); }
		75% { transform: rotateX(270deg) rotateY(225deg) rotateZ(15deg); }
		100% { transform: rotateX(360deg) rotateY(360deg) rotateZ(0deg); }
	}

	.dice-face {
		position: absolute;
		width: 100%;
		height: 100%;
		border-radius: 14%;
		background: linear-gradient(145deg, #ffffff 0%, #fafafa 40%, #ececec 100%);
		border: 1px solid #c8c8c8;
		box-shadow: inset 0 1px 2px rgba(255,255,255,0.8), inset 0 -1px 2px rgba(0,0,0,0.06);
		backface-visibility: visible;
	}
	/* Face positions on the cube */
	.dice-face-1 { transform: rotateY(0deg) translateZ(calc(50%)); }
	.dice-face-6 { transform: rotateY(180deg) translateZ(calc(50%)); }
	.dice-face-2 { transform: rotateY(-90deg) translateZ(calc(50%)); }
	.dice-face-5 { transform: rotateY(90deg) translateZ(calc(50%)); }
	.dice-face-3 { transform: rotateX(90deg) translateZ(calc(50%)); }
	.dice-face-4 { transform: rotateX(-90deg) translateZ(calc(50%)); }

	/* Edges visible between faces */
	.dice-face-1 { background: linear-gradient(145deg, #ffffff 0%, #f8f8f8 50%, #eaeaea 100%); }
	.dice-face-2 { background: linear-gradient(145deg, #f5f5f5 0%, #eeeeee 50%, #e0e0e0 100%); }
	.dice-face-3 { background: linear-gradient(180deg, #fafafa 0%, #f0f0f0 100%); }
	.dice-face-4 { background: linear-gradient(0deg, #f0f0f0 0%, #e5e5e5 100%); }
	.dice-face-5 { background: linear-gradient(215deg, #f2f2f2 0%, #e8e8e8 50%, #dddddd 100%); }
	.dice-face-6 { background: linear-gradient(215deg, #eeeeee 0%, #e5e5e5 50%, #d8d8d8 100%); }

	.dice-dot {
		position: absolute;
		width: 18%;
		height: 18%;
		border-radius: 50%;
		background: radial-gradient(circle at 40% 35%, #3a3a3a, #1a1a1a 60%, #111 100%);
		box-shadow: inset 0 1px 2px rgba(255,255,255,0.15), 0 1px 2px rgba(0,0,0,0.2);
		transform: translate(-50%, -50%);
	}
</style>
