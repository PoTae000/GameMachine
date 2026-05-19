<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { currentUser, loadCurrentUser, userLogout } from '$lib/store.svelte';

	let { children } = $props();
	let ready = $state(false);

	let currentPath = $derived($page.url.pathname);

	const tabs = [
		{ href: '/admin', label: 'หน้าหลัก' },
		{ href: '/admin/users', label: 'ผู้ใช้' },
		{ href: '/admin/winrate', label: 'สูตรโกง' },
	];

	onMount(() => {
		loadCurrentUser().then((user) => {
			if (!user || user.role !== 'admin') {
				goto('/login');
				return;
			}
			ready = true;
		});
	});

	let showLogoutConfirm = $state(false);

	function handleLogout() {
		showLogoutConfirm = true;
	}

	async function confirmLogout() {
		showLogoutConfirm = false;
		await userLogout();
		goto('/login');
	}
</script>

{#if showLogoutConfirm}
	<div class="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
		<div class="w-full max-w-sm rounded-2xl border border-slot-border bg-slot-surface p-6 text-center shadow-xl">
			<p class="mb-2 text-sm font-medium text-slot-text">ออกจากระบบ</p>
			<p class="mb-4 text-xs text-slot-muted">ต้องการออกจากระบบใช่หรือไม่?</p>
			<div class="flex gap-2">
				<button
					onclick={() => (showLogoutConfirm = false)}
					class="flex-1 cursor-pointer rounded-xl border border-slot-border px-4 py-2.5 text-sm font-medium text-slot-muted transition hover:bg-slot-bg"
				>
					ยกเลิก
				</button>
				<button
					onclick={confirmLogout}
					class="flex-1 cursor-pointer rounded-xl bg-red-500/80 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-500 active:scale-[0.98]"
				>
					ออกจากระบบ
				</button>
			</div>
		</div>
	</div>
{/if}

{#if ready && currentUser.value?.role === 'admin'}
	<div class="select-none">
		<!-- Shared Header -->
		<div class="mb-6 border-b border-slot-border pb-4 sm:mb-8">
			<div class="flex items-start justify-between gap-3">
				<div>
					<h1 class="text-base font-bold text-slot-text sm:text-lg">แอดมิน</h1>
					<p class="text-[10px] text-slot-muted sm:text-[11px]">BUNG TAE DUBAI — {currentUser.value.username}</p>
				</div>
				<button
					onclick={handleLogout}
					class="shrink-0 cursor-pointer text-[11px] text-red-500 transition hover:text-red-400 sm:text-xs"
				>
					ออกจากระบบ
				</button>
			</div>
			<nav class="mt-3 flex gap-3 sm:gap-4">
				{#each tabs as tab}
					{#if currentPath === tab.href}
						<span class="border-b-2 border-slot-text pb-0.5 text-[11px] font-medium text-slot-text sm:text-xs">{tab.label}</span>
					{:else}
						<a href={tab.href} class="pb-0.5 text-[11px] text-slot-muted transition hover:text-slot-text sm:text-xs">{tab.label}</a>
					{/if}
				{/each}
			</nav>
		</div>

		{@render children()}
	</div>
{:else if !ready}
	<div class="flex min-h-[40vh] items-center justify-center">
		<p class="text-sm text-slot-muted animate-pulse">กำลังโหลด...</p>
	</div>
{/if}
