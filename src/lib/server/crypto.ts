// Password hashing using PBKDF2 (Web Crypto API, available in Cloudflare Workers)

const ITERATIONS = 100000;
const KEY_LENGTH = 32;
const ALGORITHM = 'PBKDF2';
const HASH = 'SHA-256';

function toBase64(buffer: ArrayBuffer): string {
	return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function fromBase64(str: string): Uint8Array {
	return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

export async function hashPassword(password: string): Promise<string> {
	const salt = new Uint8Array(16);
	crypto.getRandomValues(salt);

	const encoder = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey(
		'raw', encoder.encode(password), ALGORITHM, false, ['deriveBits']
	);

	const derivedBits = await crypto.subtle.deriveBits(
		{ name: ALGORITHM, salt, iterations: ITERATIONS, hash: HASH },
		keyMaterial,
		KEY_LENGTH * 8
	);

	const saltB64 = toBase64(salt.buffer as ArrayBuffer);
	const hashB64 = toBase64(derivedBits);
	return `pbkdf2:${ITERATIONS}:${saltB64}:${hashB64}`;
}

function timingSafeEqual(a: string, b: string): boolean {
	const encoder = new TextEncoder();
	const aBuf = encoder.encode(a);
	const bBuf = encoder.encode(b);
	if (aBuf.length !== bBuf.length) {
		// Compare against self to maintain constant time, then return false
		const dummy = new Uint8Array(aBuf.length);
		let result = 0;
		for (let i = 0; i < aBuf.length; i++) {
			result |= aBuf[i] ^ dummy[i];
		}
		return false;
	}
	let result = 0;
	for (let i = 0; i < aBuf.length; i++) {
		result |= aBuf[i] ^ bBuf[i];
	}
	return result === 0;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	// Handle legacy plaintext passwords (no "pbkdf2:" prefix)
	if (!stored.startsWith('pbkdf2:')) {
		return timingSafeEqual(password, stored);
	}

	const parts = stored.split(':');
	if (parts.length !== 4) return false;

	const iterations = parseInt(parts[1], 10);
	const salt = fromBase64(parts[2]);
	const expectedHash = parts[3];

	const encoder = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey(
		'raw', encoder.encode(password), ALGORITHM, false, ['deriveBits']
	);

	const derivedBits = await crypto.subtle.deriveBits(
		{ name: ALGORITHM, salt: salt.buffer as ArrayBuffer, iterations, hash: HASH },
		keyMaterial,
		KEY_LENGTH * 8
	);

	const computedHash = toBase64(derivedBits);
	return timingSafeEqual(computedHash, expectedHash);
}

export function isHashed(password: string): boolean {
	return password.startsWith('pbkdf2:');
}
