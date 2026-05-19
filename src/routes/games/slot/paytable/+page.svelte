<script lang="ts">
	import { SYMBOLS, PAYLINES, PAYLINE_MULTIPLIERS, PAYLINE_NAMES, COLS, ROWS } from '$lib/slotEngine';
	import { SYMBOL_SVGS } from '$lib/symbolSvgs';
</script>

<svelte:head>
	<title>ตารางรางวัล - BUNG TAE DUBAI</title>
</svelte:head>

<div class="select-none">
	<div class="mb-4 flex items-center justify-between sm:mb-6">
		<h1 class="text-base font-bold sm:text-lg">ตารางรางวัล</h1>
		<a
			href="/games/slot"
			class="flex items-center gap-1 rounded-lg border border-slot-border px-3 py-1.5 text-xs text-slot-muted transition hover:bg-slot-surface hover:text-slot-text sm:text-sm"
		>
			<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
			ปิด
		</a>
	</div>

	<!-- Symbol Payouts -->
	<div class="mb-4 rounded-lg border border-slot-border bg-slot-surface p-3 sm:mb-6 sm:p-4">
		<p class="mb-2 text-[11px] font-medium text-slot-muted sm:mb-3 sm:text-sm">สัญลักษณ์และรางวัล (x เดิมพัน)</p>
		<div class="space-y-1.5 sm:space-y-2">
			{#each SYMBOLS as sym}
				<div class="flex items-center justify-between text-xs sm:text-sm">
					<div class="flex items-center gap-1.5 sm:gap-2">
						<span class="inline-flex h-7 w-7 items-center justify-center sm:h-8 sm:w-8">{@html SYMBOL_SVGS[sym.id]}</span>
						<span class="text-slot-text">{sym.name}</span>
						{#if sym.id === 'scatter'}
							<span class="rounded bg-slot-accent/10 px-1 py-0.5 text-[9px] text-slot-accent sm:px-1.5 sm:text-xs">Scatter</span>
						{/if}
					</div>
					<div class="flex gap-2 text-[10px] text-slot-muted sm:gap-4 sm:text-xs">
						{#if sym.id === 'scatter'}
							<span>x4+ = Free Spin</span>
						{:else}
							<span>x3=<span class="font-bold text-slot-text">{sym.pay3}</span></span>
							<span>x4=<span class="font-bold text-slot-text">{sym.pay4}</span></span>
							<span>x5=<span class="font-bold text-slot-win">{sym.pay5}</span></span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Pattern Multipliers -->
	<div class="mb-4 rounded-lg border border-slot-border bg-slot-surface p-3 sm:mb-6 sm:p-4">
		<p class="mb-2 text-[11px] font-medium text-slot-muted sm:mb-3 sm:text-sm">โบนัสรูปแบบเส้น</p>
		<div class="grid grid-cols-3 gap-2 text-xs sm:text-sm">
			<div class="text-slot-muted">เส้นตรง (แถว 1-5)</div>
			<div class="font-bold text-slot-text">x1</div>
			<div class="text-slot-muted">ปกติ</div>

			<div class="text-slot-muted">V / ^</div>
			<div class="font-bold text-slot-win">x1.5</div>
			<div class="text-slot-muted">โบนัส</div>

			<div class="text-slot-muted">เฉียง</div>
			<div class="font-bold text-amber-500">x2</div>
			<div class="text-slot-muted">โบนัสสูง</div>
		</div>
	</div>

	<!-- Paylines -->
	<div class="rounded-lg border border-slot-border bg-slot-surface p-3 sm:p-4">
		<p class="mb-2 text-[11px] font-medium text-slot-muted sm:mb-3 sm:text-sm">เส้นรางวัล ({PAYLINES.length} เส้น)</p>
		<div class="grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-4">
			{#each PAYLINES as line, idx}
				<div class="rounded-md border border-slot-border p-1.5 sm:p-2">
					<div class="mb-1 flex items-center justify-between">
						<p class="text-[10px] text-slot-text sm:text-xs">{PAYLINE_NAMES[idx]}</p>
						{#if PAYLINE_MULTIPLIERS[idx] > 1}
							<span class="text-[9px] font-bold sm:text-[10px] {PAYLINE_MULTIPLIERS[idx] >= 2 ? 'text-amber-500' : 'text-slot-win'}">
								x{PAYLINE_MULTIPLIERS[idx]}
							</span>
						{/if}
					</div>
					<div class="grid grid-cols-5 gap-px">
						{#each Array.from({ length: ROWS }) as _, row}
							{#each Array.from({ length: COLS }) as _, col}
								<div
									class="aspect-square w-full rounded-[2px]
										{line[col] === row ? 'bg-slot-accent' : 'bg-slot-border/50'}"
								></div>
							{/each}
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
