import { json } from '@sveltejs/kit';
import { getUser, saveUser, isDBConflict } from '$lib/server/db';
import { getSession, deleteSession, updateSession } from '$lib/server/gameSession';
import { trackMission } from '$lib/server/gameHandler';
import { biasedDraw, evaluateHiLo, HILO_MULTIPLIER, type HiLoGuess } from '$lib/games/hiloEngine';

export async function POST({ request, locals, platform }) {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const session = await getSession(locals.user.id, 'hilo');
	if (!session) return json({ error: 'No active game' }, { status: 400 });

	const { guess } = await request.json();
	if (guess !== 'high' && guess !== 'low') {
		return json({ error: 'Invalid guess' }, { status: 400 });
	}

	const { deck, currentCard, winRate, potentialWin, streak } = session.state;
	const { card: nextCard, remaining } = biasedDraw(currentCard, guess as HiLoGuess, deck, winRate);
	const won = evaluateHiLo(currentCard, nextCard, guess as HiLoGuess);

	if (won) {
		const newPotentialWin = Math.round(potentialWin * HILO_MULTIPLIER * 100) / 100;
		session.state.deck = remaining;
		session.state.currentCard = nextCard;
		session.state.streak = streak + 1;
		session.state.potentialWin = newPotentialWin;
		await updateSession(locals.user.id, 'hilo', session);

		return json({
			won: true,
			nextCard,
			currentCard: nextCard,
			streak: streak + 1,
			potentialWin: newPotentialWin
		});
	} else {
		// Lost
		await deleteSession(locals.user.id, 'hilo');

		const user = await getUser(platform, locals.user.id);
		if (!user) return json({ error: 'User not found' }, { status: 404 });

		user.stats.totalSpent += session.bet;
		trackMission(user, 'hilo', false);
		try {
			await saveUser(platform, user);
		} catch (e) {
			if (isDBConflict(e)) return json({ error: 'Server busy, please retry' }, { status: 409 });
			throw e;
		}

		return json({
			won: false,
			nextCard,
			payout: 0,
			newCredit: user.credit,
			stats: { totalSpent: user.stats.totalSpent, totalReceived: user.stats.totalReceived }
		});
	}
}
