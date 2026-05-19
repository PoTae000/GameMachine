import { json } from '@sveltejs/kit';
import { getUser, saveUser, deleteUser } from '$lib/server/db';
import { hashPassword } from '$lib/server/crypto';

export async function DELETE({ params, locals, platform }) {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: 'forbidden' }, { status: 403 });
	}
	const success = await deleteUser(platform, params.id);
	if (success) {
		return json({ success: true });
	}
	return json({ error: 'cannot delete' }, { status: 400 });
}

export async function PATCH({ params, request, locals, platform }) {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: 'forbidden' }, { status: 403 });
	}
	const user = await getUser(platform, params.id);
	if (!user) return json({ error: 'not found' }, { status: 404 });

	const body = await request.json();
	const oldUsername = user.username;

	if (typeof body.credit === 'number') user.credit = Math.max(0, body.credit);
	if (body.username) user.username = body.username;
	if (body.password) user.password = await hashPassword(body.password);
	if (typeof body.customWinRate === 'number') user.customWinRate = Math.max(0, Math.min(100, body.customWinRate));
	if (body.customWinRate === null) delete user.customWinRate;

	await saveUser(platform, user);

	// If username changed, update the username index in KV
	if (body.username && body.username !== oldUsername) {
		const kv = platform!.env.DB;
		await kv.delete(`username:${oldUsername.toLowerCase()}`);
		await kv.put(`username:${body.username.toLowerCase()}`, user.id);
	}

	return json({ success: true, user: { id: user.id, username: user.username, role: user.role, credit: user.credit, customWinRate: user.customWinRate ?? null } });
}
