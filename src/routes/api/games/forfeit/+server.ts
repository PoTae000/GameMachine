import { json } from '@sveltejs/kit';
import { getUser, saveUser, isDBConflict } from '$lib/server/db';
import { getSession, deleteSession } from '$lib/server/gameSession';
import { trackMission } from '$lib/server/gameHandler';

const VALID_GAMES = ['blackjack', 'videopoker', 'pokdeng', 'crash', 'mines', 'hilo', 'tower'];

export async function POST({ request, locals, platform }) {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const { game } = await request.json();
	if (!game || !VALID_GAMES.includes(game)) return json({ error: 'Invalid game' }, { status: 400 });

	const session = await getSession(locals.user.id, game);
	if (!session) return json({ error: 'No active session' }, { status: 400 });

	const bet = session.bet;
	await deleteSession(locals.user.id, game);

	const user = await getUser(platform, locals.user.id);
	if (!user) return json({ error: 'User not found' }, { status: 404 });

	// Count forfeit as a loss: bet was already deducted at deal time, so just track stats
	user.stats.totalSpent += bet;

	// Mission tracking (played +1, not won)
	trackMission(user, game, false);

	try {
		await saveUser(platform, user);
	} catch (e) {
		if (isDBConflict(e)) return json({ error: 'Server busy, please retry' }, { status: 409 });
		throw e;
	}

	return json({ success: true, newCredit: user.credit });
}
