import { json } from '@sveltejs/kit';
import { getAllUsers, getUserByUsername, createUser } from '$lib/server/db';
import { hashPassword } from '$lib/server/crypto';

export async function GET({ locals, platform }) {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: 'forbidden' }, { status: 403 });
	}
	const users = await getAllUsers(platform);
	const result = users.map(u => ({
		id: u.id,
		username: u.username,
		role: u.role,
		credit: u.credit,
		stats: u.stats,
		requestCount: u.requests.filter(r => r.status === 'pending').length,
		isNewUser: u.isNewUser ?? false,
		totalDeposited: u.totalDeposited ?? 0,
		customWinRate: u.customWinRate ?? null
	}));
	return json(result);
}

export async function POST({ request, locals, platform }) {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: 'forbidden' }, { status: 403 });
	}
	const { username, password } = await request.json();
	if (!username || !password) {
		return json({ error: 'missing fields' }, { status: 400 });
	}
	if (typeof password !== 'string' || password.length < 6) {
		return json({ error: 'Password must be at least 6 characters' }, { status: 400 });
	}
	const existing = await getUserByUsername(platform, username);
	if (existing) {
		return json({ error: 'username taken' }, { status: 409 });
	}
	const hashedPw = await hashPassword(password);
	const user = await createUser(platform, username, hashedPw);
	return json({ id: user.id, username: user.username, role: user.role, credit: user.credit });
}
