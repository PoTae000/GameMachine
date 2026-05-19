import { json } from '@sveltejs/kit';
import { forceStart, getRoomForUser, getRoom } from '$lib/server/room';

export async function POST({ locals, params, platform }) {
	if (!locals.user) return json({ error: 'ไม่ได้ล็อกอิน' }, { status: 401 });

	// Check caller is host
	const existingRoom = await getRoom(platform, params.code);
	if (!existingRoom || existingRoom.hostId !== locals.user.id) {
		return json({ error: 'เฉพาะเจ้าของห้องเท่านั้น' }, { status: 403 });
	}

	const room = await forceStart(platform, params.code);
	if (!room) {
		return json({ error: 'เริ่มเกมไม่ได้' }, { status: 400 });
	}

	return json({ room: await getRoomForUser(platform, room, locals.user.id) });
}
