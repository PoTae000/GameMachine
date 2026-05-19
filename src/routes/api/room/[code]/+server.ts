import { json } from '@sveltejs/kit';
import { getRoom, getRoomForUser, checkBotAction } from '$lib/server/room';

export async function GET({ locals, params, platform }) {
	if (!locals.user) return json({ error: 'ไม่ได้ล็อกอิน' }, { status: 401 });

	// Run bot actions before returning state (auto-deal, auto-next, etc.)
	await checkBotAction(platform, params.code);

	const room = await getRoom(platform, params.code);
	if (!room) {
		return json({ error: 'ไม่พบห้อง', closed: true }, { status: 404 });
	}

	// Check if user is in the room
	if (!room.players.some(p => p.userId === locals.user!.id)) {
		return json({ error: 'คุณไม่ได้อยู่ในห้องนี้' }, { status: 403 });
	}

	const sanitized = await getRoomForUser(platform, room, locals.user.id);
	return json({ room: sanitized });
}
