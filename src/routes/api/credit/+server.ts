import { json } from '@sveltejs/kit';
import { getUser } from '$lib/server/db';

export async function GET({ locals, platform }) {
	if (!locals.user) return json({ credit: 0 }, { status: 401 });
	const user = await getUser(platform, locals.user.id);
	return json({ credit: user?.credit ?? 0 });
}
