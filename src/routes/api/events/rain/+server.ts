import { json } from '@sveltejs/kit';
import { getUser, getAllUsers, saveUser, getRainHistory, saveRainHistory, generateId } from '$lib/server/db';
import type { RainEvent } from '$lib/server/db';

export async function GET({ locals, platform }) {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const user = await getUser(platform, locals.user.id);
	if (!user || user.role !== 'admin') return json({ error: 'Forbidden' }, { status: 403 });

	const history = await getRainHistory(platform);
	return json({ history: history.slice(-50).reverse() });
}

export async function POST({ request, locals, platform }) {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const admin = await getUser(platform, locals.user.id);
	if (!admin || admin.role !== 'admin') return json({ error: 'Forbidden' }, { status: 403 });

	const { amountPerUser } = await request.json();
	if (!Number.isInteger(amountPerUser) || amountPerUser < 1) {
		return json({ error: 'Invalid amount' }, { status: 400 });
	}

	const allUsers = await getAllUsers(platform);
	const players = allUsers.filter(u => u.role === 'player');
	if (players.length === 0) {
		return json({ error: 'No players to rain on' }, { status: 400 });
	}

	for (const player of players) {
		player.credit += amountPerUser;
		await saveUser(platform, player);
	}

	const event: RainEvent = {
		id: generateId(),
		adminId: admin.id,
		adminUsername: admin.username,
		amountPerUser,
		totalUsers: players.length,
		totalAmount: amountPerUser * players.length,
		timestamp: Date.now()
	};

	const history = await getRainHistory(platform);
	history.push(event);
	await saveRainHistory(platform, history);

	return json({
		success: true,
		totalUsers: players.length,
		totalAmount: event.totalAmount,
		event
	});
}

export async function DELETE({ locals, platform }) {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const admin = await getUser(platform, locals.user.id);
	if (!admin || admin.role !== 'admin') return json({ error: 'Forbidden' }, { status: 403 });

	await saveRainHistory(platform, []);

	return json({ success: true });
}
