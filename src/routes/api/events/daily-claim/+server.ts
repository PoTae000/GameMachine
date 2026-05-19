import { json } from '@sveltejs/kit';
import { getUser, saveUser } from '$lib/server/db';
import { isToday, LOGIN_BONUS_REWARDS } from '$lib/server/eventHelpers';

export async function POST({ locals, platform }) {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const user = await getUser(platform, locals.user.id);
	if (!user) return json({ error: 'User not found' }, { status: 404 });

	// Check if already claimed today
	if (user.lastLoginBonus && isToday(user.lastLoginBonus)) {
		return json({ error: 'Already claimed today' }, { status: 400 });
	}

	// Advance streak: no reset on missed days, just continue
	// After day 7, reset to day 1
	let streak = user.loginStreak ?? 0;
	if (streak >= 7) streak = 0; // completed cycle, restart
	streak += 1;

	const reward = LOGIN_BONUS_REWARDS[streak] ?? LOGIN_BONUS_REWARDS[1];

	user.credit += reward;
	user.lastLoginBonus = Date.now();
	user.loginStreak = streak;

	await saveUser(platform, user);

	return json({
		reward,
		streak,
		newCredit: user.credit
	});
}
