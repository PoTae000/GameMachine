// Slot symbols with escalating effects — bigger prize = more effects
export const SYMBOL_SVGS: Record<string, string> = {

	// Tier 1: Common — minimal effect
	cherry: `<span class="sym sym-t1">🪙</span>`,
	lemon: `<span class="sym sym-t1">💵</span>`,

	// Tier 2: Uncommon — subtle glow
	orange: `<span class="sym sym-t2">💳</span>`,
	grape: `<span class="sym sym-t2">💲</span>`,

	// Tier 3: Rare — shine sweep + glow
	bell: `<span class="sym sym-t3">🏦<span class="sym-shine"></span></span>`,
	diamond: `<span class="sym sym-t3">💎<span class="sym-shine"></span></span>`,

	// Tier 4: Epic — strong glow + sparkles + pulse
	seven: `<span class="sym sym-t4">💰<span class="sym-shine"></span><span class="sym-sparkle"></span></span>`,
	star: `<span class="sym sym-t4 sym-crown">🤑<span class="sym-shine"></span><span class="sym-sparkle"></span><span class="sym-sparkle s2"></span></span>`,

	// Scatter: Special — crown with rainbow glow + pulse + sparkles
	scatter: `<span class="sym sym-scatter">👑<span class="sym-shine"></span><span class="sym-sparkle"></span><span class="sym-sparkle s2"></span><span class="sym-sparkle s3"></span></span>`
};
