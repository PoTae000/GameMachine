<script lang="ts">
	import { onMount } from 'svelte';
	import { currentUser } from '$lib/store.svelte';

	interface AdminUser {
		id: string;
		username: string;
		role: string;
		credit: number;
		stats: { totalSpent: number; totalReceived: number };
		requestCount: number;
		isNewUser: boolean;
		totalDeposited: number;
	}

	let users: AdminUser[] = $state([]);
	let showAddUser = $state(false);
	let newUsername = $state('');
	let newPassword = $state('');
	let addUserError = $state('');

	let showDeduct = $state(false);
	let deductAmount = $state(100);
	let deductUserId = $state('');
	let deductTarget = $derived(users.find(u => u.id === deductUserId));

	let playerUsers = $derived(users.filter(u => u.role !== 'admin'));

	onMount(() => {
		loadUsers();
		const interval = setInterval(() => {
			if (currentUser.value?.role === 'admin') loadUsers();
		}, 3000);
		return () => clearInterval(interval);
	});

	async function loadUsers() {
		try {
			const res = await fetch('/api/admin/users');
			if (res.ok) users = await res.json();
		} catch { /* ignore */ }
	}

	async function addUser() {
		addUserError = '';
		if (!newUsername || !newPassword) {
			addUserError = 'กรุณากรอกข้อมูลให้ครบ';
			return;
		}
		const res = await fetch('/api/admin/users', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: newUsername, password: newPassword })
		});
		if (res.ok) {
			showAddUser = false;
			newUsername = '';
			newPassword = '';
			loadUsers();
		} else {
			const data = await res.json();
			addUserError = data.error === 'username taken' ? 'ชื่อนี้มีอยู่แล้ว' : 'เกิดข้อผิดพลาด';
		}
	}

	async function removeUser(id: string) {
		if (!confirm('ยืนยันลบผู้ใช้?')) return;
		await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
		loadUsers();
	}

	async function submitDeduct() {
		if (!deductAmount || deductAmount < 1 || isNaN(deductAmount) || !deductUserId) return;
		const amount = Math.floor(deductAmount);
		const target = users.find(u => u.id === deductUserId);
		if (!target || amount > target.credit) return;

		await fetch(`/api/admin/users/${deductUserId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ credit: target.credit - amount })
		});
		showDeduct = false;
		loadUsers();
	}

</script>

<svelte:head>
	<title>ผู้ใช้ - Admin - BUNG TAE DUBAI</title>
</svelte:head>

{#if showAddUser}
	<div class="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
		<div class="w-full max-w-xs rounded-xl border border-slot-border bg-slot-surface p-5 shadow-lg">
			<p class="mb-4 text-sm font-bold text-slot-text">เพิ่มผู้ใช้ใหม่</p>
			<input
				type="text"
				bind:value={newUsername}
				placeholder="Username"
				class="mb-2 w-full rounded-lg border border-slot-border bg-slot-bg px-3 py-2 text-sm outline-none focus:border-slot-accent"
			/>
			<input
				type="password"
				bind:value={newPassword}
				placeholder="Password"
				class="mb-3 w-full rounded-lg border border-slot-border bg-slot-bg px-3 py-2 text-sm outline-none focus:border-slot-accent"
			/>
			{#if addUserError}
				<p class="mb-2 text-xs text-slot-lose">{addUserError}</p>
			{/if}
			<div class="flex gap-2">
				<button
					onclick={() => (showAddUser = false)}
					class="flex-1 cursor-pointer rounded-lg border border-slot-border px-3 py-2 text-sm text-slot-muted transition hover:bg-slot-bg"
				>
					ยกเลิก
				</button>
				<button
					onclick={addUser}
					disabled={!newUsername || !newPassword}
					class="flex-1 cursor-pointer rounded-lg bg-slot-accent px-3 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-40"
				>
					เพิ่ม
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showDeduct}
	<div class="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
		<div class="w-full max-w-xs rounded-xl border border-slot-border bg-slot-surface p-5 shadow-lg">
			<p class="mb-1 text-sm font-bold text-slot-text">หักเงิน</p>
			<p class="mb-4 text-[11px] text-slot-muted">คงเหลือ {deductTarget?.credit.toLocaleString() ?? 0}</p>
			<input
				type="number"
				bind:value={deductAmount}
				min="1"
				max={deductTarget?.credit ?? 0}
				class="mb-4 w-full rounded-lg border border-slot-border bg-slot-bg px-3 py-2.5 text-center text-lg font-bold tabular-nums outline-none focus:border-slot-text [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
			/>
			<div class="flex gap-2">
				<button
					onclick={() => (showDeduct = false)}
					class="flex-1 cursor-pointer rounded-lg border border-slot-border px-3 py-2 text-sm text-slot-muted transition hover:bg-slot-bg"
				>
					ยกเลิก
				</button>
				<button
					onclick={submitDeduct}
					disabled={!deductAmount || deductAmount < 1 || (deductTarget && deductAmount > deductTarget.credit)}
					class="flex-1 cursor-pointer rounded-lg bg-slot-text px-3 py-2 text-sm font-medium text-slot-bg transition hover:opacity-80 active:scale-[0.98] disabled:opacity-30"
				>
					หัก
				</button>
			</div>
		</div>
	</div>
{/if}

<div class="select-none">
	<!-- User Management -->
	<div class="mb-3 flex items-center justify-between">
			<h2 class="text-xs font-bold text-slot-text sm:text-sm">ผู้ใช้ ({playerUsers.length})</h2>
			<button
				onclick={() => { newUsername = ''; newPassword = ''; addUserError = ''; showAddUser = true; }}
				class="cursor-pointer rounded-lg bg-slot-accent px-2.5 py-1 text-[11px] font-bold text-white transition hover:brightness-110 sm:px-3 sm:py-1.5 sm:text-xs"
			>
				+ เพิ่มผู้ใช้
			</button>
		</div>

		{#if playerUsers.length === 0}
			<p class="text-[11px] text-slot-muted sm:text-xs">ยังไม่มีผู้ใช้</p>
		{:else}
			<div class="overflow-hidden rounded-lg border border-slot-border">
				{#each playerUsers as user, i}
					<div class="flex items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-2.5 {i > 0 ? 'border-t border-slot-border' : ''}">
						<div class="flex min-w-0 items-center gap-2 sm:gap-3">
							<div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slot-accent/10 text-[10px] font-bold text-slot-accent sm:h-8 sm:w-8 sm:text-xs">
								{user.username.charAt(0).toUpperCase()}
							</div>
							<div class="min-w-0">
								<div class="flex items-center gap-1.5">
									<span class="truncate text-xs font-medium text-slot-text sm:text-sm">{user.username}</span>
									{#if user.isNewUser}
										<span class="rounded bg-slot-accent/15 px-1 py-0.5 text-[8px] font-bold text-slot-accent">NEW</span>
									{/if}
								</div>
								<p class="text-[9px] text-slot-muted sm:text-[10px]">
									เครดิต: {user.credit.toLocaleString()} | ได้: {user.stats.totalReceived.toLocaleString()} | เสีย: {user.stats.totalSpent.toLocaleString()}
								</p>
							</div>
						</div>
						<div class="flex shrink-0 items-center gap-1.5 sm:gap-2">
							<button
								onclick={() => { deductUserId = user.id; deductAmount = 100; showDeduct = true; }}
								class="cursor-pointer text-[9px] text-slot-muted underline decoration-dotted hover:text-slot-text sm:text-[10px]"
							>
								หักเงิน
							</button>
							<button
								onclick={() => removeUser(user.id)}
								class="cursor-pointer text-[9px] text-slot-lose hover:text-red-400 sm:text-[10px]"
							>
								ลบ
							</button>
						</div>
					</div>
				{/each}
			</div>
	{/if}
</div>
