// SVG Coin Renderer - Realistic minted coin style

export function renderCoinHeads(size = 128): string {
	const r = size / 2 - 1;
	const cx = size / 2;
	const cy = size / 2;
	const rimW = r * 0.1;
	const faceR = r - rimW;
	const deco = faceR * 0.88;

	// Serration marks around the edge
	let serrations = '';
	const serrCount = Math.round(size * 0.6);
	for (let i = 0; i < serrCount; i++) {
		const angle = (i / serrCount) * Math.PI * 2;
		const x1 = cx + Math.cos(angle) * (r * 0.97);
		const y1 = cy + Math.sin(angle) * (r * 0.97);
		const x2 = cx + Math.cos(angle) * r;
		const y2 = cy + Math.sin(angle) * r;
		serrations += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(120,60,0,0.2)" stroke-width="${size * 0.004}"/>`;
	}

	// Concentric texture lines on face
	let textureLines = '';
	for (let i = 1; i <= 6; i++) {
		const tr = faceR * (0.3 + i * 0.1);
		textureLines += `<circle cx="${cx}" cy="${cy}" r="${tr}" fill="none" stroke="rgba(139,105,20,0.06)" stroke-width="${size * 0.002}"/>`;
	}

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="hrim_${size}" x1="10%" y1="5%" x2="90%" y2="95%">
      <stop offset="0%" stop-color="#e6c44a"/>
      <stop offset="15%" stop-color="#c9a030"/>
      <stop offset="30%" stop-color="#ddb840"/>
      <stop offset="50%" stop-color="#8e6b18"/>
      <stop offset="70%" stop-color="#c9a030"/>
      <stop offset="85%" stop-color="#ddb840"/>
      <stop offset="100%" stop-color="#a68020"/>
    </linearGradient>
    <radialGradient id="hface_${size}" cx="40%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#f2df8a"/>
      <stop offset="20%" stop-color="#dfc050"/>
      <stop offset="50%" stop-color="#c9a030"/>
      <stop offset="80%" stop-color="#a68020"/>
      <stop offset="100%" stop-color="#8e6b18"/>
    </radialGradient>
    <radialGradient id="hshine_${size}" cx="32%" cy="28%">
      <stop offset="0%" stop-color="rgba(255,255,240,0.28)"/>
      <stop offset="40%" stop-color="rgba(255,255,220,0.08)"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <radialGradient id="hdepth_${size}" cx="50%" cy="50%">
      <stop offset="0%" stop-color="transparent"/>
      <stop offset="75%" stop-color="transparent"/>
      <stop offset="100%" stop-color="rgba(60,35,0,0.18)"/>
    </radialGradient>
    <linearGradient id="hbevel_${size}" x1="30%" y1="10%" x2="70%" y2="90%">
      <stop offset="0%" stop-color="rgba(255,240,180,0.4)"/>
      <stop offset="50%" stop-color="transparent"/>
      <stop offset="100%" stop-color="rgba(80,50,0,0.3)"/>
    </linearGradient>
  </defs>

  <!-- Outer rim with metallic gradient -->
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#hrim_${size})"/>

  <!-- Edge serrations -->
  ${serrations}

  <!-- Rim bevel highlight -->
  <circle cx="${cx}" cy="${cy}" r="${r * 0.96}" fill="none" stroke="url(#hbevel_${size})" stroke-width="${rimW * 0.6}"/>

  <!-- Inner rim edge (raised border) -->
  <circle cx="${cx}" cy="${cy}" r="${faceR + rimW * 0.15}" fill="none" stroke="rgba(100,65,10,0.3)" stroke-width="${size * 0.005}"/>
  <circle cx="${cx}" cy="${cy}" r="${faceR}" fill="none" stroke="rgba(180,140,40,0.3)" stroke-width="${size * 0.004}"/>

  <!-- Main face -->
  <circle cx="${cx}" cy="${cy}" r="${faceR}" fill="url(#hface_${size})"/>

  <!-- Texture lines -->
  ${textureLines}

  <!-- Decorative inner ring -->
  <circle cx="${cx}" cy="${cy}" r="${deco}" fill="none" stroke="rgba(139,105,20,0.18)" stroke-width="${size * 0.006}"/>
  <circle cx="${cx}" cy="${cy}" r="${deco * 0.97}" fill="none" stroke="rgba(139,105,20,0.1)" stroke-width="${size * 0.003}"/>

  <!-- Central Baht symbol -->
  <text x="${cx}" y="${cy * 0.88}" font-family="Georgia, 'Times New Roman', serif" font-size="${size * 0.35}" font-weight="bold" fill="rgba(120,70,10,0.5)" text-anchor="middle" dominant-baseline="central">฿</text>

  <!-- Small decorative dots around inner ring -->
  <circle cx="${cx}" cy="${cy - deco * 0.76}" r="${size * 0.008}" fill="rgba(139,105,20,0.25)"/>
  <circle cx="${cx}" cy="${cy + deco * 0.76}" r="${size * 0.008}" fill="rgba(139,105,20,0.25)"/>
  <circle cx="${cx - deco * 0.76}" cy="${cy}" r="${size * 0.008}" fill="rgba(139,105,20,0.25)"/>
  <circle cx="${cx + deco * 0.76}" cy="${cy}" r="${size * 0.008}" fill="rgba(139,105,20,0.25)"/>

  <!-- Bottom text -->
  <text x="${cx}" y="${cy + faceR * 0.7}" font-family="Arial, sans-serif" font-size="${size * 0.07}" font-weight="700" fill="rgba(120,70,10,0.35)" text-anchor="middle" letter-spacing="${size * 0.02}">HEADS</text>

  <!-- Shine overlay -->
  <circle cx="${cx}" cy="${cy}" r="${faceR}" fill="url(#hshine_${size})"/>

  <!-- Depth shadow -->
  <circle cx="${cx}" cy="${cy}" r="${faceR}" fill="url(#hdepth_${size})"/>

  <!-- Top highlight arc -->
  <path d="M${cx - r * 0.55},${cy - r * 0.7} A${r * 0.88},${r * 0.88} 0 0,1 ${cx + r * 0.55},${cy - r * 0.7}" fill="none" stroke="rgba(255,255,230,0.15)" stroke-width="${size * 0.01}" stroke-linecap="round"/>
</svg>`;
}

export function renderCoinTails(size = 128): string {
	const r = size / 2 - 1;
	const cx = size / 2;
	const cy = size / 2;
	const rimW = r * 0.1;
	const faceR = r - rimW;
	const deco = faceR * 0.88;

	// Serration marks
	let serrations = '';
	const serrCount = Math.round(size * 0.6);
	for (let i = 0; i < serrCount; i++) {
		const angle = (i / serrCount) * Math.PI * 2;
		const x1 = cx + Math.cos(angle) * (r * 0.97);
		const y1 = cy + Math.sin(angle) * (r * 0.97);
		const x2 = cx + Math.cos(angle) * r;
		const y2 = cy + Math.sin(angle) * r;
		serrations += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(20,40,60,0.2)" stroke-width="${size * 0.004}"/>`;
	}

	// Concentric texture lines
	let textureLines = '';
	for (let i = 1; i <= 6; i++) {
		const tr = faceR * (0.3 + i * 0.1);
		textureLines += `<circle cx="${cx}" cy="${cy}" r="${tr}" fill="none" stroke="rgba(100,120,140,0.06)" stroke-width="${size * 0.002}"/>`;
	}

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="trim_${size}" x1="10%" y1="5%" x2="90%" y2="95%">
      <stop offset="0%" stop-color="#b0bec5"/>
      <stop offset="15%" stop-color="#78909c"/>
      <stop offset="30%" stop-color="#b0bec5"/>
      <stop offset="50%" stop-color="#455a64"/>
      <stop offset="70%" stop-color="#78909c"/>
      <stop offset="85%" stop-color="#b0bec5"/>
      <stop offset="100%" stop-color="#607d8b"/>
    </linearGradient>
    <radialGradient id="tface_${size}" cx="40%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#cfd8dc"/>
      <stop offset="20%" stop-color="#a8b8c0"/>
      <stop offset="50%" stop-color="#829aa8"/>
      <stop offset="80%" stop-color="#607d8b"/>
      <stop offset="100%" stop-color="#455a64"/>
    </radialGradient>
    <radialGradient id="tshine_${size}" cx="32%" cy="28%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.22)"/>
      <stop offset="40%" stop-color="rgba(255,255,255,0.06)"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <radialGradient id="tdepth_${size}" cx="50%" cy="50%">
      <stop offset="0%" stop-color="transparent"/>
      <stop offset="75%" stop-color="transparent"/>
      <stop offset="100%" stop-color="rgba(20,30,40,0.2)"/>
    </radialGradient>
    <linearGradient id="tbevel_${size}" x1="30%" y1="10%" x2="70%" y2="90%">
      <stop offset="0%" stop-color="rgba(200,220,240,0.35)"/>
      <stop offset="50%" stop-color="transparent"/>
      <stop offset="100%" stop-color="rgba(20,40,60,0.3)"/>
    </linearGradient>
  </defs>

  <!-- Outer rim -->
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#trim_${size})"/>

  <!-- Edge serrations -->
  ${serrations}

  <!-- Rim bevel -->
  <circle cx="${cx}" cy="${cy}" r="${r * 0.96}" fill="none" stroke="url(#tbevel_${size})" stroke-width="${rimW * 0.6}"/>

  <!-- Inner rim edges -->
  <circle cx="${cx}" cy="${cy}" r="${faceR + rimW * 0.15}" fill="none" stroke="rgba(50,70,90,0.3)" stroke-width="${size * 0.005}"/>
  <circle cx="${cx}" cy="${cy}" r="${faceR}" fill="none" stroke="rgba(150,170,190,0.3)" stroke-width="${size * 0.004}"/>

  <!-- Main face -->
  <circle cx="${cx}" cy="${cy}" r="${faceR}" fill="url(#tface_${size})"/>

  <!-- Texture lines -->
  ${textureLines}

  <!-- Decorative inner ring -->
  <circle cx="${cx}" cy="${cy}" r="${deco}" fill="none" stroke="rgba(80,100,120,0.18)" stroke-width="${size * 0.006}"/>
  <circle cx="${cx}" cy="${cy}" r="${deco * 0.97}" fill="none" stroke="rgba(80,100,120,0.1)" stroke-width="${size * 0.003}"/>

  <!-- Central number -->
  <text x="${cx}" y="${cy * 0.88}" font-family="Georgia, 'Times New Roman', serif" font-size="${size * 0.35}" font-weight="bold" fill="rgba(200,220,240,0.4)" text-anchor="middle" dominant-baseline="central">1</text>

  <!-- Decorative dots -->
  <circle cx="${cx}" cy="${cy - deco * 0.76}" r="${size * 0.008}" fill="rgba(80,100,120,0.25)"/>
  <circle cx="${cx}" cy="${cy + deco * 0.76}" r="${size * 0.008}" fill="rgba(80,100,120,0.25)"/>
  <circle cx="${cx - deco * 0.76}" cy="${cy}" r="${size * 0.008}" fill="rgba(80,100,120,0.25)"/>
  <circle cx="${cx + deco * 0.76}" cy="${cy}" r="${size * 0.008}" fill="rgba(80,100,120,0.25)"/>

  <!-- Bottom text -->
  <text x="${cx}" y="${cy + faceR * 0.7}" font-family="Arial, sans-serif" font-size="${size * 0.07}" font-weight="700" fill="rgba(180,200,220,0.3)" text-anchor="middle" letter-spacing="${size * 0.02}">TAILS</text>

  <!-- Shine overlay -->
  <circle cx="${cx}" cy="${cy}" r="${faceR}" fill="url(#tshine_${size})"/>

  <!-- Depth shadow -->
  <circle cx="${cx}" cy="${cy}" r="${faceR}" fill="url(#tdepth_${size})"/>

  <!-- Top highlight arc -->
  <path d="M${cx - r * 0.55},${cy - r * 0.7} A${r * 0.88},${r * 0.88} 0 0,1 ${cx + r * 0.55},${cy - r * 0.7}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="${size * 0.01}" stroke-linecap="round"/>
</svg>`;
}

export function renderCoinHeadsSmall(size = 40): string {
	return renderCoinHeads(size);
}

export function renderCoinTailsSmall(size = 40): string {
	return renderCoinTails(size);
}
