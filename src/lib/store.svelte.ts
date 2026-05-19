import { browser } from '$app/environment';

// Dark mode state
function loadDarkMode(): boolean {
	if (!browser) return false;
	try {
		return localStorage.getItem('darkMode') === 'true';
	} catch {
		return false;
	}
}

export const darkMode = $state({ value: loadDarkMode() });

export function toggleDarkMode() {
	darkMode.value = !darkMode.value;
	if (browser) {
		try {
			localStorage.setItem('darkMode', String(darkMode.value));
		} catch { /* ignore */ }
		if (darkMode.value) {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
	}
}

export interface CurrentUser {
	id: string;
	username: string;
	role: 'player' | 'admin';
	isNewUser: boolean;
	totalDeposited: number;
	customWinRate?: number | null;
}

export const currentUser = $state<{ value: CurrentUser | null }>({ value: null });
export const wallet = $state({ credit: 0 });
export const stats = $state({ totalSpent: 0, totalReceived: 0 });

// Blocks navigation when a game is in progress
export const gameInProgress = $state({ value: false });
// Blocks credit polling during card reveal animation
export const revealBlocking = $state({ value: false });

export interface TopUpRequest {
	id: string;
	userId: string;
	username?: string;
	amount: number;
	timestamp: number;
	status: 'pending' | 'approved' | 'rejected';
}

export const topUpRequests = $state<{ list: TopUpRequest[] }>({ list: [] });

export interface GameConfigEntry {
	winRate: number;
	scatterChance?: number;   // slot (default 2.5)
	dealerBias?: number;      // pokdeng/blackjack/baccarat/dragontiger (default 50)
	maxMultiplier?: number;   // crash (default 15)
	mineRelocate?: boolean;   // mines (default true)
	payoutMultiplier?: number; // coinflip/hilo (default 1.9/1.8)
	rareChance?: number;      // wheel/plinko/scratch/keno/lottery/sicbo/videopoker
}

export const gameConfig = $state<Record<string, GameConfigEntry>>({
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
});

export const newUserWinRate = $state({ value: 80 });

// Forfeit: abandon a multi-step game (lose the bet)
export async function forfeitGame(game: string) {
	if (!browser) return;
	try {
		const res = await fetch('/api/games/forfeit', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ game })
		});
		const data = await res.json();
		if (data.newCredit !== undefined) wallet.credit = data.newCredit;
	} catch { /* ignore */ }
	gameInProgress.value = false;
}

// Auth: load current user from server
export async function loadCurrentUser(): Promise<CurrentUser | null> {
	if (!browser) return null;
	try {
		const res = await fetch('/api/auth/me');
		const data = await res.json();
		currentUser.value = data.user ?? null;
		return currentUser.value;
	} catch {
		currentUser.value = null;
		return null;
	}
}

// Auth: login
export async function userLogin(username: string, password: string): Promise<{ success: boolean; user?: CurrentUser }> {
	const res = await fetch('/api/auth/login', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password })
	});
	const data = await res.json();
	if (data.success && data.user) {
		currentUser.value = data.user;
		return { success: true, user: data.user };
	}
	return { success: false };
}

// Auth: logout
export async function userLogout() {
	if (!browser) return;
	await fetch('/api/auth/logout', { method: 'POST' });
	currentUser.value = null;
	wallet.credit = 0;
	stats.totalSpent = 0;
	stats.totalReceived = 0;
}

// Game config: load from server
export async function loadGameConfig() {
	if (!browser) return;
	try {
		const res = await fetch('/api/game-config', { cache: 'no-store' });
		const data = await res.json();
		if (data._newUserWinRate !== undefined) {
			newUserWinRate.value = data._newUserWinRate;
			delete data._newUserWinRate;
		}
		// Sync per-user customWinRate from server
		if ('_customWinRate' in data) {
			if (currentUser.value) {
				currentUser.value = { ...currentUser.value, customWinRate: data._customWinRate };
			}
			delete data._customWinRate;
		}
		Object.assign(gameConfig, data);
	} catch {
		/* ignore */
	}
}

// Game config: save game config (full config object)
export async function saveGameConfig(game: string, config: Partial<GameConfigEntry>) {
	if (!browser) return;
	try {
		const res = await fetch('/api/game-config', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ game, ...config })
		});
		const data = await res.json();
		if (data.gameConfig) {
			if (data.gameConfig._newUserWinRate !== undefined) {
				newUserWinRate.value = data.gameConfig._newUserWinRate;
				delete data.gameConfig._newUserWinRate;
			}
			Object.assign(gameConfig, data.gameConfig);
		}
	} catch {
		/* ignore */
	}
}

// Game config: save newUserWinRate
export async function saveNewUserWinRate(rate: number) {
	if (!browser) return;
	try {
		await fetch('/api/game-config', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ newUserWinRate: rate })
		});
		newUserWinRate.value = rate;
	} catch {
		/* ignore */
	}
}

// Stats: load from server (persist across refresh)
export async function loadStats() {
	if (!browser) return;
	try {
		const res = await fetch('/api/stats');
		const data = await res.json();
		stats.totalSpent = data.totalSpent ?? 0;
		stats.totalReceived = data.totalReceived ?? 0;
	} catch {
		/* ignore */
	}
}

// Stats: save to server (also checks new user graduation)
export async function saveStats() {
	if (!browser) return;
	try {
		const res = await fetch('/api/stats', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ totalSpent: stats.totalSpent, totalReceived: stats.totalReceived })
		});
		const data = await res.json();
		// Update new user status if graduated
		if (data.graduated && currentUser.value) {
			currentUser.value = { ...currentUser.value, isNewUser: false };
		}
	} catch {
		/* ignore */
	}
}

// Credit: load from server
export async function loadCredit() {
	if (!browser) return;
	try {
		const res = await fetch('/api/credit');
		const data = await res.json();
		wallet.credit = data.credit;
	} catch {
		/* ignore */
	}
}

// Top-up requests
export async function addTopUpRequest(amount: number) {
	if (!browser) return;
	await fetch('/api/requests', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ amount })
	});
}

export async function loadRequests() {
	if (!browser) return;
	try {
		const res = await fetch('/api/requests');
		topUpRequests.list = await res.json();
	} catch {
		/* ignore */
	}
}

export async function approveRequest(id: string) {
	if (!browser) return;
	await fetch(`/api/requests/${id}/approve`, { method: 'POST' });
	await loadRequests();
	await loadCredit();
}

export async function rejectRequest(id: string) {
	if (!browser) return;
	await fetch(`/api/requests/${id}/reject`, { method: 'POST' });
	await loadRequests();
}

// Event system
export const eventStatus = $state<{ value: any | null }>({ value: null });

export async function loadEventStatus() {
	if (!browser) return;
	try {
		const res = await fetch('/api/events/status');
		if (res.ok) eventStatus.value = await res.json();
	} catch { /* ignore */ }
}

export async function claimDailyLogin(): Promise<{ reward: number; streak: number; newCredit: number } | null> {
	if (!browser) return null;
	try {
		const res = await fetch('/api/events/daily-claim', { method: 'POST' });
		if (!res.ok) return null;
		const data = await res.json();
		wallet.credit = data.newCredit;
		await loadEventStatus();
		return data;
	} catch { return null; }
}

export async function spinLuckyWheel(): Promise<{ segmentIndex: number; amount: number; newCredit: number } | null> {
	if (!browser) return null;
	try {
		const res = await fetch('/api/events/wheel-spin', { method: 'POST' });
		if (!res.ok) return null;
		const data = await res.json();
		wallet.credit = data.newCredit;
		await loadEventStatus();
		return data;
	} catch { return null; }
}

export async function claimMission(missionId: number): Promise<{ reward: number; newCredit: number } | null> {
	if (!browser) return null;
	try {
		const res = await fetch('/api/events/missions', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ missionId })
		});
		if (!res.ok) return null;
		const data = await res.json();
		wallet.credit = data.newCredit;
		await loadEventStatus();
		return data;
	} catch { return null; }
}

export async function triggerRain(amountPerUser: number): Promise<any> {
	if (!browser) return null;
	try {
		const res = await fetch('/api/events/rain', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ amountPerUser })
		});
		if (!res.ok) return null;
		return await res.json();
	} catch { return null; }
}

export async function resetAllCredits(): Promise<{ count: number } | null> {
	if (!browser) return null;
	try {
		const res = await fetch('/api/admin/reset-credits', { method: 'POST' });
		if (!res.ok) return null;
		return await res.json();
	} catch { return null; }
}

export async function resetAllHistory(): Promise<{ count: number } | null> {
	if (!browser) return null;
	try {
		const res = await fetch('/api/admin/reset-history', { method: 'POST' });
		if (!res.ok) return null;
		return await res.json();
	} catch { return null; }
}
