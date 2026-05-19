import { json } from '@sveltejs/kit';
import { getUser } from '$lib/server/db';
import { isToday, LOGIN_BONUS_REWARDS, WHEEL_SEGMENTS, MISSIONS, getTodayDateString } from '$lib/server/eventHelpers';

export async function GET({ locals, platform }) {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const user = await getUser(platform, locals.user.id);
	if (!user) return json({ error: 'User not found' }, { status: 404 });

	// Daily login — no reset on missed days
	const alreadyClaimed = user.lastLoginBonus ? isToday(user.lastLoginBonus) : false;
	let currentStreak = user.loginStreak ?? 0;
	// If completed cycle (7) and already claimed today, show 7
	// Otherwise next day is currentStreak + 1 (or 1 if >= 7)
	const nextDay = alreadyClaimed ? currentStreak : (currentStreak >= 7 ? 1 : currentStreak + 1);
	const nextReward = LOGIN_BONUS_REWARDS[nextDay] ?? LOGIN_BONUS_REWARDS[1];

	// Wheel
	const canSpin = !user.lastWheelSpin || !isToday(user.lastWheelSpin);

	// Missions
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

	return json({
		dailyLogin: {
			alreadyClaimed,
			currentStreak,
			nextDay,
			nextReward,
			rewards: LOGIN_BONUS_REWARDS
		},
		wheel: {
			canSpin,
			segments: WHEEL_SEGMENTS.map(s => ({ label: s.label, amount: s.amount }))
		},
		missions: missionStatus
	});
}
