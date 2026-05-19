<script lang="ts">
	import { goto } from '$app/navigation';
	import { currentUser, userLogin, loadCurrentUser } from '$lib/store.svelte';
	import { onMount } from 'svelte';

	let username = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	onMount(async () => {
		await loadCurrentUser();
		if (currentUser.value) {
			goto(currentUser.value.role === 'admin' ? '/admin' : '/');
		}
	});

	async function handleLogin() {
		loading = true;
		error = '';
		const result = await userLogin(username, password);
		loading = false;
		if (result.success && result.user) {
			goto(result.user.role === 'admin' ? '/admin' : '/');
		} else {
			error = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
			password = '';
		}
	}
</script>

<svelte:head>
	<title>Login - BUNG TAE DUBAI</title>
</svelte:head>

<div class="flex min-h-[60vh] items-center justify-center">
	<div
		class="w-full max-w-xs rounded-2xl border border-slot-border bg-slot-surface p-6 shadow-sm"
	>
		<h1 class="mb-1 text-center text-lg font-bold text-slot-text">เข้าสู่ระบบ</h1>
		<p class="mb-6 text-center text-xs text-slot-muted">BUNG TAE DUBAI</p>

		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleLogin();
			}}
			class="space-y-3"
		>
			<input
				type="text"
				bind:value={username}
				placeholder="Username"
				class="w-full rounded-lg border border-slot-border bg-slot-bg px-4 py-2.5 text-sm outline-none focus:border-slot-accent"
			/>
			<input
				type="password"
				bind:value={password}
				placeholder="Password"
				class="w-full rounded-lg border border-slot-border bg-slot-bg px-4 py-2.5 text-sm outline-none focus:border-slot-accent"
			/>

			{#if error}
				<p class="text-xs text-slot-lose">{error}</p>
			{/if}

			<button
				type="submit"
				disabled={!username || !password || loading}
				class="w-full cursor-pointer rounded-xl bg-slot-accent py-2.5 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
			>
				{loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
			</button>
		</form>
	</div>
</div>
