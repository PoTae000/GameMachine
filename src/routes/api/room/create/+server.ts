import { json } from '@sveltejs/kit';
import { createRoom, cleanStaleRooms } from '$lib/server/room';
import type { RoomGame } from '$lib/server/db';

const VALID_GAMES: RoomGame[] = ['blackjack', 'baccarat', 'pokdeng', 'dragontiger', 'hilo', 'videopoker', 'roulette', 'gaogae'];

export async function POST({ locals, request, platform }) {
	if (!locals.user) return json({ error: 'ไม่ได้ล็อกอิน' }, { status: 401 });

	const body = await request.json();
	const game = body.game as RoomGame;

	if (!VALID_GAMES.includes(game)) {
		return json({ error: 'เกมไม่ถูกต้อง' }, { status: 400 });
	}

	// Clean up stale rooms
	await cleanStaleRooms(platform);

	const room = await createRoom(platform, locals.user.id, locals.user.username, game);
	return json({ room });
}
