import { redirect } from '@sveltejs/kit';
import { getRoom, joinRoom, getRoomForUser } from '$lib/server/room';

export async function load({ params, locals, platform }) {
	// Auth check
	if (!locals.user) {
		throw redirect(302, '/');
	}

	const code = params.code;
	const room = await getRoom(platform, code);

	// Room doesn't exist
	if (!room) {
		throw redirect(302, '/room');
	}

	// Check if user is already in room
	const isInRoom = room.players.some(p => p.userId === locals.user!.id);

	if (isInRoom) {
		// Already in room, return sanitized data
		return {
			room: await getRoomForUser(platform, room, locals.user.id)
		};
	}

	// Try to auto-rejoin
	const joined = await joinRoom(platform, code, locals.user.id, locals.user.username);
	if (!joined) {
		// Can't rejoin (room full or phase doesn't allow)
		throw redirect(302, '/room');
	}

	return {
		room: await getRoomForUser(platform, joined, locals.user.id)
	};
}
