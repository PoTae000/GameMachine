import { json } from '@sveltejs/kit';
import { getUser, saveUser } from '$lib/server/db';

export async function GET({ locals, platform }) {
	if (!locals.user) return json({ totalSpent: 0, totalReceived: 0 }, { status: 401 });
	const user = await getUser(platform, locals.user.id);
	return json(user?.stats ?? { totalSpent: 0, totalReceived: 0 });
}

export async function POST({ request, locals, platform }) {
	if (!locals.user || locals.user.role !== 'admin') return json({ success: false }, { status: 403 });
	const { totalSpent, totalReceived } = await request.json();
	const user = await getUser(platform, locals.user.id);
	if (!user) return json({ success: false }, { status: 404 });
	user.stats.totalSpent = Number(totalSpent) || 0;
	user.stats.totalReceived = Number(totalReceived) || 0;

	// Check new user graduation: if credit >= 2x total deposited, permanently graduate
	let graduated = false;
	if (user.isNewUser && user.totalDeposited > 0 && user.credit >= user.totalDeposited * 2) {
		user.isNewUser = false;
		graduated = true;
	}

	await saveUser(platform, user);
	return json({ success: true, isNewUser: user.isNewUser, graduated });
}
