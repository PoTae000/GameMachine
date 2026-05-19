let ctx: AudioContext | null = null;
let _muted = false;

export function setSoundEnabled(on: boolean) {
	_muted = !on;
	if (typeof localStorage !== 'undefined') localStorage.setItem('soundOn', on ? '1' : '0');
}
export function isSoundEnabled(): boolean { return !_muted; }

// Init from localStorage
if (typeof localStorage !== 'undefined') {
	_muted = localStorage.getItem('soundOn') === '0';
}

function getCtx(): AudioContext | null {
	if (_muted) return null;
	if (!ctx) ctx = new AudioContext();
	if (ctx.state === 'suspended') ctx.resume();
	return ctx;
}

// ── Core Helpers ──

function createNoise(c: AudioContext, dur: number): AudioBufferSourceNode {
	const len = Math.max(1, Math.floor(c.sampleRate * dur));
	const buf = c.createBuffer(1, len, c.sampleRate);
	const d = buf.getChannelData(0);
	for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
	const src = c.createBufferSource();
	src.buffer = buf;
	return src;
}

function filteredNoise(
	filterType: BiquadFilterType, freq: number, Q: number,
	vol: number, attack: number, decay: number, start = 0
) {
	const c = getCtx();
	if (!c) return;
	const dur = attack + decay;
	const noise = createNoise(c, dur + 0.05);
	const filter = c.createBiquadFilter();
	filter.type = filterType;
	filter.frequency.value = freq;
	filter.Q.value = Q;
	const g = c.createGain();
	const t = c.currentTime + start;
	g.gain.setValueAtTime(0.001, t);
	g.gain.linearRampToValueAtTime(vol, t + Math.max(attack, 0.001));
	g.gain.exponentialRampToValueAtTime(0.001, t + dur);
	noise.connect(filter);
	filter.connect(g);
	g.connect(c.destination);
	noise.start(t);
	noise.stop(t + dur + 0.05);
}

function envTone(
	freq: number, type: OscillatorType, vol: number,
	attack: number, decay: number, start = 0
) {
	const c = getCtx();
	if (!c) return;
	const osc = c.createOscillator();
	osc.type = type;
	osc.frequency.value = freq;
	const g = c.createGain();
	const t = c.currentTime + start;
	const dur = attack + decay;
	g.gain.setValueAtTime(0.001, t);
	g.gain.linearRampToValueAtTime(vol, t + Math.max(attack, 0.001));
	g.gain.exponentialRampToValueAtTime(0.001, t + dur);
	osc.connect(g);
	g.connect(c.destination);
	osc.start(t);
	osc.stop(t + dur + 0.05);
}

function metalTone(fundamentals: number[], vol: number, decay: number, start = 0) {
	fundamentals.forEach(f => {
		envTone(f + (Math.random() - 0.5) * 20, 'sine', vol, 0.001, decay, start);
	});
}

// ── CARD SOUNDS ──

/** Card being dealt / tossed onto table — sharp crisp snap */
export function playCardDeal() {
	// Very sharp transient snap (the "ฉับ")
	filteredNoise('highpass', 4500, 2, 0.28, 0.001, 0.025);
	// Crisp mid-body
	filteredNoise('bandpass', 2500, 3, 0.18, 0.001, 0.03);
	// Felt thud
	filteredNoise('lowpass', 350, 0.7, 0.08, 0.003, 0.03, 0.008);
}

/** Card being flipped / turned over — sharp snap + whoosh */
export function playCardFlip() {
	// Sharp snap transient
	filteredNoise('highpass', 4000, 2, 0.30, 0.001, 0.03);
	// Paper body
	filteredNoise('bandpass', 2200, 2.5, 0.16, 0.001, 0.04);
	// Quick whoosh
	filteredNoise('bandpass', 1000, 0.8, 0.06, 0.005, 0.04, 0.008);
	// Table tap
	filteredNoise('lowpass', 400, 0.7, 0.06, 0.002, 0.025, 0.025);
}

/** Rapid riffle shuffle of a deck */
export function playCardShuffle() {
	const count = 12 + Math.floor(Math.random() * 5);
	for (let i = 0; i < count; i++) {
		const t = i * (0.022 + Math.random() * 0.012);
		const vol = 0.08 + Math.random() * 0.04;
		filteredNoise('highpass', 3000 + Math.random() * 1500, 1.2, vol, 0.001, 0.02, t);
		filteredNoise('bandpass', 1400 + Math.random() * 600, 2, vol * 0.5, 0.002, 0.025, t);
	}
	// Final "thump" of squaring the deck
	const end = count * 0.034;
	filteredNoise('lowpass', 400, 0.7, 0.08, 0.003, 0.05, end);
	filteredNoise('bandpass', 1200, 1.5, 0.06, 0.002, 0.03, end);
}

// ── DICE SOUNDS ──

/** Dice tumbling and bouncing on felt/wood */
export function playDiceRoll() {
	const impacts = 8 + Math.floor(Math.random() * 3);
	let t = 0;
	for (let i = 0; i < impacts; i++) {
		const vol = 0.15 * Math.pow(0.72, i);
		const gap = (0.055 + Math.random() * 0.025) * Math.pow(0.82, i);
		// Hard clack
		filteredNoise('bandpass', 1800 + Math.random() * 1500, 3.5, vol, 0.001, 0.028, t);
		// Low surface thud
		filteredNoise('lowpass', 400 + Math.random() * 200, 1, vol * 0.5, 0.002, 0.035, t);
		// High click transient
		filteredNoise('highpass', 4500, 2, vol * 0.4, 0.001, 0.012, t);
		// Rattle between impacts
		if (i < impacts - 2) {
			filteredNoise('bandpass', 3000 + Math.random() * 1000, 3, vol * 0.15, 0.003, gap * 0.4, t + 0.012);
		}
		t += gap;
	}
	// Final settle tap
	filteredNoise('bandpass', 1500, 2.5, 0.03, 0.001, 0.018, t);
	filteredNoise('lowpass', 300, 1, 0.02, 0.002, 0.02, t);
}

/** Dice rattling in a bowl/cup (Sicbo style) */
export function playDiceShake() {
	const shakes = 14 + Math.floor(Math.random() * 6);
	for (let i = 0; i < shakes; i++) {
		const t = i * (0.035 + Math.random() * 0.025);
		const vol = 0.07 + Math.random() * 0.05;
		filteredNoise('bandpass', 2000 + Math.random() * 2000, 3, vol, 0.001, 0.025, t);
		filteredNoise('highpass', 3500, 2, vol * 0.3, 0.001, 0.015, t);
		// Bowl/cup resonance
		envTone(600 + Math.random() * 200, 'sine', vol * 0.15, 0.002, 0.03, t);
	}
}

// ── COIN SOUND ──

/** Coin being flipped: metallic ting, spinning AM modulation, landing clink */
export function playCoinFlip() {
	const c = getCtx();
	if (!c) return;
	const now = c.currentTime;

	// Initial thumb flick - metallic "ting" with non-harmonic partials
	const partials = [1800, 4860, 7900];
	partials.forEach(f => {
		envTone(f + Math.random() * 40, 'sine', 0.05, 0.001, 0.12);
	});
	filteredNoise('highpass', 6000, 1, 0.04, 0.001, 0.02);

	// Spinning coin - AM modulated metallic ring (whirring sound)
	const carrier = c.createOscillator();
	carrier.type = 'sine';
	carrier.frequency.value = 2400;
	const lfo = c.createOscillator();
	lfo.type = 'sine';
	lfo.frequency.setValueAtTime(22, now + 0.06);
	lfo.frequency.exponentialRampToValueAtTime(5, now + 0.55);
	const lfoGain = c.createGain();
	lfoGain.gain.value = 0.5;
	lfo.connect(lfoGain);
	const ampMod = c.createGain();
	ampMod.gain.value = 0.5;
	lfoGain.connect(ampMod.gain);
	carrier.connect(ampMod);
	const envG = c.createGain();
	ampMod.connect(envG);
	envG.connect(c.destination);
	envG.gain.setValueAtTime(0.001, now);
	envG.gain.linearRampToValueAtTime(0.035, now + 0.08);
	envG.gain.setValueAtTime(0.035, now + 0.35);
	envG.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
	carrier.start(now + 0.06);
	lfo.start(now + 0.06);
	carrier.stop(now + 0.6);
	lfo.stop(now + 0.6);

	// Landing clink + small bounce
	const landT = 0.50;
	partials.forEach(f => {
		envTone(f * 0.85 + Math.random() * 30, 'sine', 0.07, 0.001, 0.08, landT);
	});
	filteredNoise('highpass', 5000, 1.5, 0.06, 0.001, 0.025, landT);
	// Second smaller bounce
	partials.forEach(f => {
		envTone(f * 0.7, 'sine', 0.03, 0.001, 0.04, landT + 0.07);
	});
	filteredNoise('highpass', 4000, 1, 0.03, 0.001, 0.015, landT + 0.07);
}

// ── CHIP / BET SOUND ──

/** Poker chip placed on felt table */
export function playBet() {
	// Sharp ceramic click
	filteredNoise('bandpass', 3500, 4, 0.14, 0.001, 0.025);
	filteredNoise('highpass', 5500, 1.5, 0.07, 0.001, 0.018);
	// Ceramic ring
	metalTone([4200, 6800, 9500], 0.025, 0.06);
	// Felt absorption thud
	filteredNoise('lowpass', 350, 0.8, 0.05, 0.003, 0.035);
}

// ── UI SOUNDS ──

export function playClick() {
	filteredNoise('bandpass', 4000, 3, 0.08, 0.001, 0.02);
	envTone(1000, 'sine', 0.03, 0.001, 0.03);
}

export function playTick() {
	filteredNoise('highpass', 5000, 2, 0.06, 0.001, 0.012);
	envTone(2500, 'square', 0.02, 0.001, 0.008);
}

// ── WIN / LOSE ──

/** Ascending coin cascade for wins */
export function playWin() {
	const notes = [523, 659, 784, 1047];
	notes.forEach((f, i) => {
		const t = i * 0.1;
		envTone(f, 'sine', 0.10, 0.002, 0.28, t);
		envTone(f * 2.7, 'sine', 0.025, 0.001, 0.14, t);
		filteredNoise('highpass', 5000, 1.5, 0.03, 0.001, 0.02, t);
	});
}

/** Sad descending tone for losses */
export function playLose() {
	envTone(350, 'triangle', 0.06, 0.008, 0.3);
	envTone(250, 'triangle', 0.04, 0.008, 0.35, 0.12);
	filteredNoise('lowpass', 500, 0.5, 0.025, 0.008, 0.25);
}

/** Fanfare + cascading coins for big wins */
export function playBigWin() {
	const fanfare = [523, 659, 784, 1047, 784, 1047, 1319];
	fanfare.forEach((f, i) => {
		const t = i * 0.1;
		envTone(f, 'sine', 0.12, 0.002, 0.35, t);
		envTone(f * 1.5, 'sine', 0.035, 0.002, 0.18, t);
		envTone(f * 2.7, 'sine', 0.02, 0.001, 0.12, t);
	});
	// Coin rain
	for (let i = 0; i < 14; i++) {
		const t = 0.3 + i * 0.055;
		metalTone([3000 + Math.random() * 3000, 5000 + Math.random() * 2000], 0.035, 0.06, t);
		filteredNoise('highpass', 5000, 2, 0.025, 0.001, 0.015, t);
	}
}

// ── GAME-SPECIFIC ──

/** Rising suspense tone with rumble underneath */
export function playSuspense() {
	const c = getCtx();
	if (!c) return;
	const now = c.currentTime;
	const osc = c.createOscillator();
	osc.type = 'sine';
	osc.frequency.setValueAtTime(200, now);
	osc.frequency.exponentialRampToValueAtTime(500, now + 1.0);
	const g = c.createGain();
	osc.connect(g);
	g.connect(c.destination);
	g.gain.setValueAtTime(0.001, now);
	g.gain.linearRampToValueAtTime(0.08, now + 0.7);
	g.gain.exponentialRampToValueAtTime(0.001, now + 1.05);
	osc.start(now);
	osc.stop(now + 1.1);
	// Rumble layer
	filteredNoise('lowpass', 200, 0.8, 0.025, 0.08, 0.85);
}

/** Quick "ta-da" reveal sting */
export function playReveal() {
	filteredNoise('highpass', 3000, 1.2, 0.10, 0.002, 0.035);
	envTone(800, 'sine', 0.08, 0.002, 0.10);
	envTone(1200, 'sine', 0.06, 0.002, 0.08, 0.035);
}

/** Coins being collected / cashed out */
export function playCashout() {
	for (let i = 0; i < 7; i++) {
		const t = i * 0.055;
		metalTone([2500 + Math.random() * 2000, 5000 + Math.random() * 1500], 0.05, 0.07, t);
		filteredNoise('highpass', 4000, 2, 0.035, 0.001, 0.018, t);
	}
}

/** Whooshing spin sound */
export function playSpin() {
	const c = getCtx();
	if (!c) return;
	const now = c.currentTime;
	const noise = createNoise(c, 0.5);
	const filter = c.createBiquadFilter();
	filter.type = 'bandpass';
	filter.frequency.setValueAtTime(500, now);
	filter.frequency.exponentialRampToValueAtTime(3000, now + 0.2);
	filter.frequency.exponentialRampToValueAtTime(500, now + 0.45);
	filter.Q.value = 1;
	const g = c.createGain();
	noise.connect(filter);
	filter.connect(g);
	g.connect(c.destination);
	g.gain.setValueAtTime(0.001, now);
	g.gain.linearRampToValueAtTime(0.08, now + 0.03);
	g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
	noise.start(now);
	noise.stop(now + 0.5);
}

/** Ball/object hitting a peg or surface */
export function playBounce() {
	const f = 500 + Math.random() * 300;
	filteredNoise('bandpass', 2000 + Math.random() * 1000, 3, 0.10, 0.001, 0.028);
	envTone(f, 'triangle', 0.07, 0.001, 0.035);
	filteredNoise('lowpass', 500, 0.8, 0.04, 0.002, 0.025);
}

/** Wheel flapper clicking past a peg */
export function playWheelTick() {
	filteredNoise('highpass', 4500, 3, 0.08, 0.001, 0.010);
	envTone(2200, 'square', 0.025, 0.001, 0.006);
}

/** Scratch card scratching surface — soft gritty texture */
export function playScratch() {
	// Low gritty layer (coin on cardboard)
	filteredNoise('bandpass', 800 + Math.random() * 400, 1.5, 0.04, 0.003, 0.05);
	// Mid texture layer
	filteredNoise('bandpass', 1800 + Math.random() * 600, 2, 0.03, 0.002, 0.04);
	// Soft high-freq sparkle
	filteredNoise('highpass', 3500, 1, 0.015, 0.001, 0.03);
}

/** Low boom with debris for crash/explosion */
export function playExplosion() {
	filteredNoise('lowpass', 200, 0.5, 0.15, 0.004, 0.4);
	filteredNoise('bandpass', 500, 1, 0.10, 0.004, 0.3);
	envTone(60, 'sine', 0.12, 0.004, 0.5);
	envTone(40, 'sine', 0.07, 0.008, 0.6, 0.04);
	for (let i = 0; i < 5; i++) {
		filteredNoise('highpass', 2000 + Math.random() * 3000, 2, 0.04, 0.001, 0.04, 0.02 + i * 0.04);
	}
}

// ── SLOT MACHINE ──

/** Slot reel spinning: distinct "tok tok tok" clicking that decelerates. Returns stop(). */
export function playSlotSpin(dur = 6.0): () => void {
	const c = getCtx();
	if (!c) return () => {};
	const now = c.currentTime;
	const master = c.createGain();
	master.connect(c.destination);
	master.gain.setValueAtTime(1, now);

	// Exponentially decelerating rate: 12 taps/sec → 3 taps/sec
	const startRate = 12;
	const endRate = 3;
	const k = Math.log(startRate / endRate) / dur;

	let t = 0;
	while (t < dur) {
		const rate = startRate * Math.exp(-k * t);
		const tokTime = now + t;
		const tokDur = 0.012;

		// Short bandpass noise burst = the "tok" click
		const noise = createNoise(c, tokDur + 0.01);
		const filter = c.createBiquadFilter();
		filter.type = 'bandpass';
		filter.frequency.value = 2200 + Math.random() * 800;
		filter.Q.value = 5;
		const g = c.createGain();
		g.gain.setValueAtTime(0.001, tokTime);
		g.gain.linearRampToValueAtTime(0.15, tokTime + 0.001);
		g.gain.exponentialRampToValueAtTime(0.001, tokTime + tokDur);
		noise.connect(filter);
		filter.connect(g);
		g.connect(master);
		noise.start(tokTime);
		noise.stop(tokTime + tokDur + 0.01);

		// Short sine ping for crisp "click" character
		const osc = c.createOscillator();
		osc.type = 'sine';
		osc.frequency.value = 700 + Math.random() * 200;
		const og = c.createGain();
		og.gain.setValueAtTime(0.001, tokTime);
		og.gain.linearRampToValueAtTime(0.06, tokTime + 0.001);
		og.gain.exponentialRampToValueAtTime(0.001, tokTime + 0.008);
		osc.connect(og);
		og.connect(master);
		osc.start(tokTime);
		osc.stop(tokTime + 0.01);

		t += 1 / rate;
	}

	return () => {
		const ct = c.currentTime;
		master.gain.cancelScheduledValues(ct);
		master.gain.setValueAtTime(master.gain.value, ct);
		master.gain.exponentialRampToValueAtTime(0.001, ct + 0.1);
	};
}

/** Mechanical reel stop thunk */
export function playReelStop() {
	filteredNoise('bandpass', 800, 2, 0.12, 0.001, 0.05);
	filteredNoise('lowpass', 200, 1, 0.10, 0.002, 0.06);
	envTone(120, 'square', 0.07, 0.001, 0.04);
	// Metal latch click
	filteredNoise('highpass', 4000, 3, 0.06, 0.001, 0.015, 0.01);
}

/** Chip tossed onto felt table — whoosh + landing clatter */
export function playChipToss() {
	// Brief whoosh
	filteredNoise('bandpass', 1200, 0.8, 0.05, 0.002, 0.06);
	// Chip landing ceramic clink
	filteredNoise('bandpass', 3800, 4, 0.12, 0.001, 0.02, 0.05);
	filteredNoise('highpass', 5500, 1.5, 0.06, 0.001, 0.015, 0.05);
	metalTone([4500, 7200], 0.025, 0.05, 0.05);
	// Felt absorption
	filteredNoise('lowpass', 350, 0.7, 0.05, 0.003, 0.03, 0.06);
}

/** Roulette ball clicking on wheel track */
export function playBallClick() {
	filteredNoise('bandpass', 3000, 4, 0.07, 0.001, 0.015);
	envTone(1800, 'sine', 0.03, 0.001, 0.01);
}

/** Long rising suspense build (for dramatic reveals) */
export function playSuspenseLong() {
	const c = getCtx();
	if (!c) return;
	const now = c.currentTime;

	// Rising sine
	const osc = c.createOscillator();
	osc.type = 'sine';
	osc.frequency.setValueAtTime(150, now);
	osc.frequency.exponentialRampToValueAtTime(600, now + 1.8);
	const g = c.createGain();
	osc.connect(g);
	g.connect(c.destination);
	g.gain.setValueAtTime(0.001, now);
	g.gain.linearRampToValueAtTime(0.10, now + 1.4);
	g.gain.exponentialRampToValueAtTime(0.001, now + 1.85);
	osc.start(now);
	osc.stop(now + 1.9);

	// Low rumble
	filteredNoise('lowpass', 150, 0.7, 0.03, 0.1, 1.6);

	// Accelerating ticks
	for (let i = 0; i < 12; i++) {
		const t = 0.3 + i * (0.12 - i * 0.007);
		if (t > 1.6) break;
		filteredNoise('highpass', 4000, 2, 0.03 + i * 0.003, 0.001, 0.01, t);
	}
}

/** Heartbeat-like thump for tension moments */
export function playHeartbeat() {
	// First beat (louder)
	envTone(55, 'sine', 0.10, 0.005, 0.12);
	filteredNoise('lowpass', 120, 0.5, 0.06, 0.003, 0.08);
	// Second beat (softer, slightly delayed)
	envTone(50, 'sine', 0.07, 0.005, 0.10, 0.15);
	filteredNoise('lowpass', 100, 0.5, 0.04, 0.003, 0.06, 0.15);
}

/** Dramatic reveal sting (bigger than playReveal) */
export function playRevealBig() {
	// Impact
	filteredNoise('highpass', 2500, 1.5, 0.14, 0.002, 0.04);
	filteredNoise('bandpass', 1200, 1, 0.08, 0.003, 0.06);
	// Rising sting
	envTone(600, 'sine', 0.10, 0.002, 0.15);
	envTone(900, 'sine', 0.08, 0.002, 0.12, 0.03);
	envTone(1200, 'sine', 0.06, 0.002, 0.10, 0.06);
	// Shimmer
	metalTone([3000, 5000, 7000], 0.025, 0.1, 0.05);
}
