import { json } from '@sveltejs/kit';
import { getUser, saveUser, getAllUsers, addRequestIndex } from '$lib/server/db';

export async function GET({ locals, platform }) {
	if (!locals.user) return json([], { status: 401 });

	// Admin sees all requests from all users
	if (locals.user.role === 'admin') {
		const users = await getAllUsers(platform);
		const allRequests: any[] = [];
		for (const user of users) {
			for (const req of user.requests) {
				allRequests.push({ ...req, username: user.username });
			}
		}
		allRequests.sort((a, b) => b.timestamp - a.timestamp);
		return json(allRequests);
	}

	// Player sees only their own requests
	const user = await getUser(platform, locals.user.id);
	return json(user?.requests ?? []);
}

export async function POST({ request, locals, platform }) {
	if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
	const { amount } = await request.json();
	if (!Number.isInteger(amount) || amount < 1) {
		return json({ error: 'Invalid amount' }, { status: 400 });
	}
	const user = await getUser(platform, locals.user.id);
	if (!user) return json({ error: 'user not found' }, { status: 404 });

	const req = {
		id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
		userId: user.id,
		amount,
		timestamp: Date.now(),
		status: 'pending' as const
	};
	user.requests.unshift(req);
	await saveUser(platform, user);
	await addRequestIndex(platform, req.id, user.id);
	return json(req);
}
