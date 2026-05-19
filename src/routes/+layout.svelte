<script lang="ts">
	import { onMount } from 'svelte';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import chipIcon from '$lib/assets/chip.svg';
	import { page } from '$app/stores';
	import { goto, beforeNavigate } from '$app/navigation';
	import { wallet, stats, loadCredit, loadStats, currentUser, loadCurrentUser, userLogout, addTopUpRequest, gameInProgress, revealBlocking, darkMode, toggleDarkMode, forfeitGame } from '$lib/store.svelte';
	import { creditCountUp, creditPulse, creditColorFlash, type GsapTween } from '$lib/animations';

	let { children } = $props();
	let ready = $state(false);
	let userMenuOpen = $state(false);
	let showTopUp = $state(false);
	let topUpAmount = $state(100);

	let navBlockMsg = $state('');
	let showForfeitConfirm = $state(false);
	let pendingNavUrl = $state('');
	let prevCredit = $state(0);
	let displayCredit = $state(0);
	let creditBadgeEl: HTMLDivElement | undefined = $state();
	let creditTextEl: HTMLSpanElement | undefined = $state();
	let activeCreditTween: GsapTween | null = null;

	$effect(() => {
		const target = wallet.credit;
		if (prevCredit === 0 && target > 0) {
			// Initial load — snap to value
			displayCredit = target;
			prevCredit = target;
			return;
		}
		if (target !== prevCredit) {
			const isGain = target > prevCredit;

			// Kill previous tween
			if (activeCreditTween) activeCreditTween.kill();

			// GSAP smooth number count
			activeCreditTween = creditCountUp(
				creditBadgeEl?.querySelector('.credit-number') as HTMLElement ?? null!,
				displayCredit,
				target,
				(value) => { displayCredit = value; }
			);

			// GSAP scale pulse + color flash on the badge
			if (creditBadgeEl) {
				creditPulse(creditBadgeEl, isGain);
			}

			// Flash the number color briefly
			if (creditTextEl) {
				creditColorFlash(creditTextEl, isGain);
			}

			prevCredit = target;
		}
	});

	beforeNavigate(({ cancel, to }) => {
		if (gameInProgress.value) {
			cancel();
			pendingNavUrl = to?.url?.pathname ?? '/';
			showForfeitConfirm = true;
		}
	});

	function getActiveGame(): string {
		const path = $page.url.pathname;
		const match = path.match(/^\/games\/([^/]+)/);
		return match?.[1] ?? '';
	}

	async function confirmForfeit() {
		const game = getActiveGame();
		showForfeitConfirm = false;
		if (game) await forfeitGame(game);
		gameInProgress.value = false;
		goto(pendingNavUrl || '/');
	}

	function cancelForfeit() {
		showForfeitConfirm = false;
		pendingNavUrl = '';
	}

	let isLoginPage = $derived($page.url.pathname === '/login');
	let isAdminArea = $derived(
		$page.url.pathname === '/login' || $page.url.pathname.startsWith('/admin')
	);
	let isGamePage = $derived($page.url.pathname.startsWith('/games/'));
	let isHomePage = $derived($page.url.pathname === '/');
	let isSlotPage = $derived(
		$page.url.pathname === '/games/slot'
	);
	let isSlotSection = $derived(
		$page.url.pathname === '/games/slot' || $page.url.pathname.startsWith('/games/slot/')
	);

	// Dynamic max-width: homepage full width, game pages narrower
	let contentMaxW = $derived(
		isAdminArea ? 'max-w-5xl' :
		isHomePage ? 'max-w-7xl' :
		'max-w-lg sm:max-w-xl md:max-w-2xl'
	);

	let interval: ReturnType<typeof setInterval>;
	let showLogoutConfirm = $state(false);

	// React to currentUser changes (e.g. after login from login page)
	$effect(() => {
		if (currentUser.value && !ready) {
			loadCredit();
			loadStats();
			ready = true;
		}
	});

	onMount(() => {
		// Apply dark mode class from persisted state
		if (darkMode.value) {
			document.documentElement.classList.add('dark');
		}

		loadCurrentUser().then(async (user) => {
			if (!user && $page.url.pathname !== '/login') {
				goto('/login');
				return;
			}
			if (user) {
				await loadCredit();
				await loadStats();
			}
			ready = true;
		});
		interval = setInterval(() => {
			if (currentUser.value && !revealBlocking.value && !gameInProgress.value) loadCredit();
		}, 5000);
		return () => clearInterval(interval);
	});

	function handleLogout() {
		userMenuOpen = false;
		showLogoutConfirm = true;
	}

	async function confirmLogout() {
		showLogoutConfirm = false;
		// Leave any active room before logging out
		if ($page.url.pathname.startsWith('/room/')) {
			const roomCode = $page.url.pathname.split('/')[2];
			if (roomCode) {
				try { await fetch(`/api/room/${roomCode}/leave`, { method: 'POST' }); } catch {}
			}
		}
		await userLogout();
		ready = false;
		goto('/login');
	}

	async function submitTopUp() {
		if (!topUpAmount || topUpAmount < 1 || isNaN(topUpAmount)) return;
		topUpAmount = Math.floor(topUpAmount);
		await addTopUpRequest(topUpAmount);
		showTopUp = false;
	}

	function closeMenu(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.user-menu-area')) {
			userMenuOpen = false;
		}
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if showTopUp}
	<div class="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
		<div class="w-full max-w-sm rounded-2xl border border-slot-border bg-slot-surface p-6 text-center shadow-xl">
			<p class="mb-4 text-sm font-medium text-slot-text">เบิกทุน</p>
			<p class="mb-2 text-xs text-slot-muted">ใส่จำนวนบาทที่ต้องการเบิก</p>
			<input
				type="number"
				bind:value={topUpAmount}
				min="1"
				class="mb-4 w-full rounded-lg border border-slot-border bg-slot-bg px-4 py-2.5 text-center text-lg font-bold tabular-nums outline-none focus:border-slot-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
			/>
			<div class="flex gap-2">
				<button
					onclick={() => (showTopUp = false)}
					class="flex-1 cursor-pointer rounded-xl border border-slot-border px-4 py-2.5 text-sm font-medium text-slot-muted transition hover:bg-slot-bg"
				>
					ยกเลิก
				</button>
				<button
					onclick={submitTopUp}
					disabled={!topUpAmount || topUpAmount < 1}
					class="flex-1 cursor-pointer rounded-xl bg-slot-accent px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
				>
					ส่งคำขอ
				</button>
			</div>
		</div>
	</div>
{/if}

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

{#if showForfeitConfirm}
	<div class="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
		<div class="w-full max-w-sm rounded-2xl border border-slot-border bg-slot-surface p-6 text-center shadow-xl">
			<p class="mb-2 text-sm font-medium text-slot-text">ยังเล่นไม่จบ</p>
			<p class="mb-4 text-xs text-slot-muted">ถ้าออกตอนนี้จะถือว่ายอมแพ้ จะออกจริงหรอ?</p>
			<div class="flex gap-2">
				<button
					onclick={cancelForfeit}
					class="flex-1 cursor-pointer rounded-xl border border-slot-border px-4 py-2.5 text-sm font-medium text-slot-muted transition hover:bg-slot-bg"
				>
					เล่นต่อ
				</button>
				<button
					onclick={confirmForfeit}
					class="flex-1 cursor-pointer rounded-xl bg-red-500/80 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-500 active:scale-[0.98]"
				>
					ยอมแพ้
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="flex flex-col bg-slot-bg text-slot-text {isSlotPage ? 'h-screen overflow-hidden' : 'min-h-screen'}" onclick={closeMenu}>
	{#if !isAdminArea && ready && currentUser.value}
		<nav class="sticky top-0 z-40 border-b border-slot-border bg-slot-surface/95 backdrop-blur-sm">
			<div class="mx-auto flex h-11 items-center justify-between px-2.5 sm:h-12 sm:px-4 max-w-full">
				<!-- Left: Back + Brand -->
				<div class="flex min-w-0 items-center gap-1.5 sm:gap-2">
					{#if isGamePage}
						<a
							href="/"
							class="flex shrink-0 items-center gap-0.5 text-[11px] text-slot-muted transition hover:text-slot-text sm:text-sm"
						>
							<svg class="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
						</a>
					{/if}
					<a href="/" class="truncate text-sm font-bold tracking-tight text-slot-accent sm:text-lg"
						>BUNG TAE DUBAI</a
					>
						{#if isSlotSection}
						<a
							href="/games/slot/paytable"
							class="hidden shrink-0 text-xs text-slot-muted transition hover:text-slot-text sm:inline"
							>ตารางรางวัล</a
						>
					{/if}
				</div>

				<!-- Right: Credit + Top-up + User dropdown -->
				<div class="flex items-center gap-1.5 sm:gap-3">
					<!-- Stats: hidden on very small screens, visible on sm+ -->
					<div class="hidden items-center gap-1.5 text-[10px] sm:flex sm:text-xs">
						<span class="font-medium text-slot-win"
							>ได้ {stats.totalReceived.toLocaleString()}</span
						>
						<span class="text-slot-muted">|</span>
						<span class="font-medium text-slot-lose"
							>เสีย {stats.totalSpent.toLocaleString()}</span
						>
					</div>

					<!-- Credit badge + top-up button -->
					<div class="flex items-stretch gap-0">
						<div
							bind:this={creditBadgeEl}
							class="flex items-center gap-2 rounded-l-md border border-slot-border px-1.5 py-0.5 sm:gap-1.5 sm:px-2.5 sm:py-1 transition-all duration-200"
						>
							<img src={chipIcon} alt="" class="h-5 w-5 sm:h-6 sm:w-6" />
							<span bind:this={creditTextEl} class="credit-number text-[11px] font-light tabular-nums {displayCredit < 0 ? 'text-red-400' : 'text-gray-400'}"								>{displayCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span
							>
						</div>
						<button
							onclick={() => { topUpAmount = 100; showTopUp = true; }}
							class="cursor-pointer rounded-r-md border border-l-0 border-slot-border bg-slot-accent/10 px-2 text-[11px] font-bold text-slot-accent transition hover:bg-slot-accent/20 sm:px-2.5 sm:text-xs"
						>
							+
						</button>
					</div>

					<!-- Dark mode toggle -->
					<button
						onclick={toggleDarkMode}
						class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-slot-muted transition hover:bg-slot-bg hover:text-slot-text sm:h-8 sm:w-8"
						title={darkMode.value ? 'Switch to light mode' : 'Switch to dark mode'}
					>
						{#if darkMode.value}
							<!-- Sun icon (currently dark, click to go light) -->
							<svg class="h-4 w-4 sm:h-[18px] sm:w-[18px]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
						{:else}
							<!-- Moon icon (currently light, click to go dark) -->
							<svg class="h-4 w-4 sm:h-[18px] sm:w-[18px]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
						{/if}
					</button>

					<!-- User dropdown -->
					<div class="user-menu-area relative">
						<button
							onclick={() => (userMenuOpen = !userMenuOpen)}
							class="flex cursor-pointer items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] text-slot-muted transition hover:bg-slot-bg hover:text-slot-text sm:px-2 sm:text-xs"
						>
							<div class="flex h-5 w-5 items-center justify-center rounded-full bg-slot-accent/15 text-[9px] font-bold text-slot-accent sm:h-6 sm:w-6 sm:text-[10px]">
								{currentUser.value.username.charAt(0).toUpperCase()}
							</div>
							<span class="hidden sm:inline">{currentUser.value.username}</span>
							<svg class="h-3 w-3 transition-transform {userMenuOpen ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
						</button>

						{#if userMenuOpen}
							<div class="animate-fade-in absolute right-0 top-full mt-1 w-48 overflow-hidden rounded-xl border border-slot-border bg-slot-surface shadow-lg">
								<!-- User info header -->
								<div class="border-b border-slot-border px-3.5 py-2.5">
									<p class="text-xs font-medium text-slot-text">{currentUser.value.username}</p>
									<p class="text-[10px] text-slot-muted">{currentUser.value.role === 'admin' ? 'Admin' : 'Player'}</p>
								</div>

								<!-- Stats (visible in dropdown for mobile) -->
								<div class="border-b border-slot-border px-3.5 py-2 sm:hidden">
									<div class="flex justify-between text-[10px]">
										<span class="text-slot-muted">ได้ทั้งหมด</span>
										<span class="font-medium text-slot-win">{stats.totalReceived.toLocaleString()}</span>
									</div>
									<div class="mt-0.5 flex justify-between text-[10px]">
										<span class="text-slot-muted">เสียทั้งหมด</span>
										<span class="font-medium text-slot-lose">{stats.totalSpent.toLocaleString()}</span>
									</div>
								</div>

								<!-- Top-up -->
								<button
									onclick={() => { userMenuOpen = false; topUpAmount = 100; showTopUp = true; }}
									class="flex w-full cursor-pointer items-center gap-2 px-3.5 py-2 text-xs text-slot-muted transition hover:bg-slot-bg hover:text-slot-text"
								>
									<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v12m6-6H6"/></svg>
									เบิกทุน
								</button>

								<!-- Paytable link for slot (mobile) -->
								{#if isSlotSection}
									<a
										href="/games/slot/paytable"
										onclick={() => (userMenuOpen = false)}
										class="flex items-center gap-2 px-3.5 py-2 text-xs text-slot-muted transition hover:bg-slot-bg hover:text-slot-text sm:hidden"
									>
										<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
										ตารางรางวัล
									</a>
								{/if}

								<a
									href="/events"
									onclick={() => (userMenuOpen = false)}
									class="flex items-center gap-2 px-3.5 py-2 text-xs text-slot-muted transition hover:bg-slot-bg hover:text-slot-text"
								>
									<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/></svg>
									กิจกรรม
								</a>

								{#if currentUser.value.role === 'admin'}
									<a
										href="/admin"
										onclick={() => (userMenuOpen = false)}
										class="flex items-center gap-2 px-3.5 py-2 text-xs text-slot-muted transition hover:bg-slot-bg hover:text-slot-text"
									>
										<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
										แอดมิน
									</a>
								{/if}

								<!-- Logout -->
								<button
									onclick={handleLogout}
									class="flex w-full cursor-pointer items-center gap-2 border-t border-slot-border px-3.5 py-2.5 text-xs text-slot-lose transition hover:bg-slot-lose/5"
								>
									<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
									ออกจากระบบ
								</button>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</nav>

	{/if}

	{#if isSlotPage}
		<main class="flex flex-1 flex-col overflow-hidden">
			{#if ready}
				{@render children()}
			{:else}
				<div class="flex min-h-[40vh] items-center justify-center">
					<p class="text-sm text-slot-muted animate-pulse">กำลังโหลด...</p>
				</div>
			{/if}
		</main>
	{:else}
		<main class="mx-auto w-full flex-1 px-3 py-4 sm:px-4 sm:py-6 {contentMaxW}">
			{#if ready || isLoginPage}
				{@render children()}
			{:else}
				<div class="flex min-h-[40vh] items-center justify-center">
					<p class="text-sm text-slot-muted animate-pulse">กำลังโหลด...</p>
				</div>
			{/if}
		</main>

		{#if !isAdminArea && ready && currentUser.value}
			<footer class="border-t border-slot-border py-3 text-center text-[10px] text-slot-muted sm:text-xs">
				มาเด้อเดี๋ยวพี่พารวย — เว็บสร้างขึ้นมาทดลองเล่นสนุกๆ ไม่ได้นำไปใช้งานจริง
			</footer>
		{/if}
	{/if}
</div>
