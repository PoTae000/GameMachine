import { json } from '@sveltejs/kit';
import { getUser, saveUser, getRequestUserId } from '$lib/server/db';

export async function POST({ params, locals, platform }) {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ success: false }, { status: 403 });
	}

	const userId = await getRequestUserId(platform, params.id);
	if (!userId) return json({ success: false }, { status: 400 });

	const user = await getUser(platform, userId);
	if (!user) return json({ success: false }, { status: 400 });

	const req = user.requests.find((r) => r.id === params.id);
	if (!req || req.status !== 'pending') {
		return json({ success: false }, { status: 400 });
	}

	req.status = 'approved';
	user.credit += req.amount;
	user.totalDeposited = (user.totalDeposited ?? 0) + req.amount;
	await saveUser(platform, user);
	return json({ success: true, credit: user.credit });
}
