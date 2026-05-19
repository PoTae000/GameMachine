import { hashPassword } from './crypto';

// =============================================
// KV Key Helpers
// =============================================

function userKey(id: string): string { return `user:${id}`; }
function usernameKey(name: string): string { return `username:${name.toLowerCase()}`; }
function sessionKey(token: string): string { return `session:${token}`; }
function roomKey(code: string): string { return `room:${code}`; }
function requestIndexKey(reqId: string): string { return `request:${reqId}`; }
const CONFIG_KEY = 'config';
const USER_INDEX_KEY = 'user_index';
const ROOMS_INDEX_KEY = 'rooms_index';
const RAIN_HISTORY_KEY = 'rain_history';

// Legacy key (used by migration)
const LEGACY_DB_KEY = 'database';

// =============================================
// Types & Interfaces (unchanged)
// =============================================

export interface TopUpRequest {
	id: string;
	userId: string;
	amount: number;
	timestamp: number;
	status: 'pending' | 'approved' | 'rejected';
}

export interface GameConfigEntry {
	winRate: number;
	scatterChance?: number;
	dealerBias?: number;
	maxMultiplier?: number;
	mineRelocate?: boolean;
	payoutMultiplier?: number;
	rareChance?: number;
}

export interface GameConfig {
	slot: GameConfigEntry;
	hilo: GameConfigEntry;
	blackjack: GameConfigEntry;
	roulette: GameConfigEntry;
	coinflip: GameConfigEntry;
	pokdeng: GameConfigEntry;
	baccarat: GameConfigEntry;
	dragontiger: GameConfigEntry;
	keno: GameConfigEntry;
	mines: GameConfigEntry;
	wheel: GameConfigEntry;
	plinko: GameConfigEntry;
	crash: GameConfigEntry;
	scratch: GameConfigEntry;
	sicbo: GameConfigEntry;
	videopoker: GameConfigEntry;
	lottery: GameConfigEntry;
	gaogae: GameConfigEntry;
	rps: GameConfigEntry;
	tower: GameConfigEntry;
	luckybox: GameConfigEntry;
}

export interface Stats {
	totalSpent: number;
	totalReceived: number;
}

export interface UserMissions {
	date: string;
	played: number;
	won: number;
	gamesPlayed: string[];
	claimed: [boolean, boolean, boolean];
}

export interface RainEvent {
	id: string;
	adminId: string;
	adminUsername: string;
	amountPerUser: number;
	totalUsers: number;
	totalAmount: number;
	timestamp: number;
}

export interface User {
	id: string;
	username: string;
	password: string;
	role: 'player' | 'admin';
	credit: number;
	stats: Stats;
	requests: TopUpRequest[];
	isNewUser: boolean;
	totalDeposited: number;
	customWinRate?: number;
	lastLoginBonus?: number;
	loginStreak?: number;
	lastWheelSpin?: number;
	missions?: UserMissions;
}

export interface StoredUser extends User {
	_version: number;
}

export interface Session {
	token: string;
	userId: string;
	expiresAt: number;
}

export type RoomGame = 'blackjack' | 'baccarat' | 'pokdeng' | 'dragontiger' | 'hilo' | 'videopoker' | 'roulette' | 'gaogae';
export type RoomPhase = 'waiting' | 'betting' | 'dealing' | 'playing' | 'result';

export interface RoomPlayer {
	userId: string;
	username: string;
	bet: number;
	betChoice?: string;
	result?: 'win' | 'lose' | 'push';
	payout?: number;
	ready: boolean;
	hand?: any;
	stood?: boolean;
}

export interface Room {
	code: string;
	hostId: string;
	game: RoomGame;
	gameName: string;
	players: RoomPlayer[];
	phase: RoomPhase;
	gameState: any;
	round: number;
	createdAt: number;
	lastActivity: number;
}

export interface StoredConfig {
	gameConfig: GameConfig;
	newUserWinRate: number;
	_version: number;
}

// Legacy type (used internally by migrateIfNeeded only)
interface Database {
	users: User[];
	sessions: Session[];
	gameConfig: GameConfig;
	newUserWinRate: number;
	rooms: Room[];
	rainHistory: RainEvent[];
	_version?: number;
}

// =============================================
// Constants
// =============================================

export const DEFAULT_GAME_CONFIG: GameConfig = {
	slot: { winRate: 40 },
	hilo: { winRate: 45 },
	blackjack: { winRate: 45 },
	roulette: { winRate: 45 },
	coinflip: { winRate: 45 },
	pokdeng: { winRate: 45 },
	baccarat: { winRate: 45 },
	dragontiger: { winRate: 45 },
	keno: { winRate: 45 },
	mines: { winRate: 45 },
	wheel: { winRate: 45 },
	plinko: { winRate: 45 },
	crash: { winRate: 45 },
	scratch: { winRate: 45 },
	sicbo: { winRate: 45 },
	videopoker: { winRate: 45 },
	lottery: { winRate: 45 },
	gaogae: { winRate: 45 },
	rps: { winRate: 45 },
	tower: { winRate: 45 },
	luckybox: { winRate: 45 }
};

const DEFAULT_ADMIN: User = {
	id: 'admin',
	username: 'Admin',
	password: '__placeholder__',
	role: 'admin',
	credit: 0,
	stats: { totalSpent: 0, totalReceived: 0 },
	requests: [],
	isNewUser: false,
	totalDeposited: 0
};

// =============================================
// Helpers
// =============================================

export function generateId(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function generateToken(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function getKV(platform: App.Platform | undefined): KVNamespace {
	if (!platform?.env?.DB) {
		throw new Error('KV namespace DB not available. Make sure platform.env.DB is configured.');
	}
	return platform.env.DB;
}

function ensureUserFields(u: User): void {
	if (u.isNewUser === undefined) u.isNewUser = u.role === 'player';
	if (u.totalDeposited === undefined) u.totalDeposited = 0;
	if (!u.stats) u.stats = { totalSpent: 0, totalReceived: 0 };
	if (!u.requests) u.requests = [];
}

function ensureConfigFields(config: StoredConfig): void {
	if (!config.gameConfig) config.gameConfig = { ...DEFAULT_GAME_CONFIG };
	for (const [key, value] of Object.entries(DEFAULT_GAME_CONFIG)) {
		if (!(key in config.gameConfig)) {
			(config.gameConfig as Record<string, GameConfigEntry>)[key] = { ...value };
		}
	}
	if (config.newUserWinRate === undefined) config.newUserWinRate = 80;
	if (config._version === undefined) config._version = 0;
}

// =============================================
// Migration from legacy "database" key
// =============================================

let migrationDone = false;

export async function migrateIfNeeded(platform: App.Platform | undefined): Promise<void> {
	if (migrationDone) return;
	const kv = getKV(platform);

	// Check if legacy key exists
	const raw = await kv.get(LEGACY_DB_KEY, 'json') as Database | null;
	if (!raw) {
		// No legacy data — check if new keys exist, if not initialize defaults
		const existingConfig = await kv.get(CONFIG_KEY, 'json');
		if (!existingConfig) {
			// Fresh install: create default admin + config
			const bytes = new Uint8Array(24);
			crypto.getRandomValues(bytes);
			const randomPw = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
			const admin: StoredUser = {
				...DEFAULT_ADMIN,
				password: await hashPassword(randomPw),
				stats: { totalSpent: 0, totalReceived: 0 },
				requests: [],
				_version: 0
			};
			await kv.put(userKey(admin.id), JSON.stringify(admin));
			await kv.put(usernameKey(admin.username), admin.id);
			await kv.put(USER_INDEX_KEY, JSON.stringify([admin.id]));
			await kv.put(CONFIG_KEY, JSON.stringify({
				gameConfig: { ...DEFAULT_GAME_CONFIG },
				newUserWinRate: 80,
				_version: 0
			}));
			await kv.put(ROOMS_INDEX_KEY, JSON.stringify([]));
			await kv.put(RAIN_HISTORY_KEY, JSON.stringify([]));
		}
		migrationDone = true;
		return;
	}

	// Migrate users
	const userIds: string[] = [];
	for (const u of (raw.users || [])) {
		ensureUserFields(u);
		const stored: StoredUser = { ...u, _version: 0 };
		await kv.put(userKey(u.id), JSON.stringify(stored));
		await kv.put(usernameKey(u.username), u.id);
		userIds.push(u.id);

		// Migrate request indexes
		for (const req of u.requests || []) {
			await kv.put(requestIndexKey(req.id), u.id);
		}
	}
	await kv.put(USER_INDEX_KEY, JSON.stringify(userIds));

	// Migrate sessions (with TTL)
	for (const s of (raw.sessions || [])) {
		const ttlSeconds = Math.max(0, Math.floor((s.expiresAt - Date.now()) / 1000));
		if (ttlSeconds > 0) {
			await kv.put(sessionKey(s.token), JSON.stringify({ userId: s.userId, expiresAt: s.expiresAt }), {
				expirationTtl: ttlSeconds
			});
		}
	}

	// Migrate config
	const config: StoredConfig = {
		gameConfig: raw.gameConfig || { ...DEFAULT_GAME_CONFIG },
		newUserWinRate: raw.newUserWinRate ?? 80,
		_version: 0
	};
	ensureConfigFields(config);
	await kv.put(CONFIG_KEY, JSON.stringify(config));

	// Migrate rooms
	const roomCodes: string[] = [];
	for (const r of (raw.rooms || [])) {
		await kv.put(roomKey(r.code), JSON.stringify(r));
		roomCodes.push(r.code);
	}
	await kv.put(ROOMS_INDEX_KEY, JSON.stringify(roomCodes));

	// Migrate rain history
	await kv.put(RAIN_HISTORY_KEY, JSON.stringify(raw.rainHistory || []));

	// Delete legacy key last (so if crash, re-run is safe)
	await kv.delete(LEGACY_DB_KEY);

	migrationDone = true;
}

// =============================================
// User Operations
// =============================================

export async function getUser(platform: App.Platform | undefined, userId: string): Promise<StoredUser | null> {
	const kv = getKV(platform);
	const raw = await kv.get(userKey(userId), 'json') as StoredUser | null;
	if (!raw) return null;
	ensureUserFields(raw);
	if (raw._version === undefined) raw._version = 0;
	return raw;
}

export async function saveUser(platform: App.Platform | undefined, user: StoredUser): Promise<void> {
	const kv = getKV(platform);
	const readVersion = user._version ?? 0;

	// Optimistic lock: verify current version
	const current = await kv.get(userKey(user.id), 'json') as StoredUser | null;
	const currentVersion = current?._version ?? 0;
	if (currentVersion !== readVersion) {
		throw new Error('DB_CONFLICT: user data was modified by another request');
	}

	user._version = readVersion + 1;
	await kv.put(userKey(user.id), JSON.stringify(user));
}

export async function getUserByUsername(platform: App.Platform | undefined, username: string): Promise<StoredUser | null> {
	const kv = getKV(platform);
	const userId = await kv.get(usernameKey(username));
	if (!userId) return null;
	return getUser(platform, userId);
}

export async function createUser(
	platform: App.Platform | undefined,
	username: string,
	password: string,
	role: 'player' | 'admin' = 'player'
): Promise<StoredUser> {
	const kv = getKV(platform);
	const user: StoredUser = {
		id: generateId(),
		username,
		password,
		role,
		credit: 0,
		stats: { totalSpent: 0, totalReceived: 0 },
		requests: [],
		isNewUser: role === 'player',
		totalDeposited: 0,
		_version: 0
	};

	await kv.put(userKey(user.id), JSON.stringify(user));
	await kv.put(usernameKey(username), user.id);

	// Update user index
	const index = await kv.get(USER_INDEX_KEY, 'json') as string[] | null;
	const userIds = index || [];
	userIds.push(user.id);
	await kv.put(USER_INDEX_KEY, JSON.stringify(userIds));

	return user;
}

export async function deleteUser(platform: App.Platform | undefined, userId: string): Promise<boolean> {
	const kv = getKV(platform);
	const user = await getUser(platform, userId);
	if (!user) return false;

	// Don't delete the last admin
	if (user.role === 'admin') {
		const allIds = await getAllUserIds(platform);
		let adminCount = 0;
		for (const id of allIds) {
			const u = await getUser(platform, id);
			if (u && u.role === 'admin') adminCount++;
		}
		if (adminCount <= 1) return false;
	}

	// Delete user key
	await kv.delete(userKey(userId));
	// Delete username index
	await kv.delete(usernameKey(user.username));

	// Update user index
	const index = await kv.get(USER_INDEX_KEY, 'json') as string[] | null;
	if (index) {
		const filtered = index.filter(id => id !== userId);
		await kv.put(USER_INDEX_KEY, JSON.stringify(filtered));
	}

	// Delete request indexes
	for (const req of user.requests || []) {
		await kv.delete(requestIndexKey(req.id));
	}

	return true;
}

export async function getAllUserIds(platform: App.Platform | undefined): Promise<string[]> {
	const kv = getKV(platform);
	const index = await kv.get(USER_INDEX_KEY, 'json') as string[] | null;
	return index || [];
}

export async function getAllUsers(platform: App.Platform | undefined): Promise<StoredUser[]> {
	const ids = await getAllUserIds(platform);
	const users: StoredUser[] = [];
	for (const id of ids) {
		const u = await getUser(platform, id);
		if (u) users.push(u);
	}
	return users;
}

export async function withUserRetry<T>(
	platform: App.Platform | undefined,
	userId: string,
	fn: (user: StoredUser) => Promise<T>,
	maxRetries = 3
): Promise<T> {
	for (let attempt = 0; attempt < maxRetries; attempt++) {
		const user = await getUser(platform, userId);
		if (!user) throw new Error('User not found');
		try {
			return await fn(user);
		} catch (e) {
			if (!isDBConflict(e) || attempt === maxRetries - 1) throw e;
		}
	}
	throw new Error('Max retries exceeded');
}

// =============================================
// Session Operations (KV TTL-based)
// =============================================

const SESSION_TTL = 24 * 60 * 60; // 24 hours in seconds

export async function createAuthSession(platform: App.Platform | undefined, userId: string): Promise<Session> {
	const kv = getKV(platform);
	const token = generateToken();
	const expiresAt = Date.now() + SESSION_TTL * 1000;
	await kv.put(sessionKey(token), JSON.stringify({ userId, expiresAt }), {
		expirationTtl: SESSION_TTL
	});
	return { token, userId, expiresAt };
}

export async function getAuthSession(platform: App.Platform | undefined, token: string): Promise<{ userId: string; expiresAt: number } | null> {
	const kv = getKV(platform);
	const raw = await kv.get(sessionKey(token), 'json') as { userId: string; expiresAt: number } | null;
	if (!raw) return null;
	if (raw.expiresAt < Date.now()) {
		await kv.delete(sessionKey(token));
		return null;
	}
	return raw;
}

export async function deleteAuthSession(platform: App.Platform | undefined, token: string): Promise<void> {
	const kv = getKV(platform);
	await kv.delete(sessionKey(token));
}

// =============================================
// Config Operations
// =============================================

export async function getConfig(platform: App.Platform | undefined): Promise<StoredConfig> {
	const kv = getKV(platform);
	const raw = await kv.get(CONFIG_KEY, 'json') as StoredConfig | null;
	if (!raw) {
		return {
			gameConfig: { ...DEFAULT_GAME_CONFIG },
			newUserWinRate: 80,
			_version: 0
		};
	}
	ensureConfigFields(raw);
	return raw;
}

export async function saveConfig(platform: App.Platform | undefined, config: StoredConfig): Promise<void> {
	const kv = getKV(platform);
	const readVersion = config._version ?? 0;

	const current = await kv.get(CONFIG_KEY, 'json') as StoredConfig | null;
	const currentVersion = current?._version ?? 0;
	if (currentVersion !== readVersion) {
		throw new Error('DB_CONFLICT: config was modified by another request');
	}

	config._version = readVersion + 1;
	await kv.put(CONFIG_KEY, JSON.stringify(config));
}

// =============================================
// Room Operations
// =============================================

export async function getRoom(platform: App.Platform | undefined, code: string): Promise<Room | null> {
	const kv = getKV(platform);
	const raw = await kv.get(roomKey(code), 'json') as Room | null;
	return raw;
}

export async function saveRoom(platform: App.Platform | undefined, room: Room): Promise<void> {
	const kv = getKV(platform);
	await kv.put(roomKey(room.code), JSON.stringify(room));
}

export async function deleteRoom(platform: App.Platform | undefined, code: string): Promise<void> {
	const kv = getKV(platform);
	await kv.delete(roomKey(code));

	// Update rooms index
	const index = await kv.get(ROOMS_INDEX_KEY, 'json') as string[] | null;
	if (index) {
		const filtered = index.filter(c => c !== code);
		await kv.put(ROOMS_INDEX_KEY, JSON.stringify(filtered));
	}
}

export async function getAllRoomCodes(platform: App.Platform | undefined): Promise<string[]> {
	const kv = getKV(platform);
	const index = await kv.get(ROOMS_INDEX_KEY, 'json') as string[] | null;
	return index || [];
}

export async function addRoomToIndex(platform: App.Platform | undefined, code: string): Promise<void> {
	const kv = getKV(platform);
	const index = await kv.get(ROOMS_INDEX_KEY, 'json') as string[] | null;
	const codes = index || [];
	if (!codes.includes(code)) {
		codes.push(code);
		await kv.put(ROOMS_INDEX_KEY, JSON.stringify(codes));
	}
}

// =============================================
// Rain History Operations
// =============================================

export async function getRainHistory(platform: App.Platform | undefined): Promise<RainEvent[]> {
	const kv = getKV(platform);
	const raw = await kv.get(RAIN_HISTORY_KEY, 'json') as RainEvent[] | null;
	return raw || [];
}

export async function saveRainHistory(platform: App.Platform | undefined, events: RainEvent[]): Promise<void> {
	const kv = getKV(platform);
	await kv.put(RAIN_HISTORY_KEY, JSON.stringify(events));
}

// =============================================
// Request Index Operations
// =============================================

export async function addRequestIndex(platform: App.Platform | undefined, reqId: string, userId: string): Promise<void> {
	const kv = getKV(platform);
	await kv.put(requestIndexKey(reqId), userId);
}

export async function getRequestUserId(platform: App.Platform | undefined, reqId: string): Promise<string | null> {
	const kv = getKV(platform);
	return await kv.get(requestIndexKey(reqId));
}

export async function deleteRequestIndex(platform: App.Platform | undefined, reqId: string): Promise<void> {
	const kv = getKV(platform);
	await kv.delete(requestIndexKey(reqId));
}

// =============================================
// Conflict Detection Helper
// =============================================

export function isDBConflict(e: unknown): boolean {
	return e instanceof Error && (e.message.includes('DB_CONFLICT') || e.message.includes('DB_READ_ERROR'));
}

