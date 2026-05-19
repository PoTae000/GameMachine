import { json } from '@sveltejs/kit';
import { getUser, saveUser, getConfig, isDBConflict } from '$lib/server/db';
import { createSession, getSession, deleteSession } from '$lib/server/gameSession';
import { getEffectiveWinRate, MAX_BET } from '$lib/server/gameHandler';
import { createTowerGame, DIFFICULTY_CONFIG, type Difficulty } from '$lib/games/towerEngine';

const VALID_DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

export async function POST({ request, locals, platform }) {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await request.json();
	const { bet, difficulty: rawDiff, cheat } = body;

	if (typeof bet !== 'number' || isNaN(bet) || bet < 1 || bet > MAX_BET) return json({ error: 'Invalid bet' }, { status: 400 });
	if (!VALID_DIFFICULTIES.includes(rawDiff)) return json({ error: 'Invalid difficulty' }, { status: 400 });
	const difficulty: Difficulty = rawDiff;

	const [user, config] = await Promise.all([getUser(platform, locals.user.id), getConfig(platform)]);
	if (!user) return json({ error: 'User not found' }, { status: 404 });

	// Refund existing session
	const existing = await getSession(locals.user.id, 'tower');
	if (existing) {
		user.credit += existing.bet;
		await deleteSession(locals.user.id, 'tower');
	}

	if (user.credit < bet) return json({ error: 'Insufficient credit' }, { status: 400 });

	user.credit -= bet;

	// Admin cheat mode
	const isAdminCheat = user.role === 'admin' && cheat === true;
	const winRate = isAdminCheat ? 100 : getEffectiveWinRate(user, config, 'tower');

	const game = createTowerGame(difficulty);
	const dConfig = DIFFICULTY_CONFIG[difficulty];

	try {
		await saveUser(platform, user);
	} catch (e) {
		if (isDBConflict(e)) return json({ error: 'Server busy, please retry' }, { status: 409 });
		throw e;
	}

	await createSession(locals.user.id, 'tower', bet, {
		difficulty,
		trapPositions: game.trapPositions,
		floorsCleared: 0,
		gameOver: false,
		winRate
	});

	return json({
		started: true,
		difficulty,
		columns: dConfig.columns,
		floors: dConfig.floors,
		newCredit: user.credit
	});
}
