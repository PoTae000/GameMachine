import { json } from '@sveltejs/kit';
import { getUser, saveUser } from '$lib/server/db';
import { MISSIONS, getTodayDateString } from '$lib/server/eventHelpers';

export async function GET({ locals, platform }) {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const user = await getUser(platform, locals.user.id);
	if (!user) return json({ error: 'User not found' }, { status: 404 });

	const today = getTodayDateString();
	const missions = user.missions && user.missions.date === today
		? user.missions
		: { date: today, played: 0, won: 0, gamesPlayed: [], claimed: [false, false, false] };

	const missionStatus = MISSIONS.map((m, i) => {
		let progress = 0;
		if (m.type === 'played') progress = missions.played;
		else if (m.type === 'won') progress = missions.won;
		else if (m.type === 'gamesPlayed') progress = missions.gamesPlayed.length;
		return {
			...m,
			progress,
			completed: progress >= m.target,
			claimed: missions.claimed[i]
		};
	});

	return json({ missions: missionStatus });
}

export async function POST({ request, locals, platform }) {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const { missionId } = await request.json();
	if (typeof missionId !== 'number' || missionId < 0 || missionId >= MISSIONS.length) {
		return json({ error: 'Invalid mission ID' }, { status: 400 });
	}

	const user = await getUser(platform, locals.user.id);
	if (!user) return json({ error: 'User not found' }, { status: 404 });

	const today = getTodayDateString();
	if (!user.missions || user.missions.date !== today) {
		return json({ error: 'No mission progress today' }, { status: 400 });
	}

	if (user.missions.claimed[missionId]) {
		return json({ error: 'Already claimed' }, { status: 400 });
	}

	const mission = MISSIONS[missionId];
	let progress = 0;
	if (mission.type === 'played') progress = user.missions.played;
	else if (mission.type === 'won') progress = user.missions.won;
	else if (mission.type === 'gamesPlayed') progress = user.missions.gamesPlayed.length;

	if (progress < mission.target) {
		return json({ error: 'Mission not completed' }, { status: 400 });
	}

	user.missions.claimed[missionId] = true;
	user.credit += mission.reward;

	await saveUser(platform, user);

	return json({
		reward: mission.reward,
		newCredit: user.credit
	});
}
