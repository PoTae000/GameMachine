import { json } from '@sveltejs/kit';
import { getUser, saveUser } from '$lib/server/db';

export async function POST({ request, locals, platform }) {
	if (!locals.user) return json({ credit: 0 }, { status: 401 });
	// Only admins can directly modify credit
	if (locals.user.role !== 'admin') return json({ error: 'Forbidden' }, { status: 403 });
	const { delta } = await request.json();
	const user = await getUser(platform, locals.user.id);
	if (!user) return json({ credit: 0 }, { status: 404 });
	user.credit = Math.max(0, user.credit + delta);
	await saveUser(platform, user);
	return json({ credit: user.credit });
}
