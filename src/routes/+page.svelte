<script lang="ts">
	const games = [
		{ name: 'Slot Machine', desc: 'สล็อต 5 รีล 10 เส้น', href: '/games/slot', icon: '🎰', svg: false, color: 'bg-purple-500' },
		{ name: 'Hi-Lo', desc: 'ทายไพ่สูง-ต่ำ', href: '/games/hilo', icon: '🃏', svg: false, color: 'bg-blue-500' },
		{ name: 'Blackjack', desc: 'เกม 21 แบล็คแจ็ค', href: '/games/blackjack', icon: '<svg viewBox="0 0 48 48" class="h-9 w-9 sm:h-10 sm:w-10"><rect x="4" y="6" width="24" height="32" rx="3" fill="white" stroke="rgba(255,255,255,0.4)" stroke-width="0.5" transform="rotate(-8 16 22)"/><rect x="20" y="6" width="24" height="32" rx="3" fill="white" stroke="rgba(255,255,255,0.4)" stroke-width="0.5" transform="rotate(8 32 22)"/><text x="14" y="26" font-size="15" font-weight="900" fill="#16a34a" font-family="sans-serif" transform="rotate(-8 14 22)" text-anchor="middle">A</text><path d="M14 28c-1.8 0-3 1.5-3 3 0 2 3 5 3 5s3-3 3-5c0-1.5-1.2-3-3-3z" fill="#16a34a" transform="rotate(-8 14 32)"/><text x="34" y="26" font-size="15" font-weight="900" fill="#16a34a" font-family="sans-serif" transform="rotate(8 34 22)" text-anchor="middle">K</text><path d="M34 28c-1.8 0-3 1.5-3 3 0 2 3 5 3 5s3-3 3-5c0-1.5-1.2-3-3-3z" fill="#16a34a" transform="rotate(8 34 32)"/></svg>', svg: true, color: 'bg-green-600' },
		{ name: 'Roulette', desc: 'รูเล็ต หมุนวงล้อ', href: '/games/roulette', icon: '🎡', svg: false, color: 'bg-red-600' },
{ name: 'Coin Flip', desc: 'โยนเหรียญ หัว/ก้อย', href: '/games/coinflip', icon: '🪙', svg: false, color: 'bg-yellow-500' },
		{ name: 'Pok Deng', desc: 'ป๊อกเด้ง ไพ่ไทย', href: '/games/pokdeng', icon: '<svg viewBox="0 0 48 48" class="h-9 w-9 sm:h-10 sm:w-10"><rect x="6" y="6" width="22" height="30" rx="3" fill="white" stroke="rgba(255,255,255,0.4)" stroke-width="0.5" transform="rotate(-6 17 21)"/><rect x="20" y="8" width="22" height="30" rx="3" fill="white" stroke="rgba(255,255,255,0.4)" stroke-width="0.5" transform="rotate(6 31 23)"/><text x="17" y="25" font-size="14" font-weight="900" fill="#e11d48" font-family="sans-serif" transform="rotate(-6 17 22)" text-anchor="middle">9</text><circle cx="17" cy="28" r="1.5" fill="#e11d48" transform="rotate(-6 17 28)"/><text x="31" y="27" font-size="14" font-weight="900" fill="#e11d48" font-family="sans-serif" transform="rotate(6 31 24)" text-anchor="middle">8</text><circle cx="31" cy="30" r="1.5" fill="#e11d48" transform="rotate(6 31 30)"/></svg>', svg: true, color: 'bg-rose-500' },
		{ name: 'Baccarat', desc: 'บาคาร่า Player/Banker', href: '/games/baccarat', icon: '<svg viewBox="0 0 48 48" class="h-9 w-9 sm:h-10 sm:w-10"><rect x="3" y="7" width="22" height="30" rx="3" fill="white" stroke="rgba(255,255,255,0.4)" stroke-width="0.5" transform="rotate(-10 14 22)"/><rect x="23" y="7" width="22" height="30" rx="3" fill="white" stroke="rgba(255,255,255,0.4)" stroke-width="0.5" transform="rotate(10 34 22)"/><text x="13" y="26" font-size="16" font-weight="900" fill="#047857" font-family="sans-serif" transform="rotate(-10 13 22)" text-anchor="middle">P</text><text x="35" y="26" font-size="16" font-weight="900" fill="#b91c1c" font-family="sans-serif" transform="rotate(10 35 22)" text-anchor="middle">B</text></svg>', svg: true, color: 'bg-emerald-600' },
		{ name: 'Dragon Tiger', desc: 'มังกร-เสือ ไพ่ใบเดียว', href: '/games/dragontiger', icon: '🐉', svg: false, color: 'bg-orange-600' },
		{ name: 'Keno', desc: 'คีโน เลือกตัวเลข', href: '/games/keno', icon: '🔢', svg: false, color: 'bg-indigo-500' },
		{ name: 'Mines', desc: 'เปิดช่อง หลบระเบิด', href: '/games/mines', icon: '💣', svg: false, color: 'bg-gray-600' },
		{ name: 'Wheel', desc: 'วงล้อเสี่ยงโชค', href: '/games/wheel', icon: '🎯', svg: false, color: 'bg-pink-500' },
		{ name: 'Plinko', desc: 'พลิงโกะ ปล่อยลูกบอล', href: '/games/plinko', icon: '⚪', svg: false, color: 'bg-cyan-500' },
		{ name: 'Crash', desc: 'กราฟพุ่ง กด Cash Out', href: '/games/crash', icon: '📈', svg: false, color: 'bg-red-500' },
		{ name: 'Scratch Card', desc: 'ขูดการ์ด ลุ้นรางวัล', href: '/games/scratch', icon: '🎫', svg: false, color: 'bg-amber-600' },
		{ name: 'Sicbo', desc: 'ไฮโล ทอยลูกเต๋า 3 ลูก', href: '/games/sicbo', icon: '🎲', svg: false, color: 'bg-teal-500' },
		{ name: 'Video Poker', desc: 'โป๊กเกอร์ 5 ใบ', href: '/games/videopoker', icon: '🃏', svg: false, color: 'bg-violet-600' },
		{ name: 'Lottery', desc: 'ลอตเตอรี่ เลือก 5 ตัว', href: '/games/lottery', icon: '🎱', svg: false, color: 'bg-sky-500' },
		{ name: 'Gao Gae', desc: 'เก้าเก ไพ่ 3 ใบ', href: '/games/gaogae', icon: '<svg viewBox="0 0 48 48" class="h-9 w-9 sm:h-10 sm:w-10"><rect x="2" y="6" width="18" height="26" rx="3" fill="white" stroke="rgba(255,255,255,0.4)" stroke-width="0.5" transform="rotate(-8 11 19)"/><rect x="15" y="6" width="18" height="26" rx="3" fill="white" stroke="rgba(255,255,255,0.4)" stroke-width="0.5"/><rect x="28" y="6" width="18" height="26" rx="3" fill="white" stroke="rgba(255,255,255,0.4)" stroke-width="0.5" transform="rotate(8 37 19)"/><text x="11" y="23" font-size="12" font-weight="900" fill="#dc2626" font-family="sans-serif" transform="rotate(-8 11 20)" text-anchor="middle">9</text><text x="24" y="23" font-size="12" font-weight="900" fill="#16a34a" font-family="sans-serif" text-anchor="middle">K</text><text x="37" y="23" font-size="12" font-weight="900" fill="#dc2626" font-family="sans-serif" transform="rotate(8 37 20)" text-anchor="middle">9</text></svg>', svg: true, color: 'bg-rose-600' },
		{ name: 'Rock Paper Scissors', desc: 'เป่ายิ้งฉุบ', href: '/games/rps', icon: '✊', svg: false, color: 'bg-blue-600' },
		{ name: 'Tower', desc: 'ปีนตึก หลบกับดัก', href: '/games/tower', icon: '🏗️', svg: false, color: 'bg-slate-600' },
		{ name: 'Lucky Box', desc: 'กล่องโชคดี ลุ้นตัวคูณ', href: '/games/luckybox', icon: '🎁', svg: false, color: 'bg-purple-500' },
		{ name: 'ห้องเล่นกับเพื่อน', desc: 'สร้างห้อง / เข้าร่วม', href: '/room', icon: '🎮', svg: false, color: 'bg-gradient-to-br from-slot-accent to-purple-600' },
		{ name: 'กิจกรรม', desc: 'โบนัส กงล้อ ภารกิจ', href: '/events', icon: '🎁', svg: false, color: 'bg-gradient-to-br from-amber-500 to-orange-600' },
	];

</script>

<svelte:head>
	<title>BUNG TAE DUBAI - Casino</title>
</svelte:head>

<div class="select-none">
	<div class="mb-6 text-center">
		<h1 class="mb-1 text-2xl font-bold text-slot-accent sm:text-3xl">BUNG TAE DUBAI</h1>
		<p class="text-xs text-slot-muted sm:text-sm">เลือกเกมที่ต้องการเล่น</p>
	</div>

	<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 sm:gap-4">
		{#each games as game}
			<a
				href={game.href}
				class="game-card group flex flex-col items-center rounded-xl border border-slot-border bg-slot-surface p-4 transition hover:border-slot-accent/40 hover:shadow-md active:scale-[0.98] sm:p-5"
			>
				<div class="mb-3 flex h-14 w-14 items-center justify-center rounded-xl {game.color} text-3xl sm:h-16 sm:w-16 sm:text-4xl">
					{#if game.svg}
						{@html game.icon}
					{:else}
						{game.icon}
					{/if}
				</div>
				<p class="text-sm font-bold text-slot-text group-hover:text-slot-accent sm:text-base">{game.name}</p>
				<p class="mt-0.5 text-[10px] text-slot-muted sm:text-xs">{game.desc}</p>
			</a>
		{/each}
	</div>
</div>
