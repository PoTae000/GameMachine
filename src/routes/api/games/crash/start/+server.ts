import { json } from '@sveltejs/kit';
import { getUser, saveUser, getConfig, isDBConflict } from '$lib/server/db';
import { createSession, getSession, deleteSession } from '$lib/server/gameSession';
import { getEffectiveWinRate, MAX_BET } from '$lib/server/gameHandler';
import { generateCrashPoint } from '$lib/games/crashEngine';

export async function POST({ request, locals, platform }) {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	// Check for existing session and refund if needed
	const existing = await getSession(locals.user.id, 'crash');

	const { bet } = await request.json();
	if (typeof bet !== 'number' || isNaN(bet) || bet < 1 || bet > MAX_BET) return json({ error: 'Invalid bet' }, { status: 400 });

	const [user, config] = await Promise.all([getUser(platform, locals.user.id), getConfig(platform)]);
	if (!user) return json({ error: 'User not found' }, { status: 404 });

	// Refund existing session bet before starting new game
	if (existing) {
		user.credit += existing.bet;
		await deleteSession(locals.user.id, 'crash');
	}

	if (user.credit < bet) return json({ error: 'Insufficient credit' }, { status: 400 });

	// Deduct bet
	user.credit -= bet;

	const winRate = getEffectiveWinRate(user, config, 'crash');
	const gameConfig = config.gameConfig.crash;
	const crashPoint = generateCrashPoint(winRate, gameConfig?.maxMultiplier ?? 15);

	try {
		await saveUser(platform, user);
	} catch (e) {
		if (isDBConflict(e)) return json({ error: 'Server busy, please retry' }, { status: 409 });
		throw e;
	}

	// Store crash point and start time in session (hidden from client)
	await createSession(locals.user.id, 'crash', bet, { crashPoint, startedAt: Date.now() });

	return json({
		started: true,
		newCredit: user.credit
	});
}
