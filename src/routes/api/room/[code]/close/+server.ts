import { json } from '@sveltejs/kit';
import { closeRoom } from '$lib/server/room';

export async function POST({ locals, params, platform }) {
	if (!locals.user) return json({ error: 'ไม่ได้ล็อกอิน' }, { status: 401 });

	const ok = await closeRoom(platform, params.code, locals.user.id);
	if (!ok) {
		return json({ error: 'ปิดห้องไม่ได้ (ต้องเป็นเจ้ามือ)' }, { status: 403 });
	}

	return json({ ok: true });
}
