<script lang="ts">
	import { goto } from '$app/navigation';
	import { currentUser } from '$lib/store.svelte';

	type GameOption = { id: string; name: string; icon: string };

	const GAMES: GameOption[] = [
		{ id: 'blackjack', name: 'แบล็คแจ็ค', icon: '🃏' },
		{ id: 'baccarat', name: 'บาคาร่า', icon: '🎴' },
		{ id: 'pokdeng', name: 'ป๊อกเด้ง', icon: '🂡' },
		{ id: 'dragontiger', name: 'มังกรเสือ', icon: '🐉' },
		{ id: 'hilo', name: 'ไฮโล', icon: '🔼' },
		{ id: 'videopoker', name: 'วิดีโอโป๊กเกอร์', icon: '🃏' },
		{ id: 'roulette', name: 'รูเล็ต', icon: '🎡' },
		{ id: 'gaogae', name: 'เก้าเก', icon: '🎴' }
	];

	let selectedGame = $state('blackjack');
	let joinCode = $state('');
	let creating = $state(false);
	let joining = $state(false);
	let error = $state('');

	async function createRoom() {
		creating = true;
		error = '';
		try {
			const res = await fetch('/api/room/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ game: selectedGame })
			});
			const data = await res.json();
			if (!res.ok) {
				error = data.error || 'สร้างห้องไม่ได้';
				return;
			}
			goto(`/room/${data.room.code}`);
		} catch {
			error = 'เกิดข้อผิดพลาด';
		} finally {
			creating = false;
		}
	}

	async function joinRoom() {
		const code = joinCode.toUpperCase().trim();
		if (!code || code.length !== 6) {
			error = 'กรุณาใส่รหัสห้อง 6 หลัก';
			return;
		}
		joining = true;
		error = '';
		try {
			const res = await fetch('/api/room/join', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code })
			});
			const data = await res.json();
			if (!res.ok) {
				error = data.error || 'เข้าห้องไม่ได้';
				return;
			}
			goto(`/room/${data.room.code}`);
		} catch {
			error = 'เกิดข้อผิดพลาด';
		} finally {
			joining = false;
		}
	}
</script>

<svelte:head>
	<title>ห้องเล่นกับเพื่อน - BUNG TAE DUBAI</title>
</svelte:head>

<div class="mx-auto max-w-md space-y-6">
	<h1 class="text-center text-lg font-bold text-slot-text sm:text-xl">&#127918; ห้องเล่นกับเพื่อน</h1>

	{#if error}
		<div class="animate-fade-in rounded-lg bg-slot-lose/10 border border-slot-lose/30 px-4 py-2.5 text-center text-xs font-medium text-slot-lose">
			{error}
		</div>
	{/if}

	<!-- Create Room -->
	<div class="rounded-2xl border border-slot-border bg-slot-surface p-5 shadow-sm">
		<h2 class="mb-3 text-sm font-bold text-slot-text">สร้างห้อง</h2>
		<p class="mb-3 text-[11px] text-slot-muted">เลือกเกมที่ต้องการ แล้วแชร์รหัสให้เพื่อนเข้าร่วม</p>

		<div class="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
			{#each GAMES as game}
				<button
					onclick={() => (selectedGame = game.id)}
					class="cursor-pointer rounded-xl border px-3 py-2.5 text-center transition
						{selectedGame === game.id
							? 'border-slot-accent bg-slot-accent/10 text-slot-accent shadow-sm'
							: 'border-slot-border bg-slot-bg text-slot-muted hover:border-slot-accent/40 hover:text-slot-text'}"
				>
					<div class="text-lg">{game.icon}</div>
					<div class="mt-0.5 text-[10px] font-bold sm:text-[11px]">{game.name}</div>
				</button>
			{/each}
		</div>

		<button
			onclick={createRoom}
			disabled={creating}
			class="w-full cursor-pointer rounded-xl bg-slot-accent px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
		>
			{creating ? 'กำลังสร้าง...' : 'สร้างห้อง'}
		</button>
	</div>

	<!-- Join Room -->
	<div class="rounded-2xl border border-slot-border bg-slot-surface p-5 shadow-sm">
		<h2 class="mb-3 text-sm font-bold text-slot-text">เข้าร่วมห้อง</h2>
		<p class="mb-3 text-[11px] text-slot-muted">ใส่รหัสห้อง 6 หลักที่ได้จากเพื่อน</p>

		<div class="flex gap-2">
			<input
				type="text"
				bind:value={joinCode}
				placeholder="เช่น A3F2K9"
				maxlength="6"
				class="flex-1 rounded-lg border border-slot-border bg-slot-bg px-4 py-2.5 text-center text-sm font-bold uppercase tracking-[0.3em] outline-none focus:border-slot-accent [appearance:textfield]"
			/>
			<button
				onclick={joinRoom}
				disabled={joining || joinCode.trim().length < 6}
				class="cursor-pointer rounded-xl bg-slot-win px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
			>
				{joining ? '...' : 'เข้าร่วม'}
			</button>
		</div>
	</div>

	<p class="text-center text-[10px] text-slot-muted">
		สร้างห้อง → แชร์รหัส → เพื่อนเข้าร่วม → ใครอยากเป็นเจ้ามือก็ได้!
	</p>
</div>
