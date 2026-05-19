// Thai timezone (UTC+7) helpers

export function getTodayDateString(): string {
	const now = new Date();
	const thai = new Date(now.getTime() + 7 * 60 * 60 * 1000);
	return thai.toISOString().slice(0, 10);
}

export function isToday(timestamp: number): boolean {
	const now = new Date();
	const thaiNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
	const thaiTs = new Date(timestamp + 7 * 60 * 60 * 1000);
	return thaiNow.toISOString().slice(0, 10) === thaiTs.toISOString().slice(0, 10);
}

export function isYesterday(timestamp: number): boolean {
	const now = new Date();
	const thaiNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
	const thaiTs = new Date(timestamp + 7 * 60 * 60 * 1000);
	const yesterday = new Date(thaiNow);
	yesterday.setUTCDate(yesterday.getUTCDate() - 1);
	return yesterday.toISOString().slice(0, 10) === thaiTs.toISOString().slice(0, 10);
}

// Daily login bonus: index 0 unused, days 1-7
export const LOGIN_BONUS_REWARDS = [0, 10, 20, 30, 50, 75, 100, 500];

// Lucky wheel segments: { label, amount, weight }
export const WHEEL_SEGMENTS = [
	{ label: '5', amount: 5, weight: 30 },
	{ label: '10', amount: 10, weight: 25 },
	{ label: '20', amount: 20, weight: 18 },
	{ label: '50', amount: 50, weight: 12 },
	{ label: '100', amount: 100, weight: 8 },
	{ label: '200', amount: 200, weight: 4 },
	{ label: '500', amount: 500, weight: 2 },
	{ label: '1000', amount: 1000, weight: 1 },
];

export function spinWheel(): { segmentIndex: number; amount: number } {
	const totalWeight = WHEEL_SEGMENTS.reduce((s, seg) => s + seg.weight, 0);
	let rand = Math.random() * totalWeight;
	for (let i = 0; i < WHEEL_SEGMENTS.length; i++) {
		rand -= WHEEL_SEGMENTS[i].weight;
		if (rand <= 0) {
			return { segmentIndex: i, amount: WHEEL_SEGMENTS[i].amount };
		}
	}
	return { segmentIndex: 0, amount: WHEEL_SEGMENTS[0].amount };
}

// Daily missions
export const MISSIONS = [
	{ id: 0, title: 'เล่น 30 รอบ', description: 'เล่นเกมใดก็ได้ 30 รอบ', target: 30, reward: 100, type: 'played' as const },
	{ id: 1, title: 'ชนะ 15 ครั้ง', description: 'ชนะเกมใดก็ได้ 15 ครั้ง', target: 15, reward: 200, type: 'won' as const },
	{ id: 2, title: 'เล่น 5 เกมต่างกัน', description: 'เล่นเกมที่แตกต่างกัน 5 เกม', target: 5, reward: 150, type: 'gamesPlayed' as const },
];
