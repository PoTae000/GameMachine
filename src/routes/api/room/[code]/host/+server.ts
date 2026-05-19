import { json } from '@sveltejs/kit';
import { claimHost, releaseHost, getRoomForUser } from '$lib/server/room';

export async function POST({ locals, params, request, platform }) {
	if (!locals.user) return json({ error: 'ไม่ได้ล็อกอิน' }, { status: 401 });

	const body = await request.json();
	const action = body.action; // 'claim' or 'release'

	if (action === 'claim') {
		const room = await claimHost(platform, params.code, locals.user.id);
		if (!room) return json({ error: 'ไม่สามารถรับเป็นเจ้ามือได้' }, { status: 400 });
		return json({ room: await getRoomForUser(platform, room, locals.user.id) });
	}

	if (action === 'release') {
		const room = await releaseHost(platform, params.code, locals.user.id);
		if (!room) return json({ error: 'ไม่สามารถปล่อยเจ้ามือได้' }, { status: 400 });
		return json({ room: await getRoomForUser(platform, room, locals.user.id) });
	}

	return json({ error: 'แอคชั่นไม่ถูกต้อง' }, { status: 400 });
}
