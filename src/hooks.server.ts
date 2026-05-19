import type { Handle } from '@sveltejs/kit';
import { migrateIfNeeded, getAuthSession, getUser } from '$lib/server/db';
import { initSessionKV } from '$lib/server/gameSession';

// --- Rate Limiting (per-IP sliding window) ---
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMITS: Record<string, number> = {
	'/api/auth/login': 10,
	'/api/auth/': 20,
	'/api/room/': 200,
	'/api/games/': 200,
	'/api/events/': 30,
	'/api/admin/': 30,
	'/api/': 120
};

// Cleanup stale entries every 5 minutes
let lastCleanup = Date.now();
function cleanupRateLimits() {
	const now = Date.now();
	if (now - lastCleanup < 300_000) return;
	lastCleanup = now;
	const cutoff = now - RATE_LIMIT_WINDOW;
	for (const [key, timestamps] of rateLimitMap) {
		const filtered = timestamps.filter(t => t > cutoff);
		if (filtered.length === 0) rateLimitMap.delete(key);
		else rateLimitMap.set(key, filtered);
	}
}

function getRateLimit(pathname: string): number {
	for (const [prefix, limit] of Object.entries(RATE_LIMITS)) {
		if (pathname.startsWith(prefix)) return limit;
	}
	return 200;
}

function checkRateLimit(ip: string, pathname: string): boolean {
	cleanupRateLimits();
	const limit = getRateLimit(pathname);
	const key = `${ip}:${pathname.split('/').slice(0, 4).join('/')}`;
	const now = Date.now();
	const cutoff = now - RATE_LIMIT_WINDOW;
	const timestamps = (rateLimitMap.get(key) || []).filter(t => t > cutoff);
	if (timestamps.length >= limit) return false;
	timestamps.push(now);
	rateLimitMap.set(key, timestamps);
	return true;
}

function checkUserRateLimit(userId: string, pathname: string): boolean {
	const limit = getRateLimit(pathname);
	// User limit = half of IP limit (stricter)
	const userLimit = Math.ceil(limit * 0.5);
	const key = `user:${userId}:${pathname.split('/').slice(0, 4).join('/')}`;
	const now = Date.now();
	const cutoff = now - RATE_LIMIT_WINDOW;
	const timestamps = (rateLimitMap.get(key) || []).filter(t => t > cutoff);
	if (timestamps.length >= userLimit) return false;
	timestamps.push(now);
	rateLimitMap.set(key, timestamps);
	return true;
}

// --- KV init flag ---
let kvInitialized = false;

export const handle: Handle = async ({ event, resolve }) => {
	// Initialize game session KV + run migration on first request
	if (!kvInitialized && event.platform?.env?.DB) {
		initSessionKV(event.platform.env.DB);
		await migrateIfNeeded(event.platform);
		kvInitialized = true;
	}

	// Rate limiting for API routes
	const pathname = event.url.pathname;
	if (pathname.startsWith('/api/')) {
		const ip = event.request.headers.get('cf-connecting-ip')
			|| event.getClientAddress?.()
			|| 'unknown';

		if (!checkRateLimit(ip, pathname)) {
			return new Response(JSON.stringify({ error: 'Too many requests' }), {
				status: 429,
				headers: { 'Content-Type': 'application/json', 'Retry-After': '60' }
			});
		}
	}

	// Auth: resolve session via per-key lookups
	const token = event.cookies.get('session');
	if (token) {
		const session = await getAuthSession(event.platform, token);
		if (session) {
			const user = await getUser(event.platform, session.userId);
			if (user) {
				event.locals.user = {
					id: user.id,
					username: user.username,
					role: user.role
				};
			}
		}
	}

	// Per-user rate limiting (stricter than per-IP)
	if (pathname.startsWith('/api/') && event.locals.user) {
		if (!checkUserRateLimit(event.locals.user.id, pathname)) {
			return new Response(JSON.stringify({ error: 'Too many requests' }), {
				status: 429,
				headers: { 'Content-Type': 'application/json', 'Retry-After': '60' }
			});
		}
	}

	return resolve(event);
};
