import { json } from '@sveltejs/kit';
import { getUser, saveUser } from '$lib/server/db';
import { isToday, spinWheel } from '$lib/server/eventHelpers';

export async function POST({ locals, platform }) {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const user = await getUser(platform, locals.user.id);
	if (!user) return json({ error: 'User not found' }, { status: 404 });

	if (user.lastWheelSpin && isToday(user.lastWheelSpin)) {
		return json({ error: 'Already spun today' }, { status: 400 });
	}

	const result = spinWheel();

	user.credit += result.amount;
	user.lastWheelSpin = Date.now();

	await saveUser(platform, user);

	return json({
		segmentIndex: result.segmentIndex,
		amount: result.amount,
		newCredit: user.credit
	});
}
