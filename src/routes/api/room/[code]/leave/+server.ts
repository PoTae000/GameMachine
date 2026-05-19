import { json } from '@sveltejs/kit';
import { leaveRoom } from '$lib/server/room';

export async function POST({ locals, params, platform }) {
	if (!locals.user) return json({ error: 'ไม่ได้ล็อกอิน' }, { status: 401 });

	const ok = await leaveRoom(platform, params.code, locals.user.id);
	if (!ok) {
		return json({ error: 'ออกจากห้องไม่ได้' }, { status: 400 });
	}

	return json({ ok: true });
}
