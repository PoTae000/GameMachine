import { json } from '@sveltejs/kit';
import { getAllUsers, saveUser } from '$lib/server/db';

export async function POST({ locals, platform }) {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: 'forbidden' }, { status: 403 });
	}

	const users = await getAllUsers(platform);
	let count = 0;
	for (const user of users) {
		if (user.role === 'player') {
			user.stats = { totalSpent: 0, totalReceived: 0 };
			user.missions = undefined;
			user.lastLoginBonus = undefined;
			user.loginStreak = undefined;
			user.lastWheelSpin = undefined;
			await saveUser(platform, user);
			count++;
		}
	}

	return json({ success: true, count });
}
