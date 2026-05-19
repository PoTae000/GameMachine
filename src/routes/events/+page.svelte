<script lang="ts">
	import { onMount } from 'svelte';
	import { eventStatus, loadEventStatus, claimDailyLogin, spinLuckyWheel, claimMission, loadCredit } from '$lib/store.svelte';

	let claimingDaily = $state(false);
	let spinning = $state(false);
	let wheelRotation = $state(0);
	let wheelResult = $state<{ amount: number } | null>(null);
	let claimingMission = $state<number | null>(null);
	let toast = $state('');

	onMount(() => {
		loadEventStatus();
	});

	function showToast(msg: string) {
		toast = msg;
		setTimeout(() => { toast = ''; }, 2500);
	}

	async function handleClaimDaily() {
		claimingDaily = true;
		const result = await claimDailyLogin();
		claimingDaily = false;
		if (result) {
			showToast(`+${result.reward} เครดิต (วันที่ ${result.streak})`);
		}
	}

	async function handleSpin() {
		if (spinning) return;
		spinning = true;
		wheelResult = null;
		const result = await spinLuckyWheel();
		if (result) {
			const segIdx = result.segmentIndex;
			const segAngle = 360 / 8;
			const targetAngle = 360 * 5 + (270 - segIdx * segAngle - segAngle / 2);
			wheelRotation = targetAngle;
			setTimeout(() => {
				wheelResult = { amount: result.amount };
				spinning = false;
				showToast(`+${result.amount} เครดิต!`);
			}, 4000);
		} else {
			spinning = false;
		}
	}

	async function handleClaimMission(id: number) {
		claimingMission = id;
		const result = await claimMission(id);
		claimingMission = null;
		if (result) {
			showToast(`+${result.reward} เครดิต!`);
		}
	}

	const WHEEL_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#c0392b'];
	const WHEEL_LABELS = ['5', '10', '20', '50', '100', '200', '500', '1000'];
</script>

<svelte:head><title>กิจกรรม - BUNG TAE DUBAI</title></svelte:head>

{#if toast}
	<div class="fixed top-14 left-1/2 z-[60] -translate-x-1/2 animate-slide-down rounded-xl bg-slot-accent px-5 py-2.5 text-sm font-bold text-white shadow-lg">
		{toast}
	</div>
{/if}

<div class="select-none">
	<div class="mb-6 text-center">
		<h1 class="mb-1 text-2xl font-bold text-slot-accent sm:text-3xl">กิจกรรม</h1>
		<p class="text-xs text-slot-muted sm:text-sm">รับเครดิตฟรีทุกวัน!</p>
	</div>

	{#if eventStatus.value}
		<!-- Daily Login -->
		<section class="mb-6 rounded-2xl border border-slot-border bg-slot-surface p-4 casino-shadow sm:p-6 animate-fade-in">
			<h2 class="mb-3 text-sm font-bold text-slot-text sm:text-base">เข้าสู่ระบบรายวัน</h2>
			<div class="mb-3 grid grid-cols-7 gap-1.5 sm:gap-2">
				{#each [1,2,3,4,5,6,7] as day}
					{@const rewards = eventStatus.value.dailyLogin.rewards}
					{@const streak = eventStatus.value.dailyLogin.currentStreak}
					{@const claimed = eventStatus.value.dailyLogin.alreadyClaimed}
					{@const isDone = day <= streak && (day < streak || claimed)}
					{@const isNext = !claimed && day === (streak >= 7 ? 1 : streak + 1)}
					<div class="flex flex-col items-center rounded-lg border p-1.5 sm:p-2 text-center transition-all
						{isDone ? 'border-slot-win/40 bg-slot-win/10' : isNext ? 'border-slot-accent/60 bg-slot-accent/10 streak-pulse' : 'border-slot-border bg-slot-bg'}">
						<span class="text-[9px] text-slot-muted sm:text-[10px]">วัน {day}</span>
						<span class="text-xs font-bold tabular-nums sm:text-sm {isDone ? 'text-slot-win' : 'text-slot-text'}">{rewards[day]}</span>
						{#if isDone}
							<span class="text-[8px] text-slot-win">&#10003;</span>
						{/if}
					</div>
				{/each}
			</div>
			<button
				onclick={handleClaimDaily}
				disabled={eventStatus.value.dailyLogin.alreadyClaimed || claimingDaily}
				class="w-full cursor-pointer rounded-xl bg-slot-accent px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
			>
				{#if eventStatus.value.dailyLogin.alreadyClaimed}
					รับแล้ววันนี้ &#10003;
				{:else if claimingDaily}
					กำลังรับ...
				{:else}
					รับเครดิต +{eventStatus.value.dailyLogin.nextReward}
				{/if}
			</button>
		</section>

		<!-- Lucky Wheel -->
		<section class="mb-6 rounded-2xl border border-slot-border bg-slot-surface p-4 casino-shadow sm:p-6 animate-fade-in">
			<h2 class="mb-4 text-sm font-bold text-slot-text sm:text-base">กงล้อนำโชค</h2>
			<div class="flex flex-col items-center gap-4">
				<!-- Wheel -->
				<div class="relative">
					<!-- Arrow pointer -->
					<div class="absolute -top-2 left-1/2 z-10 -translate-x-1/2 text-slot-accent text-xl">&#9660;</div>
					<svg
						viewBox="0 0 300 300"
						class="h-52 w-52 sm:h-64 sm:w-64 drop-shadow-lg"
						style="transform: rotate({wheelRotation}deg); transition: transform {spinning ? '4s' : '0s'} cubic-bezier(0.17, 0.67, 0.12, 0.99);"
					>
						{#each WHEEL_LABELS as label, i}
							{@const angle = (i * 360) / 8}
							{@const rad1 = (angle * Math.PI) / 180}
							{@const rad2 = ((angle + 45) * Math.PI) / 180}
							{@const x1 = 150 + 140 * Math.cos(rad1)}
							{@const y1 = 150 + 140 * Math.sin(rad1)}
							{@const x2 = 150 + 140 * Math.cos(rad2)}
							{@const y2 = 150 + 140 * Math.sin(rad2)}
							<path
								d="M150,150 L{x1},{y1} A140,140 0 0,1 {x2},{y2} Z"
								fill={WHEEL_COLORS[i]}
								stroke="rgba(255,255,255,0.3)"
								stroke-width="1"
							/>
							{@const midAngle = angle + 22.5}
							{@const textRad = (midAngle * Math.PI) / 180}
							{@const tx = 150 + 95 * Math.cos(textRad)}
							{@const ty = 150 + 95 * Math.sin(textRad)}
							<text
								x={tx}
								y={ty}
								text-anchor="middle"
								dominant-baseline="central"
								fill="white"
								font-size="16"
								font-weight="bold"
								transform="rotate({midAngle}, {tx}, {ty})"
							>{label}</text>
						{/each}
						<circle cx="150" cy="150" r="25" fill="var(--color-slot-surface)" stroke="var(--color-slot-border)" stroke-width="2" />
					</svg>
				</div>

				{#if wheelResult}
					<div class="animate-bounce-in text-center">
						<p class="text-lg font-bold text-slot-win sm:text-xl">+{wheelResult.amount} เครดิต!</p>
					</div>
				{/if}

				<button
					onclick={handleSpin}
					disabled={!eventStatus.value.wheel.canSpin || spinning}
					class="cursor-pointer rounded-xl bg-slot-accent px-6 py-2.5 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
				>
					{#if spinning}
						กำลังหมุน...
					{:else if !eventStatus.value.wheel.canSpin}
						หมุนแล้ววันนี้ &#10003;
					{:else}
						หมุนฟรี!
					{/if}
				</button>
			</div>
		</section>

		<!-- Daily Missions -->
		<section class="rounded-2xl border border-slot-border bg-slot-surface p-4 casino-shadow sm:p-6 animate-fade-in">
			<h2 class="mb-3 text-sm font-bold text-slot-text sm:text-base">ภารกิจประจำวัน</h2>
			<div class="space-y-3">
				{#each eventStatus.value.missions as mission, i}
					<div class="rounded-xl border border-slot-border bg-slot-bg p-3 sm:p-4">
						<div class="mb-1 flex items-center justify-between">
							<div>
								<p class="text-xs font-bold text-slot-text sm:text-sm">{mission.title}</p>
								<p class="text-[10px] text-slot-muted sm:text-[11px]">{mission.description}</p>
							</div>
							<span class="shrink-0 rounded-md bg-slot-accent/10 px-2 py-0.5 text-[10px] font-bold text-slot-accent sm:text-xs">
								+{mission.reward}
							</span>
						</div>
						<!-- Progress bar -->
						<div class="mb-2 h-2 overflow-hidden rounded-full bg-slot-border">
							<div
								class="h-full rounded-full transition-all duration-500 {mission.completed ? 'bg-slot-win' : 'bg-slot-accent'}"
								style="width: {Math.min(mission.progress / mission.target * 100, 100)}%"
							></div>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-[10px] tabular-nums text-slot-muted sm:text-[11px]">
								{Math.min(mission.progress, mission.target)} / {mission.target}
							</span>
							{#if mission.claimed}
								<span class="text-[10px] font-bold text-slot-win sm:text-xs">รับแล้ว &#10003;</span>
							{:else if mission.completed}
								<button
									onclick={() => handleClaimMission(mission.id)}
									disabled={claimingMission === mission.id}
									class="cursor-pointer rounded-lg bg-slot-win px-3 py-1 text-[10px] font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50 sm:text-xs"
								>
									{claimingMission === mission.id ? '...' : 'รับรางวัล'}
								</button>
							{:else}
								<span class="text-[10px] text-slot-muted sm:text-[11px]">ยังไม่สำเร็จ</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</section>
	{:else}
		<div class="flex min-h-[30vh] items-center justify-center">
			<p class="text-sm text-slot-muted animate-pulse">กำลังโหลด...</p>
		</div>
	{/if}
</div>
