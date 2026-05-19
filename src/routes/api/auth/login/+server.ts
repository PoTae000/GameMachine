import { json } from '@sveltejs/kit';
import { getUserByUsername, saveUser, createAuthSession } from '$lib/server/db';
import { verifyPassword, hashPassword, isHashed } from '$lib/server/crypto';

export async function POST({ request, cookies, platform }) {
	const { username, password } = await request.json();
	const user = await getUserByUsername(platform, username);

	if (user && await verifyPassword(password, user.password)) {
		// Migrate plaintext password to hashed on successful login
		if (!isHashed(user.password)) {
			user.password = await hashPassword(password);
			await saveUser(platform, user);
		}
		const session = await createAuthSession(platform, user.id);
		cookies.set('session', session.token, {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'strict',
			maxAge: 24 * 60 * 60
		});
		return json({
			success: true,
			user: {
				id: user.id,
				username: user.username,
				role: user.role,
				isNewUser: user.isNewUser ?? false,
				totalDeposited: user.totalDeposited ?? 0
			}
		});
	}
	return json({ success: false }, { status: 401 });
}
