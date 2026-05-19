<script lang="ts">
	import { onMount } from 'svelte';
	import {
		currentUser,
		topUpRequests,
		loadRequests,
		loadCredit,
		loadStats,
		approveRequest,
		rejectRequest,
		triggerRain,
		resetAllCredits,
		resetAllHistory
	} from '$lib/store.svelte';

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

	onMount(() => {
		loadRequests();
		loadCredit();
		loadStats();
		loadUsers();
		loadRainHistory();
		const interval = setInterval(() => {
			if (currentUser.value?.role === 'admin') {
				loadRequests();
				loadUsers();
			}
		}, 3000);
		return () => clearInterval(interval);
	});

	async function loadUsers() {
		try {
			const res = await fetch('/api/admin/users');
			if (res.ok) users = await res.json();
		} catch { /* ignore */ }
	}

	// Rain system
	let rainAmount = $state(10);
	let rainLoading = $state(false);
	let rainResult = $state<{ totalUsers: number; totalAmount: number } | null>(null);
	let resetCreditLoading = $state(false);
	let resetHistoryLoading = $state(false);
	let resetCreditResult = $state('');
	let resetHistoryResult = $state('');
	let showResetCreditConfirm = $state(false);
	let showResetHistoryConfirm = $state(false);

	async function handleResetCredits() {
		showResetCreditConfirm = false;
		resetCreditLoading = true;
		const result = await resetAllCredits();
		resetCreditLoading = false;
		if (result) {
			resetCreditResult = `รีเซ็ทเงินสำเร็จ ${result.count} คน`;
			setTimeout(() => { resetCreditResult = ''; }, 3000);
			loadUsers();
		}
	}

	async function handleResetHistory() {
		showResetHistoryConfirm = false;
		resetHistoryLoading = true;
		const result = await resetAllHistory();
		resetHistoryLoading = false;
		if (result) {
			resetHistoryResult = `รีเซ็ทประวัติสำเร็จ ${result.count} คน`;
			setTimeout(() => { resetHistoryResult = ''; }, 3000);
			loadUsers();
		}
	}
	let rainHistory = $state<any[]>([]);
	let showRainHistory = $state(false);

	async function handleRain() {
		if (rainLoading || !rainAmount || rainAmount < 1) return;
		rainLoading = true;
		const result = await triggerRain(Math.floor(rainAmount));
		rainLoading = false;
		if (result) {
			rainResult = { totalUsers: result.totalUsers, totalAmount: result.totalAmount };
			setTimeout(() => { rainResult = null; }, 3000);
			loadRainHistory();
		}
	}

	let clearRainLoading = $state(false);

	async function clearRainHistory() {
		clearRainLoading = true;
		try {
			const res = await fetch('/api/events/rain', { method: 'DELETE' });
			if (res.ok) {
				rainHistory = [];
				showRainHistory = false;
			}
		} catch { /* ignore */ }
		clearRainLoading = false;
	}

	async function loadRainHistory() {
		try {
			const res = await fetch('/api/events/rain');
			if (res.ok) {
				const data = await res.json();
				rainHistory = data.history ?? [];
			}
		} catch { /* ignore */ }
	}

	let pendingRequests = $derived(topUpRequests.list.filter((r) => r.status === 'pending'));
	let processedRequests = $derived(topUpRequests.list.filter((r) => r.status !== 'pending'));
	let showHistory = $state(false);

	let totalSpent = $derived(users.filter(u => u.role === 'player').reduce((s, u) => s + u.stats.totalSpent, 0));
	let totalReceived = $derived(users.filter(u => u.role === 'player').reduce((s, u) => s + u.stats.totalReceived, 0));
	let netProfit = $derived(totalSpent - totalReceived);

	function formatTime(ts: number): string {
		const d = new Date(ts);
		return d.toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
	}
</script>

<svelte:head><title>แอดมิน - BUNG TAE DUBAI</title></svelte:head>

<!-- Aggregate Stats -->
<div class="mb-6 grid grid-cols-3 gap-3 sm:mb-8 sm:gap-x-8 sm:gap-y-4">
	<div>
		<p class="text-[10px] text-slot-muted sm:text-[11px]">ได้ทั้งหมด (ผู้เล่นเสีย)</p>
		<p class="text-base font-bold tabular-nums text-slot-win sm:text-2xl">+{totalSpent.toLocaleString()}</p>
	</div>
	<div>
		<p class="text-[10px] text-slot-muted sm:text-[11px]">เสียทั้งหมด (จ่ายผู้เล่น)</p>
		<p class="text-base font-bold tabular-nums text-slot-lose sm:text-2xl">-{totalReceived.toLocaleString()}</p>
	</div>
	<div>
		<p class="text-[10px] text-slot-muted sm:text-[11px]">กำไรสุทธิ</p>
		<p class="text-base font-bold tabular-nums sm:text-2xl {netProfit >= 0 ? 'text-slot-win' : 'text-slot-lose'}">
			{netProfit >= 0 ? '+' : ''}{netProfit.toLocaleString()}
		</p>
	</div>
</div>

<!-- Pending Requests -->
<div class="mb-6 sm:mb-8">
	<div class="mb-3 flex items-center gap-2">
		<h2 class="text-xs font-bold text-slot-text sm:text-sm">คำขอเบิกทุน</h2>
		{#if pendingRequests.length > 0}
			<span class="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-slot-text px-1 text-[9px] font-bold text-slot-bg sm:px-1.5 sm:text-[10px]">
				{pendingRequests.length}
			</span>
		{/if}
	</div>

	{#if pendingRequests.length === 0}
		<p class="text-[11px] text-slot-muted sm:text-xs">ไม่มีคำขอรอดำเนินการ</p>
	{:else}
		<div class="overflow-hidden rounded-lg border border-slot-border">
			{#each pendingRequests as req, i}
				<div class="flex items-center justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3 {i > 0 ? 'border-t border-slot-border' : ''}">
					<div class="min-w-0">
						<div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
							<span class="text-sm font-bold tabular-nums text-slot-text sm:text-base">{req.amount.toLocaleString()}</span>
							<span class="text-[10px] text-slot-muted sm:text-[11px]">บาท</span>
							{#if req.username}
								<span class="rounded bg-slot-accent/10 px-1 py-0.5 text-[9px] text-slot-accent sm:px-1.5 sm:text-[10px]">{req.username}</span>
							{/if}
						</div>
						<p class="text-[9px] text-slot-muted sm:text-[10px]">{formatTime(req.timestamp)}</p>
					</div>
					<div class="flex shrink-0 gap-1.5 sm:gap-2">
						<button
							onclick={() => rejectRequest(req.id)}
							class="cursor-pointer rounded-md border border-slot-border px-2 py-1 text-[10px] text-slot-muted transition hover:bg-slot-bg sm:px-3 sm:py-1.5 sm:text-xs"
						>
							ปฏิเสธ
						</button>
						<button
							onclick={() => approveRequest(req.id)}
							class="cursor-pointer rounded-md bg-slot-text px-2 py-1 text-[10px] font-medium text-slot-bg transition hover:opacity-80 active:scale-[0.98] sm:px-3 sm:py-1.5 sm:text-xs"
						>
							อนุมัติ
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- History -->
{#if processedRequests.length > 0}
	<div>
		<button
			onclick={() => (showHistory = !showHistory)}
			class="mb-2 flex cursor-pointer items-center gap-1.5 text-xs font-bold text-slot-text sm:text-sm"
		>
			<span class="text-[10px] text-slot-muted transition-transform {showHistory ? 'rotate-90' : ''}">&#9654;</span>
			ประวัติ
			<span class="text-[10px] font-normal text-slot-muted sm:text-[11px]">({processedRequests.length})</span>
		</button>

		{#if showHistory}
			<div class="overflow-hidden rounded-lg border border-slot-border">
				{#each processedRequests as req, i}
					<div class="flex items-center justify-between gap-2 px-3 py-1.5 text-[10px] sm:px-4 sm:py-2 sm:text-xs {i > 0 ? 'border-t border-slot-border' : ''}">
						<span class="min-w-0 truncate font-bold tabular-nums text-slot-text">
							{req.amount.toLocaleString()} <span class="font-normal text-slot-muted">บาท</span>
							{#if req.username}
								<span class="ml-1 text-[9px] text-slot-accent sm:text-[10px]">({req.username})</span>
							{/if}
						</span>
						<span class="shrink-0 text-[9px] text-slot-muted sm:text-[10px]">{formatTime(req.timestamp)}</span>
						<span class="shrink-0 text-[9px] sm:text-[10px] {req.status === 'approved' ? 'text-slot-text' : 'text-slot-muted'}">
							{req.status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'}
						</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<!-- Reset Buttons -->
{#if showResetCreditConfirm}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 animate-backdrop">
		<div class="w-full max-w-sm rounded-2xl bg-slot-surface p-6 text-center shadow-xl animate-modal">
			<p class="mb-2 text-sm font-bold text-slot-lose">ยืนยันรีเซ็ทเงินทุกคน?</p>
			<p class="mb-4 text-xs text-slot-muted">เครดิตของผู้เล่นทุกคนจะถูกรีเซ็ทเป็น 0</p>
			<div class="flex gap-2">
				<button onclick={() => (showResetCreditConfirm = false)} class="flex-1 cursor-pointer rounded-xl border border-slot-border px-4 py-2.5 text-sm text-slot-muted transition hover:bg-slot-bg">ยกเลิก</button>
				<button onclick={handleResetCredits} class="flex-1 cursor-pointer rounded-xl bg-slot-lose px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110">ยืนยัน</button>
			</div>
		</div>
	</div>
{/if}
{#if showResetHistoryConfirm}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 animate-backdrop">
		<div class="w-full max-w-sm rounded-2xl bg-slot-surface p-6 text-center shadow-xl animate-modal">
			<p class="mb-2 text-sm font-bold text-slot-lose">ยืนยันรีเซ็ทประวัติทุกคน?</p>
			<p class="mb-4 text-xs text-slot-muted">สถิติ, ภารกิจ, เข้าสู่ระบบรายวัน, กงล้อ ของทุกคนจะถูกรีเซ็ท</p>
			<div class="flex gap-2">
				<button onclick={() => (showResetHistoryConfirm = false)} class="flex-1 cursor-pointer rounded-xl border border-slot-border px-4 py-2.5 text-sm text-slot-muted transition hover:bg-slot-bg">ยกเลิก</button>
				<button onclick={handleResetHistory} class="flex-1 cursor-pointer rounded-xl bg-slot-lose px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110">ยืนยัน</button>
			</div>
		</div>
	</div>
{/if}

<div class="mb-6 sm:mb-8">
	<h2 class="mb-3 text-xs font-bold text-slot-text sm:text-sm">รีเซ็ทข้อมูล</h2>
	<div class="flex flex-wrap gap-2 sm:gap-3">
		<button
			onclick={() => (showResetCreditConfirm = true)}
			disabled={resetCreditLoading}
			class="cursor-pointer rounded-lg border border-slot-lose/30 bg-slot-lose/5 px-4 py-2 text-xs font-bold text-slot-lose transition hover:bg-slot-lose/10 disabled:opacity-40 sm:text-sm"
		>
			{resetCreditLoading ? '...' : 'รีเซ็ทเงินทุกคน'}
		</button>
		<button
			onclick={() => (showResetHistoryConfirm = true)}
			disabled={resetHistoryLoading}
			class="cursor-pointer rounded-lg border border-slot-lose/30 bg-slot-lose/5 px-4 py-2 text-xs font-bold text-slot-lose transition hover:bg-slot-lose/10 disabled:opacity-40 sm:text-sm"
		>
			{resetHistoryLoading ? '...' : 'รีเซ็ทประวัติทุกคน'}
		</button>
	</div>
	{#if resetCreditResult}
		<p class="mt-2 animate-fade-in text-xs font-medium text-slot-win sm:text-sm">{resetCreditResult}</p>
	{/if}
	{#if resetHistoryResult}
		<p class="mt-2 animate-fade-in text-xs font-medium text-slot-win sm:text-sm">{resetHistoryResult}</p>
	{/if}
</div>

<!-- Rain -->
<div class="mt-6 sm:mt-8">
	<h2 class="mb-3 text-xs font-bold text-slot-text sm:text-sm">แจกเครดิต (Rain)</h2>
	<div class="rounded-lg border border-slot-border p-3 sm:p-4">
		<div class="flex items-center gap-2 sm:gap-3">
			<input
				type="number"
				bind:value={rainAmount}
				min="1"
				placeholder="จำนวนต่อคน"
				class="w-28 rounded-lg border border-slot-border bg-slot-bg px-3 py-2 text-sm tabular-nums outline-none focus:border-slot-accent sm:w-36 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
			/>
			<span class="text-[10px] text-slot-muted sm:text-xs">ต่อคน</span>
			<button
				onclick={handleRain}
				disabled={rainLoading || !rainAmount || rainAmount < 1}
				class="cursor-pointer rounded-lg bg-slot-accent px-4 py-2 text-xs font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40 sm:text-sm"
			>
				{rainLoading ? '...' : 'แจก'}
			</button>
		</div>
		{#if rainResult}
			<p class="mt-2 animate-fade-in text-xs font-medium text-slot-win sm:text-sm">
				แจกสำเร็จ! {rainResult.totalUsers} คน รวม {rainResult.totalAmount.toLocaleString()} เครดิต
			</p>
		{/if}
	</div>

	{#if rainHistory.length > 0}
		<div class="mt-3 mb-2 flex items-center gap-2">
			<button
				onclick={() => (showRainHistory = !showRainHistory)}
				class="flex cursor-pointer items-center gap-1.5 text-xs font-bold text-slot-text sm:text-sm"
			>
				<span class="text-[10px] text-slot-muted transition-transform {showRainHistory ? 'rotate-90' : ''}">&#9654;</span>
				ประวัติ Rain
				<span class="text-[10px] font-normal text-slot-muted sm:text-[11px]">({rainHistory.length})</span>
			</button>
			<button
				onclick={clearRainHistory}
				disabled={clearRainLoading}
				class="cursor-pointer rounded px-2 py-0.5 text-[10px] font-medium text-red-500 transition hover:bg-red-50 hover:text-red-600 active:scale-[0.98] disabled:opacity-40 sm:text-xs"
			>
				{clearRainLoading ? '...' : 'ลบประวัติ'}
			</button>
		</div>

		{#if showRainHistory}
			<div class="overflow-hidden rounded-lg border border-slot-border">
				{#each rainHistory as event, i}
					<div class="flex items-center justify-between gap-2 px-3 py-1.5 text-[10px] sm:px-4 sm:py-2 sm:text-xs {i > 0 ? 'border-t border-slot-border' : ''}">
						<span class="font-bold tabular-nums text-slot-text">
							{event.amountPerUser.toLocaleString()} <span class="font-normal text-slot-muted">x {event.totalUsers} คน = {event.totalAmount.toLocaleString()}</span>
						</span>
						<span class="shrink-0 text-[9px] text-slot-muted sm:text-[10px]">{formatTime(event.timestamp)}</span>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>
