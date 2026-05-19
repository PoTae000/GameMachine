import { json } from '@sveltejs/kit';
import { placeBet, getRoomForUser } from '$lib/server/room';

export async function POST({ locals, params, request, platform }) {
	if (!locals.user) return json({ error: 'ไม่ได้ล็อกอิน' }, { status: 401 });

	const body = await request.json();
	const bet = Number(body.bet);
	const betChoice = body.betChoice;

	if (!bet || bet < 1 || isNaN(bet)) {
		return json({ error: 'จำนวนเดิมพันไม่ถูกต้อง' }, { status: 400 });
	}

	const room = await placeBet(platform, params.code, locals.user.id, Math.round(bet * 100) / 100, betChoice);
	if (!room) {
		return json({ error: 'วางเดิมพันไม่ได้' }, { status: 400 });
	}

	return json({ room: await getRoomForUser(platform, room, locals.user.id) });
}
