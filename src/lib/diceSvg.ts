// SVG Dice Renderer - 3D realistic dice with depth and shadows

const DOT_POSITIONS: Record<number, [number, number][]> = {
	1: [[50, 50]],
	2: [[30, 30], [70, 70]],
	3: [[30, 30], [50, 50], [70, 70]],
	4: [[30, 30], [70, 30], [30, 70], [70, 70]],
	5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
	6: [[30, 27], [70, 27], [30, 50], [70, 50], [30, 73], [70, 73]]
};

export function renderDice(value: number, size = 64): string {
	const v = Math.max(1, Math.min(6, value));
	const dots = DOT_POSITIONS[v];
	const dotR = size * 0.075;
	const rx = size * 0.12;
	const uid = `d${v}_${Math.random().toString(36).slice(2, 6)}`;

	// Face dimensions (inset for 3D edge effect)
	const edgeW = size * 0.06; // visible edge thickness
	const faceX = 2;
	const faceY = 2;
	const faceW = size - 4;
	const faceH = size - 4 - edgeW;

	const dotsSvg = dots
		.map(([x, y]) => {
			const cx = faceX + (x / 100) * faceW;
			const cy = faceY + (y / 100) * faceH;
			return `<circle cx="${cx}" cy="${cy + 1}" r="${dotR}" fill="rgba(0,0,0,0.12)"/>
  <circle cx="${cx}" cy="${cy}" r="${dotR}" fill="#1a1a1a"/>
  <circle cx="${cx - dotR * 0.25}" cy="${cy - dotR * 0.25}" r="${dotR * 0.3}" fill="rgba(255,255,255,0.15)"/>`;
		})
		.join('\n  ');

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="fg_${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="40%" stop-color="#fafafa"/>
      <stop offset="100%" stop-color="#e8e8e8"/>
    </linearGradient>
    <linearGradient id="eg_${uid}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#d4d4d4"/>
      <stop offset="100%" stop-color="#a3a3a3"/>
    </linearGradient>
    <linearGradient id="sg_${uid}" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#b0b0b0"/>
      <stop offset="100%" stop-color="#c8c8c8"/>
    </linearGradient>
    <filter id="ds_${uid}" x="-15%" y="-10%" width="130%" height="140%">
      <feDropShadow dx="1" dy="3" stdDeviation="3" flood-color="#000" flood-opacity="0.25"/>
    </filter>
  </defs>
  <!-- Drop shadow container -->
  <g filter="url(#ds_${uid})">
    <!-- Bottom edge (depth) -->
    <rect x="${faceX}" y="${faceY + edgeW}" width="${faceW}" height="${faceH}" rx="${rx}" fill="url(#eg_${uid})" stroke="#999" stroke-width="0.5"/>
    <!-- Right edge (depth) -->
    <path d="M${faceX + faceW - rx},${faceY + faceH}
             L${faceX + faceW - rx + edgeW * 0.5},${faceY + faceH + edgeW}
             Q${faceX + faceW + edgeW * 0.5},${faceY + faceH + edgeW} ${faceX + faceW + edgeW * 0.5},${faceY + faceH + edgeW - rx}
             L${faceX + faceW},${faceY + faceH - rx}
             Q${faceX + faceW},${faceY + faceH} ${faceX + faceW - rx},${faceY + faceH}Z"
          fill="url(#sg_${uid})" opacity="0.6"/>
    <!-- Top face -->
    <rect x="${faceX}" y="${faceY}" width="${faceW}" height="${faceH}" rx="${rx}" fill="url(#fg_${uid})" stroke="#ccc" stroke-width="1"/>
    <!-- Inner bevel highlight -->
    <rect x="${faceX + 3}" y="${faceY + 2}" width="${faceW - 6}" height="${faceH - 5}" rx="${rx - 2}" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="1"/>
    <!-- Inner bevel shadow -->
    <rect x="${faceX + 3}" y="${faceY + 3}" width="${faceW - 6}" height="${faceH - 5}" rx="${rx - 2}" fill="none" stroke="rgba(0,0,0,0.04)" stroke-width="0.5"/>
  </g>
  <!-- Dots with shadows -->
  ${dotsSvg}
  <!-- Specular highlight -->
  <ellipse cx="${size * 0.35}" cy="${size * 0.22}" rx="${size * 0.18}" ry="${size * 0.1}" fill="rgba(255,255,255,0.25)" transform="rotate(-15, ${size * 0.35}, ${size * 0.22})"/>
</svg>`;
}
