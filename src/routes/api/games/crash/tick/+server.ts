import { json } from '@sveltejs/kit';
import { getSession } from '$lib/server/gameSession';

export async function POST({ request, locals }) {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const session = await getSession(locals.user.id, 'crash');
	if (!session) return json({ error: 'No active game' }, { status: 400 });

	const { multiplier } = await request.json();
	if (typeof multiplier !== 'number' || multiplier < 1) {
		return json({ error: 'Invalid multiplier' }, { status: 400 });
	}

	const crashPoint = session.state.crashPoint;

	// Time-based multiplier validation
	const startedAt = session.state.startedAt;
	if (startedAt) {
		const elapsedMs = Date.now() - startedAt;
		const maxAllowedMultiplier = 1 + (elapsedMs / 1000) * 0.1;
		if (multiplier > maxAllowedMultiplier) {
			return json({ error: 'Invalid multiplier: exceeds time-based maximum' }, { status: 400 });
		}
	}

	if (multiplier >= crashPoint) {
		return json({ crashed: true, crashPoint });
	}

	return json({ crashed: false });
}
