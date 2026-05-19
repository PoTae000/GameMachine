import { json } from '@sveltejs/kit';
import { getConfig, saveConfig, getUser } from '$lib/server/db';

export async function GET({ locals, platform }: { locals: any; platform: any }) {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: 'Unauthorized' }, { status: 403 });
	}
	const [config, user] = await Promise.all([
		getConfig(platform),
		getUser(platform, locals.user.id)
	]);
	const result: Record<string, any> = { ...config.gameConfig, _newUserWinRate: config.newUserWinRate ?? 80 };
	result._customWinRate = user?.customWinRate ?? null;
	return json(result);
}

export async function POST({ request, locals, platform }) {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: 'Unauthorized' }, { status: 403 });
	}
	const body = await request.json();
	const config = await getConfig(platform);

	// Handle newUserWinRate update
	if ('newUserWinRate' in body) {
		config.newUserWinRate = Math.max(0, Math.min(100, Number(body.newUserWinRate)));
		await saveConfig(platform, config);
		return json({ success: true, gameConfig: { ...config.gameConfig, _newUserWinRate: config.newUserWinRate } });
	}

	// Handle per-game config update
	const { game, ...configFields } = body;
	if (game && game in config.gameConfig) {
		const entry = (config.gameConfig as unknown as Record<string, Record<string, any>>)[game];
		// Merge config fields
		if ('winRate' in configFields) entry.winRate = Math.max(0, Math.min(100, Number(configFields.winRate)));
		if ('scatterChance' in configFields) entry.scatterChance = Math.max(0, Math.min(100, Number(configFields.scatterChance)));
		if ('dealerBias' in configFields) entry.dealerBias = Math.max(0, Math.min(100, Number(configFields.dealerBias)));
		if ('maxMultiplier' in configFields) entry.maxMultiplier = Math.max(1, Math.min(1000, Number(configFields.maxMultiplier)));
		if ('mineRelocate' in configFields) entry.mineRelocate = Boolean(configFields.mineRelocate);
		if ('payoutMultiplier' in configFields) entry.payoutMultiplier = Math.max(1, Math.min(100, Number(configFields.payoutMultiplier)));
		if ('rareChance' in configFields) entry.rareChance = Math.max(0, Math.min(100, Number(configFields.rareChance)));
		await saveConfig(platform, config);
		return json({ success: true, gameConfig: { ...config.gameConfig, _newUserWinRate: config.newUserWinRate } });
	}
	return json({ success: false }, { status: 400 });
}
