import { json } from '@sveltejs/kit';
import { playerAction, revealDealer, videoPokerDraw, getRoomForUser } from '$lib/server/room';

export async function POST({ locals, params, request, platform }) {
	if (!locals.user) return json({ error: 'ไม่ได้ล็อกอิน' }, { status: 401 });

	const body = await request.json();
	const action = body.action;

	if (action === 'reveal') {
		const room = await revealDealer(platform, params.code, locals.user.id);
		if (!room) return json({ error: 'ไม่สามารถเปิดไพ่ได้' }, { status: 400 });
		return json({ room: await getRoomForUser(platform, room, locals.user.id) });
	}

	if (action === 'draw') {
		const room = await videoPokerDraw(platform, params.code, locals.user.id, body.holds);
		if (!room) return json({ error: 'ไม่สามารถจั่วไพ่ได้' }, { status: 400 });
		return json({ room: await getRoomForUser(platform, room, locals.user.id) });
	}

	if (action !== 'hit' && action !== 'stand') {
		return json({ error: 'แอคชั่นไม่ถูกต้อง' }, { status: 400 });
	}

	const room = await playerAction(platform, params.code, locals.user.id, action);
	if (!room) {
		return json({ error: 'ไม่สามารถทำได้' }, { status: 400 });
	}

	return json({ room: await getRoomForUser(platform, room, locals.user.id) });
}
