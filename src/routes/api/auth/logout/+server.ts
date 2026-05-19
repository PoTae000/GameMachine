import { json } from '@sveltejs/kit';
import { getAuthSession, deleteAuthSession, getRoom, saveRoom, deleteRoom, getAllRoomCodes } from '$lib/server/db';

export async function POST({ cookies, platform }) {
	const token = cookies.get('session');
	if (token) {
		const session = await getAuthSession(platform, token);

		// Remove user from all rooms they're in
		if (session) {
			const roomCodes = await getAllRoomCodes(platform);
			for (const code of roomCodes) {
				const room = await getRoom(platform, code);
				if (!room) continue;
				if (room.hostId === session.userId) {
					// Host leaving: close the room
					await deleteRoom(platform, code);
				} else if (room.players.some(p => p.userId === session.userId)) {
					room.players = room.players.filter(p => p.userId !== session.userId);
					await saveRoom(platform, room);
				}
			}
		}

		await deleteAuthSession(platform, token);
		cookies.delete('session', { path: '/' });
	}
	return json({ success: true });
}
