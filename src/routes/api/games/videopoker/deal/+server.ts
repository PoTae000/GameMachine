import { json } from '@sveltejs/kit';
import { getUser, saveUser, getConfig, isDBConflict } from '$lib/server/db';
import { createSession, getSession, deleteSession } from '$lib/server/gameSession';
import { getEffectiveWinRate, MAX_BET } from '$lib/server/gameHandler';
import { dealHand } from '$lib/games/videoPokerEngine';

export async function POST({ request, locals, platform }) {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const existing = await getSession(locals.user.id, 'videopoker');

	const { bet } = await request.json();
	if (typeof bet !== 'number' || isNaN(bet) || bet < 1 || bet > MAX_BET) return json({ error: 'Invalid bet' }, { status: 400 });

	const [user, config] = await Promise.all([getUser(platform, locals.user.id), getConfig(platform)]);
	if (!user) return json({ error: 'User not found' }, { status: 404 });

	// Refund existing session bet before starting new game
	if (existing) {
		user.credit += existing.bet;
		await deleteSession(locals.user.id, 'videopoker');
	}

	if (user.credit < bet) return json({ error: 'Insufficient credit' }, { status: 400 });

	user.credit -= bet;

	const winRate = getEffectiveWinRate(user, config, 'videopoker');
	const rareChance = config.gameConfig.videopoker?.rareChance ?? 50;
	const { hand, deck } = dealHand();

	try {
		await saveUser(platform, user);
	} catch (e) {
		if (isDBConflict(e)) return json({ error: 'Server busy, please retry' }, { status: 409 });
		throw e;
	}

	await createSession(locals.user.id, 'videopoker', bet, {
		hand,
		deck,
		winRate,
		rareChance
	});

	return json({
		hand,
		phase: 'holding',
		newCredit: user.credit
	});
}
