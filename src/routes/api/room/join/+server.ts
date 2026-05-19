import { json } from '@sveltejs/kit';
import { joinRoom, cleanStaleRooms } from '$lib/server/room';

export async function POST({ locals, request, platform }) {
	if (!locals.user) return json({ error: 'ไม่ได้ล็อกอิน' }, { status: 401 });

	const body = await request.json();
	const code = (body.code || '').toUpperCase().trim();

	if (!code || code.length !== 6) {
		return json({ error: 'รหัสห้องไม่ถูกต้อง' }, { status: 400 });
	}

	await cleanStaleRooms(platform);

	const room = await joinRoom(platform, code, locals.user.id, locals.user.username);
	if (!room) {
		return json({ error: 'ไม่พบห้อง หรือห้องเต็ม' }, { status: 404 });
	}

	return json({ room });
}
