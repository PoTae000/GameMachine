import gsap from 'gsap';

/**
 * Reel landing bounce — replaces CSS animate-reel-land with GSAP elastic easing.
 * Applies to the inner symbol wrapper of a reel cell after it stops.
 */
export function reelLand(element: HTMLElement): gsap.core.Tween {
	gsap.set(element, { y: '-60%', scale: 0.85, opacity: 0 });
	return gsap.to(element, {
		y: '0%',
		scale: 1,
		opacity: 1,
		duration: 0.5,
		ease: 'elastic.out(1, 0.3)'
	});
}

/**
 * Reel blur transition — adds motion blur during spin and removes on land
 */
export function reelBlurIn(element: HTMLElement): gsap.core.Tween {
	return gsap.to(element, {
		filter: 'blur(1.5px)',
		opacity: 0.6,
		duration: 0.15,
		ease: 'power1.in'
	});
}

export function reelBlurOut(element: HTMLElement): gsap.core.Tween {
	return gsap.to(element, {
		filter: 'blur(0px)',
		opacity: 1,
		duration: 0.3,
		ease: 'power2.out'
	});
}

/**
 * Win cell sequential highlighting — lights up winning cells along a payline left-to-right.
 */
export function winCellHighlight(
	cells: HTMLElement[],
	options: { stagger?: number; glowColor?: string } = {}
): gsap.core.Timeline {
	const { stagger = 0.1, glowColor = 'rgba(139, 92, 246, 0.35)' } = options;
	const tl = gsap.timeline();

	tl.from(cells, {
		scale: 0.85,
		opacity: 0.3,
		duration: 0.35,
		stagger,
		ease: 'back.out(1.7)'
	});

	tl.to(
		cells,
		{
			boxShadow: `0 0 16px 4px ${glowColor}, inset 0 0 12px 2px ${glowColor}`,
			duration: 0.3,
			stagger: stagger * 0.5,
			ease: 'power2.out'
		},
		'-=0.2'
	);

	return tl;
}

/**
 * Big win celebration — orchestrated timeline for the big win modal.
 */
export function bigWinCelebration(
	backdrop: HTMLElement,
	modal: HTMLElement,
	emoji: HTMLElement,
	title: HTMLElement,
	amount: HTMLElement,
	amountValue: number,
	confettiContainer: HTMLElement
): gsap.core.Timeline {
	const tl = gsap.timeline();

	// 1. Backdrop + modal slam in from scale 0
	gsap.set(backdrop, { opacity: 0 });
	gsap.set(modal, { scale: 0, opacity: 0, rotation: -8 });
	tl.to(backdrop, { opacity: 1, duration: 0.15, ease: 'power2.out' });
	tl.to(modal, { scale: 1.08, opacity: 1, rotation: 0, duration: 0.3, ease: 'back.out(2.5)' }, '<');
	tl.to(modal, { scale: 1, duration: 0.15, ease: 'power2.out' });

	// 2. Shake effect on modal
	tl.to(modal, { x: -6, duration: 0.04 });
	tl.to(modal, { x: 6, duration: 0.04 });
	tl.to(modal, { x: -4, duration: 0.04 });
	tl.to(modal, { x: 4, duration: 0.04 });
	tl.to(modal, { x: 0, duration: 0.04 });

	// 3. Emoji bounces in big
	gsap.set(emoji, { scale: 0, opacity: 0 });
	tl.to(emoji, { scale: 1.3, opacity: 1, duration: 0.2, ease: 'back.out(3)' }, '-=0.15');
	tl.to(emoji, { scale: 1, duration: 0.15, ease: 'power2.out' });

	// 4. Title slams in
	gsap.set(title, { scale: 0.5, opacity: 0 });
	tl.to(title, { scale: 1, opacity: 1, duration: 0.2, ease: 'back.out(2)' }, '-=0.1');

	// 5. Amount counts up with scale pulse
	const counter = { value: 0 };
	gsap.set(amount, { opacity: 0, scale: 0.8 });
	tl.to(amount, { opacity: 1, scale: 1, duration: 0.2, ease: 'back.out(1.7)' });
	tl.to(
		counter,
		{
			value: amountValue,
			duration: 0.8,
			ease: 'power2.out',
			onUpdate: () => {
				amount.textContent = `+${Math.floor(counter.value).toLocaleString()}`;
			}
		},
		'-=0.1'
	);

	// 6. Amount scale pulse when counting finishes
	tl.to(amount, { scale: 1.15, duration: 0.1, ease: 'power2.out' });
	tl.to(amount, { scale: 1, duration: 0.2, ease: 'elastic.out(1, 0.4)' });

	// 7. Confetti burst x2 for dramatic effect
	confettiBurst(confettiContainer, 35);
	gsap.delayedCall(0.3, () => confettiBurst(confettiContainer, 20));

	return tl;
}

/**
 * Free spin popup — purple-themed entrance animation.
 */
export function freeSpinPopup(
	backdrop: HTMLElement,
	modal: HTMLElement
): gsap.core.Timeline {
	const tl = gsap.timeline();

	gsap.set(backdrop, { opacity: 0 });
	tl.to(backdrop, { opacity: 1, duration: 0.15, ease: 'power2.out' });

	gsap.set(modal, { scale: 0.5, opacity: 0, rotation: -3 });
	tl.to(
		modal,
		{
			scale: 1,
			opacity: 1,
			rotation: 0,
			duration: 0.3,
			ease: 'back.out(1.7)'
		},
		'<'
	);

	return tl;
}

/**
 * Credit counter smooth number animation.
 */
export function creditCountUp(
	element: HTMLElement,
	from: number,
	to: number,
	onUpdate: (value: number) => void
): gsap.core.Tween {
	const counter = { value: from };
	const diff = Math.abs(to - from);
	const duration = Math.min(0.6, diff > 1000 ? 0.6 : 0.3);

	return gsap.to(counter, {
		value: to,
		duration,
		ease: 'power3.out',
		onUpdate: () => {
			onUpdate(Math.round(counter.value * 100) / 100);
		}
	});
}

/**
 * Credit badge scale pulse on change.
 */
export function creditPulse(element: HTMLElement, isGain: boolean): gsap.core.Timeline {
	const tl = gsap.timeline();
	const color = isGain ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)';
	const shadow = isGain
		? '0 0 12px 3px rgba(34, 197, 94, 0.4)'
		: '0 0 12px 3px rgba(239, 68, 68, 0.4)';

	tl.to(element, {
		scale: 1.2,
		backgroundColor: color,
		boxShadow: shadow,
		duration: 0.15,
		ease: 'power2.out'
	});
	tl.to(element, {
		scale: 1,
		backgroundColor: 'transparent',
		boxShadow: '0 0 0px 0px transparent',
		duration: 0.4,
		ease: 'elastic.out(1, 0.4)',
		clearProps: 'boxShadow'
	});

	return tl;
}

/**
 * Spin button press feedback — ripple + scale press.
 */
export function spinButtonPress(btnElement: HTMLElement): gsap.core.Timeline {
	const tl = gsap.timeline();

	tl.to(btnElement, {
		scale: 0.85,
		duration: 0.08,
		ease: 'power2.in'
	});
	tl.to(btnElement, {
		scale: 1.05,
		duration: 0.15,
		ease: 'power2.out'
	});
	tl.to(btnElement, {
		scale: 1,
		duration: 0.25,
		ease: 'elastic.out(1, 0.4)'
	});

	// Create and animate ripple
	const ripple = document.createElement('span');
	ripple.className = 'gsap-ripple';
	btnElement.appendChild(ripple);

	gsap.set(ripple, {
		position: 'absolute',
		top: '50%',
		left: '50%',
		width: '100%',
		height: '100%',
		borderRadius: '50%',
		background: 'rgba(255,255,255,0.3)',
		transform: 'translate(-50%, -50%) scale(0)',
		pointerEvents: 'none',
		zIndex: 5
	});

	gsap.to(ripple, {
		scale: 2,
		opacity: 0,
		duration: 0.5,
		ease: 'power2.out',
		onComplete: () => ripple.remove()
	});

	return tl;
}

/**
 * Game card stagger entrance from bottom.
 */
export function gameCardEntrance(cards: HTMLElement[]): gsap.core.Tween {
	gsap.set(cards, { y: 40, opacity: 0 });
	return gsap.to(cards, {
		y: 0,
		opacity: 1,
		duration: 0.5,
		stagger: 0.05,
		ease: 'back.out(1.7)'
	});
}

/**
 * Game card 3D tilt on hover based on mouse position.
 */
export function gameCardTilt(cardElement: HTMLElement, mouseEvent: MouseEvent): void {
	const rect = cardElement.getBoundingClientRect();
	const x = mouseEvent.clientX - rect.left;
	const y = mouseEvent.clientY - rect.top;
	const centerX = rect.width / 2;
	const centerY = rect.height / 2;

	const rotateX = ((y - centerY) / centerY) * -8;
	const rotateY = ((x - centerX) / centerX) * 8;

	gsap.to(cardElement, {
		rotateX,
		rotateY,
		transformPerspective: 800,
		duration: 0.3,
		ease: 'power2.out'
	});
}

/**
 * Reset card tilt on mouse leave.
 */
export function gameCardTiltReset(cardElement: HTMLElement): void {
	gsap.to(cardElement, {
		rotateX: 0,
		rotateY: 0,
		duration: 0.4,
		ease: 'power2.out'
	});
}

/**
 * Confetti burst — creates DOM particles with GSAP animation.
 */
export function confettiBurst(container: HTMLElement, count = 25): void {
	const colors = ['#fbbf24', '#f59e0b', '#ef4444', '#8b5cf6', '#22c55e', '#3b82f6', '#ec4899'];

	for (let i = 0; i < count; i++) {
		const particle = document.createElement('div');
		particle.className = 'gsap-confetti';
		container.appendChild(particle);

		const color = colors[Math.floor(Math.random() * colors.length)];
		const size = 4 + Math.random() * 6;
		const isCircle = Math.random() > 0.5;

		gsap.set(particle, {
			position: 'absolute',
			top: '50%',
			left: '50%',
			width: size,
			height: isCircle ? size : size * 0.6,
			borderRadius: isCircle ? '50%' : '2px',
			background: color,
			pointerEvents: 'none',
			zIndex: 100
		});

		const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
		const distance = 80 + Math.random() * 120;
		const xEnd = Math.cos(angle) * distance;
		const yEnd = Math.sin(angle) * distance - 40;

		gsap.to(particle, {
			x: xEnd,
			y: yEnd,
			rotation: Math.random() * 720 - 360,
			opacity: 0,
			duration: 0.8 + Math.random() * 0.6,
			ease: 'power2.out',
			onComplete: () => particle.remove()
		});
	}
}

/**
 * Payline trace — animates SVG stroke-dashoffset for a payline path.
 */
export function paylineTrace(svgPath: SVGPathElement, duration = 0.5): gsap.core.Tween {
	const length = svgPath.getTotalLength();
	gsap.set(svgPath, {
		strokeDasharray: length,
		strokeDashoffset: length,
		opacity: 1
	});

	return gsap.to(svgPath, {
		strokeDashoffset: 0,
		duration,
		ease: 'power2.inOut'
	});
}

/**
 * Free spin counter count-up animation.
 */
export function freeSpinCountUp(
	total: number,
	onUpdate: (value: number) => void
): gsap.core.Tween {
	const counter = { value: 0 };
	return gsap.to(counter, {
		value: total,
		duration: 0.8,
		ease: 'power3.out',
		onUpdate: () => {
			onUpdate(Math.floor(counter.value));
		},
		onComplete: () => {
			onUpdate(total);
		}
	});
}

/**
 * Modal entrance — generic GSAP replacement for CSS animate-modal + animate-backdrop.
 */
export function modalEntrance(
	backdrop: HTMLElement,
	modal: HTMLElement
): gsap.core.Timeline {
	const tl = gsap.timeline();

	gsap.set(backdrop, { opacity: 0 });
	tl.to(backdrop, { opacity: 1, duration: 0.15, ease: 'power2.out' });

	gsap.set(modal, { scale: 0.9, y: 8, opacity: 0 });
	tl.to(
		modal,
		{
			scale: 1,
			y: 0,
			opacity: 1,
			duration: 0.25,
			ease: 'back.out(1.7)'
		},
		'<'
	);

	return tl;
}

/**
 * Kill all GSAP tweens on an element — for skip/cleanup.
 */
export function killAnimations(element: HTMLElement): void {
	gsap.killTweensOf(element);
	gsap.set(element, { clearProps: 'all' });
}

/**
 * Credit number color flash (green for gain, red for loss).
 */
export function creditColorFlash(element: HTMLElement, isGain: boolean): void {
	const flashColor = isGain ? '#22c55e' : '#ef4444';
	gsap.to(element, {
		color: flashColor,
		duration: 0.15,
		ease: 'power2.out',
		onComplete: () => {
			gsap.to(element, {
				color: '',
				duration: 0.4,
				ease: 'power2.out',
				clearProps: 'color'
			});
		}
	});
}

/**
 * Animate GSAP reel landing for an array of cell elements in a column.
 * Dramatic drop + elastic bounce — symbols stretch vertically as they land.
 */
export function reelLandColumn(elements: HTMLElement[]): void {
	elements.forEach((el, i) => {
		gsap.fromTo(el,
			{ y: -18, scaleY: 1.25, scaleX: 0.82, opacity: 0.5 },
			{
				y: 0, scaleY: 1, scaleX: 1, opacity: 1,
				duration: 0.4, delay: i * 0.04,
				ease: 'elastic.out(1.2, 0.4)',
				clearProps: 'all'
			}
		);
	});
}

/**
 * Brief purple flash on reel cells when a column stops — visible "clunk" feedback.
 */
export function reelColumnFlash(cellElements: HTMLElement[]): void {
	cellElements.forEach(el => {
		gsap.fromTo(el,
			{ boxShadow: 'inset 0 0 30px 8px rgba(139, 92, 246, 0.6)' },
			{
				boxShadow: 'inset 0 0 0px 0px rgba(139, 92, 246, 0)',
				duration: 0.5,
				ease: 'power2.out',
				clearProps: 'boxShadow'
			}
		);
	});
}

/**
 * Create a GSAP timeline for win cell highlighting.
 * Dramatic entrance pop + continuous pulsing glow loop.
 */
export function createWinCellsTimeline(
	lineWinCells: HTMLElement[][],
	scatterCells: HTMLElement[]
): gsap.core.Timeline {
	const tl = gsap.timeline();

	const allCells: HTMLElement[] = [...new Set([...lineWinCells.flat(), ...scatterCells])];
	if (allCells.length === 0) return tl;

	// 1. Dramatic entrance — pop in with overshoot
	tl.fromTo(allCells,
		{ scale: 0.6, opacity: 0.2 },
		{
			scale: 1.1, opacity: 1,
			duration: 0.3, stagger: 0.04,
			ease: 'back.out(3)'
		}
	);

	// 2. Settle back
	tl.to(allCells, {
		scale: 1,
		duration: 0.15,
		ease: 'power2.out'
	});

	// 3. Continuous glow pulse — scale + boxShadow loops forever
	tl.to(allCells, {
		scale: 1.08,
		boxShadow: '0 0 20px 6px rgba(139, 92, 246, 0.55), inset 0 0 15px 4px rgba(139, 92, 246, 0.3)',
		duration: 0.6,
		ease: 'sine.inOut',
		yoyo: true,
		repeat: -1,
		stagger: { each: 0.06, from: 'start' }
	});

	return tl;
}

/**
 * Animate payline SVG paths with staggered delay.
 */
export function animatePaylinePaths(paths: SVGPathElement[], staggerDelay = 0.15): void {
	paths.forEach((path, i) => {
		gsap.delayedCall(i * staggerDelay, () => paylineTrace(path, 0.3));
	});
}

/**
 * Grid shake — screen shake on the reel grid when winning.
 * intensity: 'light' (small win), 'medium' (good win), 'heavy' (big/mega win)
 */
export function gridShake(
	element: HTMLElement,
	intensity: 'light' | 'medium' | 'heavy' = 'light'
): gsap.core.Timeline {
	const tl = gsap.timeline();
	const config = {
		light: { px: 3, count: 4, duration: 0.04, zoom: 1 },
		medium: { px: 6, count: 6, duration: 0.04, zoom: 1.01 },
		heavy: { px: 10, count: 8, duration: 0.05, zoom: 1.03 }
	}[intensity];

	if (config.zoom > 1) {
		tl.to(element, { scale: config.zoom, duration: 0.1, ease: 'power2.out' }, 0);
	}

	for (let i = 0; i < config.count; i++) {
		const dir = i % 2 === 0 ? -1 : 1;
		const decay = 1 - i / (config.count * 1.5);
		const px = config.px * decay;
		const rotDeg = intensity === 'heavy' ? dir * decay * 1.5 : dir * decay * 0.5;
		tl.to(element, {
			x: dir * px,
			y: (Math.random() - 0.5) * px * 0.6,
			rotation: rotDeg,
			duration: config.duration,
			ease: 'power2.inOut'
		});
	}

	tl.to(element, { x: 0, y: 0, rotation: 0, scale: 1, duration: 0.15, ease: 'elastic.out(1, 0.4)', clearProps: 'transform' });
	return tl;
}

/**
 * Reel anticipation — vibrate + glow effect on grid before last column lands.
 * Returns a tween that can be killed to stop the effect.
 */
export function reelAnticipation(gridElement: HTMLElement): gsap.core.Timeline {
	const tl = gsap.timeline({ repeat: -1 });

	// Vibrate effect
	tl.to(gridElement, { x: -1.5, duration: 0.04, ease: 'none' });
	tl.to(gridElement, { x: 1.5, duration: 0.04, ease: 'none' });
	tl.to(gridElement, { x: -1, duration: 0.04, ease: 'none' });
	tl.to(gridElement, { x: 1, duration: 0.04, ease: 'none' });
	tl.to(gridElement, { x: 0, duration: 0.04, ease: 'none' });

	// Glow border pulse (purple) — stored on timeline for targeted cleanup
	const glowTween = gsap.to(gridElement, {
		boxShadow: '0 0 20px 6px rgba(139, 92, 246, 0.5), inset 0 0 15px 3px rgba(139, 92, 246, 0.15)',
		duration: 0.4,
		ease: 'sine.inOut',
		yoyo: true,
		repeat: -1
	});
	(tl as any)._glowTween = glowTween;

	return tl;
}

/**
 * Stop reel anticipation and clean up.
 */
export function stopReelAnticipation(gridElement: HTMLElement, tl: gsap.core.Timeline): void {
	tl.kill();
	// Kill only the glow tween we stored, not ALL tweens on the element
	const glowTween = (tl as any)._glowTween;
	if (glowTween) glowTween.kill();
	gsap.set(gridElement, { x: 0, clearProps: 'x,boxShadow' });
}

/**
 * Floating win text — creates "+500" text that floats up from the grid center.
 */
export function floatingWinText(
	container: HTMLElement,
	text: string,
	color: string = '#22c55e'
): void {
	const el = document.createElement('div');
	el.className = 'floating-text';
	el.textContent = text;
	container.appendChild(el);

	const rect = container.getBoundingClientRect();
	gsap.set(el, {
		position: 'absolute',
		left: '50%',
		top: '50%',
		xPercent: -50,
		yPercent: -50,
		scale: 0.5,
		opacity: 1,
		color: color,
		fontSize: '2rem',
		fontWeight: 900,
		textShadow: `0 0 10px ${color}, 0 2px 8px rgba(0,0,0,0.5)`,
		pointerEvents: 'none',
		zIndex: 60,
		whiteSpace: 'nowrap'
	});

	const tl = gsap.timeline();
	tl.to(el, { scale: 1.2, duration: 0.25, ease: 'back.out(2)' });
	tl.to(el, {
		y: -80,
		scale: 1,
		opacity: 0,
		duration: 0.8,
		ease: 'power2.out',
		onComplete: () => el.remove()
	});
}

/**
 * Win cell particle burst — small particles explode from each winning cell.
 */
export function winCellParticles(
	cellElements: HTMLElement[],
	color: string = '#8b5cf6'
): void {
	const colors = [color, '#fbbf24', '#f59e0b', '#ffffff'];

	for (const cell of cellElements) {
		const rect = cell.getBoundingClientRect();
		const parentRect = cell.offsetParent?.getBoundingClientRect() ?? rect;
		const cx = rect.left - parentRect.left + rect.width / 2;
		const cy = rect.top - parentRect.top + rect.height / 2;
		const count = 8 + Math.floor(Math.random() * 5);

		for (let i = 0; i < count; i++) {
			const particle = document.createElement('div');
			particle.className = 'ambient-particle';
			(cell.offsetParent as HTMLElement ?? cell.parentElement)?.appendChild(particle);

			const pColor = colors[Math.floor(Math.random() * colors.length)];
			const size = 3 + Math.random() * 4;

			gsap.set(particle, {
				position: 'absolute',
				left: cx,
				top: cy,
				width: size,
				height: size,
				borderRadius: '50%',
				background: pColor,
				boxShadow: `0 0 4px ${pColor}`,
				pointerEvents: 'none',
				zIndex: 55
			});

			const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.8;
			const dist = 30 + Math.random() * 50;

			gsap.to(particle, {
				x: Math.cos(angle) * dist,
				y: Math.sin(angle) * dist,
				opacity: 0,
				scale: 0.2,
				duration: 0.5 + Math.random() * 0.4,
				ease: 'power2.out',
				onComplete: () => particle.remove()
			});
		}
	}
}

/**
 * Ambient background particles — subtle floating dots in the grid area.
 * Returns a cleanup function to stop and remove all particles.
 */
export function ambientParticles(
	container: HTMLElement,
	color: string = '#8b5cf6'
): () => void {
	let active = true;
	const particles: HTMLElement[] = [];
	const PARTICLE_COUNT = 18;

	function spawnParticle() {
		if (!active) return;

		const p = document.createElement('div');
		p.className = 'ambient-particle';
		container.appendChild(p);
		particles.push(p);

		const size = 2 + Math.random() * 3;
		const startX = Math.random() * 100;
		const opacity = 0.15 + Math.random() * 0.15;

		gsap.set(p, {
			position: 'absolute',
			left: `${startX}%`,
			bottom: '-5px',
			width: size,
			height: size,
			borderRadius: '50%',
			background: color,
			boxShadow: `0 0 ${size * 2}px ${color}`,
			opacity: 0,
			pointerEvents: 'none',
			zIndex: 1
		});

		gsap.to(p, {
			opacity: opacity,
			duration: 0.8,
			ease: 'power1.in'
		});

		gsap.to(p, {
			y: -(container.clientHeight + 20),
			x: `+=${(Math.random() - 0.5) * 40}`,
			duration: 4 + Math.random() * 4,
			ease: 'none',
			onComplete: () => {
				p.remove();
				const idx = particles.indexOf(p);
				if (idx >= 0) particles.splice(idx, 1);
				if (active) spawnParticle();
			}
		});

		gsap.to(p, {
			opacity: 0,
			duration: 1.5,
			delay: 3 + Math.random() * 3,
			ease: 'power1.out'
		});
	}

	// Stagger initial spawns
	for (let i = 0; i < PARTICLE_COUNT; i++) {
		gsap.delayedCall(i * 0.3, spawnParticle);
	}

	return () => {
		active = false;
		particles.forEach(p => {
			gsap.killTweensOf(p);
			p.remove();
		});
		particles.length = 0;
	};
}

/**
 * Free spin flash — purple screen flash when entering free spin mode.
 */
export function freeSpinFlash(gridElement: HTMLElement): gsap.core.Timeline {
	const tl = gsap.timeline();

	// Create flash overlay
	const flash = document.createElement('div');
	flash.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:60;border-radius:inherit;';
	gridElement.appendChild(flash);

	gsap.set(flash, { background: 'rgba(139, 92, 246, 0)', opacity: 1 });

	tl.to(flash, {
		background: 'rgba(139, 92, 246, 0.6)',
		duration: 0.08,
		ease: 'power2.in'
	});
	tl.to(flash, {
		background: 'rgba(139, 92, 246, 0)',
		duration: 0.3,
		ease: 'power2.out',
		onComplete: () => flash.remove()
	});

	// Border glow pulse
	tl.to(gridElement, {
		boxShadow: '0 0 30px 10px rgba(139, 92, 246, 0.6), inset 0 0 20px 5px rgba(139, 92, 246, 0.2)',
		duration: 0.15,
		ease: 'power2.out'
	}, 0);
	tl.to(gridElement, {
		boxShadow: 'none',
		duration: 0.6,
		ease: 'power2.out',
		clearProps: 'boxShadow'
	});

	return tl;
}

/**
 * Flying credit number — "+100" or "-50" flies from source to the credit badge.
 */
export function flyingCreditNumber(
	fromElement: HTMLElement | null,
	toBadgeElement: HTMLElement,
	amount: number,
	isGain: boolean
): void {
	const el = document.createElement('div');
	el.className = 'flying-credit';
	el.textContent = isGain ? `+${Math.abs(Math.round(amount)).toLocaleString()}` : `-${Math.abs(Math.round(amount)).toLocaleString()}`;
	document.body.appendChild(el);

	const color = isGain ? '#22c55e' : '#ef4444';
	const badgeRect = toBadgeElement.getBoundingClientRect();
	let startX: number, startY: number;

	if (fromElement) {
		const fromRect = fromElement.getBoundingClientRect();
		startX = fromRect.left + fromRect.width / 2;
		startY = fromRect.top + fromRect.height / 2;
	} else {
		startX = window.innerWidth / 2;
		startY = window.innerHeight / 2;
	}

	const endX = badgeRect.left + badgeRect.width / 2;
	const endY = badgeRect.top + badgeRect.height / 2;

	gsap.set(el, {
		position: 'fixed',
		left: startX,
		top: startY,
		xPercent: -50,
		yPercent: -50,
		fontSize: '1.25rem',
		fontWeight: 900,
		color: color,
		textShadow: `0 0 8px ${color}, 0 2px 4px rgba(0,0,0,0.5)`,
		pointerEvents: 'none',
		zIndex: 9999,
		scale: 1.2,
		opacity: 1
	});

	// Animate: arc upward first, then swoop to badge
	const tl = gsap.timeline();

	// Phase 1: Rise up with scale
	tl.to(el, {
		left: (startX + endX) / 2 + (Math.random() - 0.5) * 60,
		top: Math.min(startY, endY) - 40,
		scale: 1,
		duration: 0.3,
		ease: 'power2.out'
	});

	// Phase 2: Swoop down to badge, shrink + fade
	tl.to(el, {
		left: endX,
		top: endY,
		scale: 0.4,
		opacity: 0,
		duration: 0.4,
		ease: 'power2.in',
		onComplete: () => {
			el.remove();
			// Badge pulse on arrival
			creditPulse(toBadgeElement, isGain);
		}
	});
}

// Re-export types for components that need Timeline/Tween type annotations
export type GsapTimeline = gsap.core.Timeline;
export type GsapTween = gsap.core.Tween;

