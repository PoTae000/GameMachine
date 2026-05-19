import { json } from '@sveltejs/kit';
import { getUser } from '$lib/server/db';

export async function GET({ locals, platform }) {
	if (!locals.user) {
		return json({ user: null });
	}
	const user = await getUser(platform, locals.user.id);
	if (!user) {
		return json({ user: null });
	}
	return json({
		user: {
			id: user.id,
			username: user.username,
			role: user.role,
			isNewUser: user.isNewUser ?? false,
			totalDeposited: user.totalDeposited ?? 0,
			customWinRate: locals.user.role === 'admin' ? (user.customWinRate ?? null) : undefined
		}
	});
}
