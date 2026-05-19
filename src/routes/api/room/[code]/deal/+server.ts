import { json } from '@sveltejs/kit';
import { dealCards, getRoomForUser } from '$lib/server/room';

export async function POST({ locals, params, platform }) {
	if (!locals.user) return json({ error: 'ไม่ได้ล็อกอิน' }, { status: 401 });

	const room = await dealCards(platform, params.code, locals.user.id);
	if (!room) {
		return json({ error: 'แจกไพ่ไม่ได้' }, { status: 400 });
	}

	return json({ room: await getRoomForUser(platform, room, locals.user.id) });
}
