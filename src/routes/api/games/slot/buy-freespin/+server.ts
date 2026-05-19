import { json } from '@sveltejs/kit';
import { getUser, saveUser, isDBConflict } from '$lib/server/db';
import { getSession, createSession } from '$lib/server/gameSession';

const FREE_SPIN_PRICE = 150;
const FREE_SPIN_COUNT = 10;

export async function POST({ locals, platform }) {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const user = await getUser(platform, locals.user.id);
	if (!user) return json({ error: 'User not found' }, { status: 404 });
	if (user.credit < FREE_SPIN_PRICE) return json({ error: 'Insufficient credit' }, { status: 400 });

	user.credit -= FREE_SPIN_PRICE;
	user.stats.totalSpent += FREE_SPIN_PRICE;

	try {
		await saveUser(platform, user);
	} catch (e) {
		if (isDBConflict(e)) return json({ error: 'Server busy, please retry' }, { status: 409 });
		throw e;
	}

	// Track purchased free spins in KV session
	const existing = await getSession(locals.user.id, 'slot-freespin');
	const currentSpins = existing?.state?.spinsRemaining ?? 0;
	await createSession(locals.user.id, 'slot-freespin', 0, {
		spinsRemaining: currentSpins + FREE_SPIN_COUNT
	});

	return json({
		success: true,
		newCredit: user.credit,
		freeSpinsRemaining: currentSpins + FREE_SPIN_COUNT,
		stats: { totalSpent: user.stats.totalSpent, totalReceived: user.stats.totalReceived }
	});
}
