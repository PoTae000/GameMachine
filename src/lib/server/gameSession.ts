// Game session store backed by KV for persistence across worker restarts
// Falls back to in-memory if KV not initialized

export interface GameSession {
	userId: string;
	game: string;
	bet: number;
	state: Record<string, any>;
	createdAt: number;
	lastActivity: number;
}

const SESSION_TTL = 600; // 10 minutes in seconds
const KEY_PREFIX = 'gs:';
const SESSION_SECRET = 'slot-machine-session-key-2024';

// KV reference - set via initSessionKV()
let kv: KVNamespace | null = null;

// In-memory fallback
const memSessions = new Map<string, GameSession>();

// Cached derived key
let cachedKey: CryptoKey | null = null;

async function deriveKey(): Promise<CryptoKey> {
	if (cachedKey) return cachedKey;
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(SESSION_SECRET),
		'PBKDF2',
		false,
		['deriveKey']
	);
	cachedKey = await crypto.subtle.deriveKey(
		{ name: 'PBKDF2', salt: new TextEncoder().encode('game-session-salt'), iterations: 1000, hash: 'SHA-256' },
		keyMaterial,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);
	return cachedKey;
}

async function encrypt(data: string): Promise<string> {
	const key = await deriveKey();
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encoded = new TextEncoder().encode(data);
	const ciphertext = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		key,
		encoded
	);
	// Concatenate iv + ciphertext, then base64 encode
	const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
	combined.set(iv);
	combined.set(new Uint8Array(ciphertext), iv.length);
	return btoa(String.fromCharCode(...combined));
}

async function decrypt(data: string): Promise<string> {
	const key = await deriveKey();
	const combined = Uint8Array.from(atob(data), c => c.charCodeAt(0));
	const iv = combined.slice(0, 12);
	const ciphertext = combined.slice(12);
	const decrypted = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv },
		key,
		ciphertext
	);
	return new TextDecoder().decode(decrypted);
}

export function initSessionKV(kvNamespace: KVNamespace) {
	kv = kvNamespace;
}

function makeKey(userId: string, game: string): string {
	return `${KEY_PREFIX}${userId}:${game}`;
}

export async function createSession(userId: string, game: string, bet: number, state: Record<string, any>): Promise<GameSession> {
	const session: GameSession = {
		userId,
		game,
		bet,
		state,
		createdAt: Date.now(),
		lastActivity: Date.now()
	};
	const key = makeKey(userId, game);

	if (kv) {
		const encrypted = await encrypt(JSON.stringify(session));
		await kv.put(key, encrypted, { expirationTtl: SESSION_TTL });
	} else {
		memSessions.set(key, session);
	}

	return session;
}

export async function getSession(userId: string, game: string): Promise<GameSession | null> {
	const key = makeKey(userId, game);

	if (kv) {
		const raw = await kv.get(key, 'text');
		if (!raw) return null;
		const data = JSON.parse(await decrypt(raw)) as GameSession;
		// Refresh TTL on access
		data.lastActivity = Date.now();
		const encrypted = await encrypt(JSON.stringify(data));
		await kv.put(key, encrypted, { expirationTtl: SESSION_TTL });
		return data;
	}

	const session = memSessions.get(key);
	if (!session) return null;
	if (Date.now() - session.lastActivity > SESSION_TTL * 1000) {
		memSessions.delete(key);
		return null;
	}
	session.lastActivity = Date.now();
	return session;
}

export async function updateSession(userId: string, game: string, session: GameSession): Promise<void> {
	const key = makeKey(userId, game);
	session.lastActivity = Date.now();

	if (kv) {
		const encrypted = await encrypt(JSON.stringify(session));
		await kv.put(key, encrypted, { expirationTtl: SESSION_TTL });
	} else {
		memSessions.set(key, session);
	}
}

export async function deleteSession(userId: string, game: string): Promise<void> {
	const key = makeKey(userId, game);

	if (kv) {
		await kv.delete(key);
	} else {
		memSessions.delete(key);
	}
}
