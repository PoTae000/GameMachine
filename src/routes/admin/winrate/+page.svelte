<script lang="ts">
	import { onMount } from 'svelte';
	import { gameConfig, loadGameConfig, saveGameConfig, type GameConfigEntry } from '$lib/store.svelte';

	onMount(() => {
		loadGameConfig();
		loadUsers();
	});

	const GAMES = ['slot', 'hilo', 'blackjack', 'roulette', 'coinflip', 'pokdeng', 'baccarat', 'dragontiger', 'keno', 'mines', 'wheel', 'plinko', 'crash', 'scratch', 'sicbo', 'videopoker', 'lottery', 'gaogae', 'rps', 'tower', 'luckybox'] as const;

	interface GameMeta {
		name: string;
		icon: string;
		color: string;
		extraFields: ExtraField[];
	}

	interface ExtraField {
		key: keyof GameConfigEntry;
		label: string;
		type: 'range' | 'toggle';
		min?: number;
		max?: number;
		step?: number;
		defaultValue: number | boolean;
		suffix?: string;
	}

	const GAME_META: Record<string, GameMeta> = {
		slot: {
			name: 'สล็อตแมชชีน', icon: '🎰', color: 'bg-purple-500',
			extraFields: [
				{ key: 'scatterChance', label: 'โอกาส Scatter', type: 'range', min: 0, max: 20, step: 0.5, defaultValue: 2.5, suffix: '%' }
			]
		},
		hilo: {
			name: 'ไฮโล', icon: '🃏', color: 'bg-blue-500',
			extraFields: []
		},
		blackjack: {
			name: 'แบล็คแจ็ค', icon: '🂡', color: 'bg-green-600',
			extraFields: [
				{ key: 'dealerBias', label: 'โอกาสเจ้ามือบัสต์', type: 'range', min: 0, max: 100, step: 1, defaultValue: 50, suffix: '%' }
			]
		},
		roulette: {
			name: 'รูเล็ต', icon: '🎡', color: 'bg-red-600',
			extraFields: []
		},
		coinflip: {
			name: 'โยนเหรียญ', icon: '🪙', color: 'bg-yellow-500',
			extraFields: []
		},
		pokdeng: {
			name: 'ป๊อกเด้ง', icon: '🃏', color: 'bg-rose-500',
			extraFields: [
				{ key: 'dealerBias', label: 'โอกาสเจ้ามือป็อก', type: 'range', min: 0, max: 100, step: 1, defaultValue: 50, suffix: '%' }
			]
		},
		baccarat: {
			name: 'บาคาร่า', icon: '🎴', color: 'bg-emerald-600',
			extraFields: [
				{ key: 'dealerBias', label: 'โอกาสแบงเกอร์ชนะ', type: 'range', min: 0, max: 100, step: 1, defaultValue: 50, suffix: '%' }
			]
		},
		dragontiger: {
			name: 'มังกร-เสือ', icon: '🐉', color: 'bg-orange-600',
			extraFields: [
				{ key: 'dealerBias', label: 'โอกาสเสมอ', type: 'range', min: 0, max: 100, step: 1, defaultValue: 50, suffix: '%' }
			]
		},
		keno: {
			name: 'คีโน', icon: '🔢', color: 'bg-indigo-500',
			extraFields: [
				{ key: 'rareChance', label: 'โอกาสตรงเลข', type: 'range', min: 0, max: 100, step: 1, defaultValue: 50, suffix: '%' }
			]
		},
		mines: {
			name: 'ระเบิด', icon: '💣', color: 'bg-gray-600',
			extraFields: [
				{ key: 'mineRelocate', label: 'ย้ายระเบิดอัตโนมัติ', type: 'toggle', defaultValue: true }
			]
		},
		wheel: {
			name: 'วงล้อ', icon: '🎯', color: 'bg-pink-500',
			extraFields: [
				{ key: 'rareChance', label: 'โอกาสรางวัลหายาก', type: 'range', min: 0, max: 100, step: 1, defaultValue: 50, suffix: '%' }
			]
		},
		plinko: {
			name: 'พลิงโกะ', icon: '⚪', color: 'bg-cyan-500',
			extraFields: [
				{ key: 'rareChance', label: 'โอกาสรางวัลหายาก', type: 'range', min: 0, max: 100, step: 1, defaultValue: 50, suffix: '%' }
			]
		},
		crash: {
			name: 'กราฟพุ่ง', icon: '📈', color: 'bg-red-500',
			extraFields: [
				{ key: 'maxMultiplier', label: 'ตัวคูณสูงสุด', type: 'range', min: 1, max: 1000, step: 1, defaultValue: 15, suffix: 'x' }
			]
		},
		scratch: {
			name: 'ขูดการ์ด', icon: '🎫', color: 'bg-amber-600',
			extraFields: [
				{ key: 'rareChance', label: 'โอกาสรางวัลหายาก', type: 'range', min: 0, max: 100, step: 1, defaultValue: 50, suffix: '%' }
			]
		},
		sicbo: {
			name: 'ไฮโลลูกเต๋า', icon: '🎲', color: 'bg-teal-500',
			extraFields: [
				{ key: 'rareChance', label: 'โอกาสตอง', type: 'range', min: 0, max: 100, step: 1, defaultValue: 50, suffix: '%' }
			]
		},
		videopoker: {
			name: 'วิดีโอโป๊กเกอร์', icon: '🃏', color: 'bg-violet-600',
			extraFields: [
				{ key: 'rareChance', label: 'โอกาสมือดี', type: 'range', min: 0, max: 100, step: 1, defaultValue: 50, suffix: '%' }
			]
		},
		lottery: {
			name: 'ลอตเตอรี่', icon: '🎱', color: 'bg-sky-500',
			extraFields: [
				{ key: 'rareChance', label: 'โอกาสตรงเลข', type: 'range', min: 0, max: 100, step: 1, defaultValue: 50, suffix: '%' }
			]
		},
		gaogae: {
			name: 'เก้าเก', icon: '🎴', color: 'bg-rose-600',
			extraFields: [
				{ key: 'dealerBias', label: 'โอกาสเจ้ามือมือดี', type: 'range', min: 0, max: 100, step: 1, defaultValue: 50, suffix: '%' }
			]
		},
		rps: {
			name: 'เป่ายิ้งฉุบ', icon: '✊', color: 'bg-blue-600',
			extraFields: []
		},
		tower: {
			name: 'ปีนตึก', icon: '🏗️', color: 'bg-slate-600',
			extraFields: []
		},
		luckybox: {
			name: 'กล่องโชคดี', icon: '🎁', color: 'bg-purple-500',
			extraFields: []
		},
	};

	// Per-user section
	interface UserData {
		id: string;
		username: string;
		role: string;
		credit: number;
		customWinRate: number | null;
	}

	let users = $state<UserData[]>([]);
	let savingUser = $state<string | null>(null);
	// Remember last custom rate per user so toggling off/on doesn't lose the value
	const lastRates = new Map<string, number>();

	async function loadUsers() {
		try {
			const res = await fetch('/api/admin/users');
			const data = await res.json();
			users = data.filter((u: UserData) => u.role === 'player');
			// Seed remembered rates from existing values
			for (const u of users) {
				if (typeof u.customWinRate === 'number') lastRates.set(u.id, u.customWinRate);
			}
		} catch { /* ignore */ }
	}

	async function setUserWinRate(userId: string, value: number | null) {
		savingUser = userId;
		if (typeof value === 'number') lastRates.set(userId, value);
		try {
			const res = await fetch(`/api/admin/users/${userId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ customWinRate: value })
			});
			if (res.ok) {
				const u = users.find(u => u.id === userId);
				if (u) u.customWinRate = value;
			}
		} catch { /* ignore */ }
		savingUser = null;
	}

	function toggleUserCustom(userId: string, enabled: boolean) {
		if (enabled) {
			const remembered = lastRates.get(userId) ?? 45;
			setUserWinRate(userId, remembered);
		} else {
			setUserWinRate(userId, null);
		}
	}

	// Modal state
	let selectedGame = $state<string | null>(null);
	let modalConfig = $state<GameConfigEntry>({ winRate: 45 });
	let saving = $state(false);

	function openModal(game: string) {
		selectedGame = game;
		const current = gameConfig[game];
		modalConfig = { ...current };
		// Fill in defaults for extra fields not yet set
		const meta = GAME_META[game];
		for (const field of meta.extraFields) {
			if (modalConfig[field.key] === undefined) {
				(modalConfig as any)[field.key] = field.defaultValue;
			}
		}
	}

	function closeModal() {
		selectedGame = null;
	}

	async function saveModal() {
		if (!selectedGame) return;
		saving = true;
		gameConfig[selectedGame] = { ...modalConfig };
		await saveGameConfig(selectedGame, modalConfig);
		saving = false;
		closeModal();
	}
</script>

<svelte:head>
	<title>สูตรโกง - Admin</title>
</svelte:head>

<div class="select-none">
	<!-- Per-user custom Win Rate -->
	<div class="mb-6">
		<p class="mb-1 text-sm font-bold text-slot-accent">อัตราชนะรายคน</p>
		<p class="mb-3 text-[10px] text-slot-muted">กำหนดอัตราชนะเฉพาะคน — ถ้าเปิดจะแทนที่ค่าอัตราชนะปกติทุกเกม</p>
		<div class="overflow-hidden rounded-lg border border-slot-accent/30 bg-slot-accent/5">
			{#each users as user, i}
				{@const hasCustom = typeof user.customWinRate === 'number'}
				<div class="px-4 py-3 {i > 0 ? 'border-t border-slot-accent/20' : ''}">
					<div class="flex items-center gap-3">
						<span class="w-24 shrink-0 truncate text-sm font-medium text-slot-text">{user.username}</span>
						<span class="text-[10px] text-slot-muted">({user.credit.toLocaleString()}฿)</span>
						<div class="ml-auto">
							<label class="flex cursor-pointer items-center gap-2">
								<input
									type="checkbox"
									checked={hasCustom}
									onchange={(e) => toggleUserCustom(user.id, (e.target as HTMLInputElement).checked)}
									class="h-4 w-4 accent-slot-accent"
								/>
								<span class="text-[10px] text-slot-muted">{hasCustom ? 'เปิด' : 'ปิด'}</span>
							</label>
						</div>
					</div>
					{#if hasCustom}
						<div class="mt-2 flex items-center gap-3">
							<input
								type="range"
								min="0"
								max="100"
								value={user.customWinRate}
								oninput={(e) => {
									user.customWinRate = Number((e.target as HTMLInputElement).value);
								}}
								onchange={(e) => {
									setUserWinRate(user.id, Number((e.target as HTMLInputElement).value));
								}}
								class="admin-range flex-1"
								disabled={savingUser === user.id}
							/>
							<span class="w-12 shrink-0 text-right text-sm font-bold tabular-nums text-slot-accent">{user.customWinRate}%</span>
						</div>
					{/if}
				</div>
			{/each}
			{#if users.length === 0}
				<div class="px-4 py-3 text-xs text-slot-muted">ไม่มีผู้เล่น</div>
			{/if}
		</div>
	</div>

	<!-- Game Cards Grid -->
	<p class="mb-3 text-sm font-bold text-slot-text">ตั้งค่าเกม</p>
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
		{#each GAMES as game}
			{@const meta = GAME_META[game]}
			{@const wr = gameConfig[game]?.winRate ?? 45}
			<button
				onclick={() => openModal(game)}
				class="group flex cursor-pointer flex-col items-center rounded-xl border border-slot-border bg-slot-surface p-3 transition hover:border-slot-accent/40 hover:shadow-md active:scale-[0.98] sm:p-4"
			>
				<div class="mb-2 flex h-11 w-11 items-center justify-center rounded-xl {meta.color} text-2xl sm:h-12 sm:w-12 sm:text-3xl">
					{meta.icon}
				</div>
				<p class="text-xs font-bold text-slot-text group-hover:text-slot-accent sm:text-sm">{meta.name}</p>
				<p class="mt-0.5 text-lg font-black tabular-nums text-slot-accent">{wr}%</p>
				{#if meta.extraFields.length > 0}
					<p class="mt-0.5 text-[9px] text-slot-muted">{meta.extraFields.length} ค่าปรับแต่ง</p>
				{/if}
			</button>
		{/each}
	</div>

	<div class="mt-4 flex justify-between text-[10px] text-slot-muted">
		<span>0% = เจ้ามือชนะทุกตา</span>
		<span>50% = ยุติธรรม</span>
		<span>100% = ผู้เล่นชนะทุกตา</span>
	</div>
</div>

<!-- Game Config Modal -->
{#if selectedGame}
	{@const meta = GAME_META[selectedGame]}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
		onkeydown={(e) => { if (e.key === 'Escape') closeModal(); }}
		onclick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
	>
		<div class="w-full max-w-sm rounded-2xl border border-slot-border bg-slot-bg p-5 shadow-2xl">
			<!-- Header -->
			<div class="mb-4 flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-xl {meta.color} text-xl">
					{meta.icon}
				</div>
				<div>
					<p class="text-sm font-bold text-slot-text">{meta.name}</p>
					<p class="text-[10px] text-slot-muted">ตั้งค่าสูตรโกง</p>
				</div>
				<button
					onclick={closeModal}
					class="ml-auto cursor-pointer text-lg text-slot-muted transition hover:text-slot-text"
				>
					&times;
				</button>
			</div>

			<!-- Win Rate slider -->
			<div class="mb-4">
				<div class="mb-1 flex items-center justify-between">
					<span class="text-xs text-slot-muted">อัตราชนะ</span>
					<span class="text-sm font-bold tabular-nums text-slot-accent">{modalConfig.winRate}%</span>
				</div>
				<input
					type="range"
					min="0"
					max="100"
					step="1"
					bind:value={modalConfig.winRate}
					class="admin-range w-full"
				/>
			</div>

			<!-- Extra fields -->
			{#each meta.extraFields as field}
				<div class="mb-4">
					{#if field.type === 'range'}
						{@const val = (modalConfig as any)[field.key] ?? field.defaultValue}
						<div class="mb-1 flex items-center justify-between">
							<span class="text-xs text-slot-muted">{field.label}</span>
							<span class="text-sm font-bold tabular-nums text-slot-text">{val}{field.suffix ?? ''}</span>
						</div>
						<input
							type="range"
							min={field.min ?? 0}
							max={field.max ?? 100}
							step={field.step ?? 1}
							value={val}
							oninput={(e) => {
								(modalConfig as any)[field.key] = Number((e.target as HTMLInputElement).value);
							}}
							class="admin-range w-full"
						/>
					{:else if field.type === 'toggle'}
						{@const checked = (modalConfig as any)[field.key] ?? field.defaultValue}
						<div class="flex items-center justify-between">
							<span class="text-xs text-slot-muted">{field.label}</span>
							<label class="flex cursor-pointer items-center gap-2">
								<input
									type="checkbox"
									checked={checked}
									onchange={(e) => {
										(modalConfig as any)[field.key] = (e.target as HTMLInputElement).checked;
									}}
									class="h-4 w-4 accent-slot-accent"
								/>
								<span class="text-xs font-medium text-slot-text">{checked ? 'เปิด' : 'ปิด'}</span>
							</label>
						</div>
					{/if}
				</div>
			{/each}

			<!-- Save button -->
			<button
				onclick={saveModal}
				disabled={saving}
				class="w-full cursor-pointer rounded-xl bg-slot-accent px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
			>
				{saving ? 'กำลังบันทึก...' : 'บันทึก'}
			</button>
		</div>
	</div>
{/if}

<style>
	.admin-range {
		-webkit-appearance: none;
		appearance: none;
		height: 4px;
		border-radius: 2px;
		background: var(--color-slot-border);
		outline: none;
	}
	.admin-range::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--color-slot-text);
		cursor: pointer;
		border: 2px solid var(--color-slot-bg);
		box-shadow: 0 0 0 1px var(--color-slot-border);
	}
	.admin-range::-moz-range-thumb {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--color-slot-text);
		cursor: pointer;
		border: 2px solid var(--color-slot-bg);
		box-shadow: 0 0 0 1px var(--color-slot-border);
	}
</style>
