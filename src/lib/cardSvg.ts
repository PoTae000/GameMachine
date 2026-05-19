// SVG Card Renderer - Realistic playing cards

const SUIT_SYMBOLS: Record<string, string> = {
	hearts: '\u2665',
	diamonds: '\u2666',
	clubs: '\u2663',
	spades: '\u2660'
};

const SUIT_COLORS: Record<string, string> = {
	hearts: '#dc2626',
	diamonds: '#dc2626',
	clubs: '#18181b',
	spades: '#18181b'
};

// Pip layout positions for number cards (relative to card center area)
// Each position is [x%, y%] relative to the pip area
const PIP_LAYOUTS: Record<number, [number, number][]> = {
	1: [[50, 50]],
	2: [[50, 20], [50, 80]],
	3: [[50, 20], [50, 50], [50, 80]],
	4: [[30, 20], [70, 20], [30, 80], [70, 80]],
	5: [[30, 20], [70, 20], [50, 50], [30, 80], [70, 80]],
	6: [[30, 20], [70, 20], [30, 50], [70, 50], [30, 80], [70, 80]],
	7: [[30, 20], [70, 20], [50, 35], [30, 50], [70, 50], [30, 80], [70, 80]],
	8: [[30, 20], [70, 20], [50, 35], [30, 50], [70, 50], [50, 65], [30, 80], [70, 80]],
	9: [[30, 17], [70, 17], [30, 39], [70, 39], [50, 50], [30, 61], [70, 61], [30, 83], [70, 83]],
	10: [[30, 17], [70, 17], [50, 28], [30, 39], [70, 39], [30, 61], [70, 61], [50, 72], [30, 83], [70, 83]],
};

function rankToNum(rank: string): number {
	if (rank === 'A') return 1;
	if (rank === 'J' || rank === 'Q' || rank === 'K') return 0;
	return parseInt(rank) || 0;
}

function renderPips(suit: string, rank: string, w: number, h: number, color: string): string {
	const num = rankToNum(rank);
	if (num === 0) return ''; // face cards handled separately
	const symbol = SUIT_SYMBOLS[suit] || '?';
	const positions = PIP_LAYOUTS[num];
	if (!positions) return '';

	// Pip area: inset from edges
	const areaX = w * 0.18;
	const areaY = h * 0.22;
	const areaW = w * 0.64;
	const areaH = h * 0.56;
	const pipSize = Math.max(Math.floor(w * 0.2), 8);

	return positions.map(([px, py]) => {
		const x = areaX + areaW * px / 100;
		const y = areaY + areaH * py / 100;
		return `<text x="${x}" y="${y}" font-family="serif" font-size="${pipSize}" fill="${color}" text-anchor="middle" dominant-baseline="central">${symbol}</text>`;
	}).join('\n  ');
}

function renderFaceCard(rank: string, suit: string, w: number, h: number, color: string): string {
	const symbol = SUIT_SYMBOLS[suit] || '?';
	const letterSize = Math.floor(w * 0.38);
	const suitSize = Math.floor(w * 0.18);

	// Adjust Y offset — J has descender, shift up slightly
	const yOffset = rank === 'J' ? h * 0.45 : h * 0.48;

	return `
  <text x="${w * 0.5}" y="${yOffset}" font-family="'Segoe UI', Arial, Helvetica, sans-serif" font-size="${letterSize}" font-weight="bold" fill="${color}" text-anchor="middle" dominant-baseline="central" opacity="0.9">${rank}</text>
  <text x="${w * 0.5}" y="${h * 0.68}" font-family="serif" font-size="${suitSize}" fill="${color}" text-anchor="middle" dominant-baseline="central">${symbol}</text>
  <line x1="${w * 0.2}" y1="${h * 0.25}" x2="${w * 0.8}" y2="${h * 0.25}" stroke="${color}" stroke-width="0.5" opacity="0.2"/>
  <line x1="${w * 0.2}" y1="${h * 0.75}" x2="${w * 0.8}" y2="${h * 0.75}" stroke="${color}" stroke-width="0.5" opacity="0.2"/>`;
}

export function renderCard(suit: string, rank: string, width = 56, height = 80): string {
	const symbol = SUIT_SYMBOLS[suit] || '?';
	const color = SUIT_COLORS[suit] || '#18181b';
	const rx = Math.max(Math.floor(width * 0.07), 3);
	const cornerRankSize = Math.max(Math.floor(width * 0.2), 8);
	const cornerSuitSize = Math.max(Math.floor(width * 0.16), 7);

	const isFace = rank === 'J' || rank === 'Q' || rank === 'K';
	const isAce = rank === 'A';

	let centerContent = '';
	if (isFace) {
		centerContent = renderFaceCard(rank, suit, width, height, color);
	} else if (isAce) {
		const aceSize = Math.floor(width * 0.45);
		centerContent = `<text x="${width * 0.5}" y="${height * 0.52}" font-family="serif" font-size="${aceSize}" fill="${color}" text-anchor="middle" dominant-baseline="central">${symbol}</text>`;
	} else {
		centerContent = renderPips(suit, rank, width, height, color);
	}

	return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="cg_${width}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f3f4f6"/>
    </linearGradient>
    <filter id="cs_${width}" x="-4%" y="-2%" width="108%" height="108%">
      <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#000" flood-opacity="0.18"/>
    </filter>
  </defs>
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="${rx}" fill="url(#cg_${width})" stroke="#d1d5db" stroke-width="0.8" filter="url(#cs_${width})"/>
  <rect x="2.5" y="2.5" width="${width - 5}" height="${height - 5}" rx="${rx - 1}" fill="none" stroke="#e5e7eb" stroke-width="0.3"/>
  <text x="${width * 0.14}" y="${height * 0.16}" font-family="Georgia, 'Times New Roman', serif" font-size="${cornerRankSize}" font-weight="bold" fill="${color}" text-anchor="middle">${rank}</text>
  <text x="${width * 0.14}" y="${height * 0.16 + cornerSuitSize * 0.9}" font-family="serif" font-size="${cornerSuitSize}" fill="${color}" text-anchor="middle">${symbol}</text>
  ${centerContent}
  <g transform="rotate(180, ${width * 0.5}, ${height * 0.5})">
    <text x="${width * 0.14}" y="${height * 0.16}" font-family="Georgia, 'Times New Roman', serif" font-size="${cornerRankSize}" font-weight="bold" fill="${color}" text-anchor="middle">${rank}</text>
    <text x="${width * 0.14}" y="${height * 0.16 + cornerSuitSize * 0.9}" font-family="serif" font-size="${cornerSuitSize}" fill="${color}" text-anchor="middle">${symbol}</text>
  </g>
</svg>`;
}

export function renderCardBack(width = 56, height = 80): string {
	const rx = Math.max(Math.floor(width * 0.07), 3);
	const inset = Math.max(Math.floor(width * 0.08), 3);
	return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="cbg_${width}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7c3aed"/>
      <stop offset="50%" stop-color="#6d28d9"/>
      <stop offset="100%" stop-color="#4c1d95"/>
    </linearGradient>
    <pattern id="cbp_${width}" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.06)" stroke-width="1.5"/>
    </pattern>
    <pattern id="cbp2_${width}" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(-45)">
      <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.06)" stroke-width="1.5"/>
    </pattern>
    <filter id="cbs_${width}" x="-4%" y="-2%" width="108%" height="108%">
      <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#000" flood-opacity="0.22"/>
    </filter>
  </defs>
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="${rx}" fill="url(#cbg_${width})" stroke="#a78bfa" stroke-width="0.8" filter="url(#cbs_${width})"/>
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="${rx}" fill="url(#cbp_${width})"/>
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="${rx}" fill="url(#cbp2_${width})"/>
  <rect x="${inset}" y="${inset}" width="${width - inset * 2}" height="${height - inset * 2}" rx="${rx - 1}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="0.8"/>
  <rect x="${inset + 2}" y="${inset + 2}" width="${width - inset * 2 - 4}" height="${height - inset * 2 - 4}" rx="${rx - 2}" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.06)" stroke-width="0.5"/>
</svg>`;
}
