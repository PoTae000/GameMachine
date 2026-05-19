import { createGameHandler } from '$lib/server/gameHandler';
import { simulateDrop, getMultipliers, type RiskLevel } from '$lib/games/plinkoEngine';

const VALID_RISKS: RiskLevel[] = ['low', 'medium', 'high'];

export const POST = createGameHandler('plinko', ({ bet, gameParams, winRate, gameConfig }) => {
	const risk: RiskLevel = gameParams.risk;
	if (!VALID_RISKS.includes(risk)) {
		throw new Error('Invalid risk level');
	}

	const rareChance = gameConfig.rareChance ?? 50;
	const { path, bucket } = simulateDrop(risk, winRate, rareChance);
	const multipliers = getMultipliers(risk);
	const multiplier = multipliers[bucket] ?? 0;
	const payout = Math.round(bet * multiplier * 100) / 100;
	const won = multiplier >= 1.5;

	return {
		outcome: { path, bucket, multiplier },
		payout,
		won
	};
});
