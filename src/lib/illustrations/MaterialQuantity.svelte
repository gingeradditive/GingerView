<script lang="ts">
	// Quantità sufficiente: il mucchio di pellet sulla bilancia. La lancetta oscilla appena
	// attorno al valore, come una bilancia che si assesta.
	const rows: [number, number[]][] = [
		[98, [101, 115, 129, 143, 157, 171, 185, 199, 213]],
		[86, [108, 122, 136, 150, 164, 178, 192, 206]],
		[74, [129, 143, 157, 171, 185]],
		[62, [150, 164]]
	];
	const pellets = rows.flatMap(([y, xs]) => xs.map((x) => [x, y] as const));
	// Le tacche del quadrante, da sinistra a destra.
	const ticks =
		'M147.9 152.8 L144.9 151 M151.8 148.9 L150 145.9 M157 147.5 L157 144 M162.2 148.9 L164 145.9 M166.1 152.8 L169.1 151';
</script>

<svg class="gv-illu bold" viewBox="0 0 302 242" aria-hidden="true">
	<ellipse class="bg" cx="157" cy="104" rx="100" ry="92" />
	{#each pellets as [x, y], i (i)}
		<circle class="accent" cx={x} cy={y} r="6.5" />
	{/each}
	<line class="ln" x1="88" y1="109" x2="226" y2="109" />
	<rect class="dark" x="145" y="110" width="24" height="17" />
	<path
		class="sf"
		d="M104 128 L210 128 Q216 128 218 134 L227 176 Q228 184 220 184 L94 184 Q86 184 87 176 L96 134 Q98 128 104 128 Z"
	/>
	<circle class="sf" cx="157" cy="158" r="20" />
	<path class="ln-detail" d={ticks} style:stroke-width="3" />
	<line class="ln-accent needle" x1="157" y1="158" x2="163.9" y2="148.2" style:stroke-width="4" />
	<circle class="dark" cx="157" cy="158" r="3.5" />
	<g transform="translate(230 58)">
		<circle class="ok" r="17" />
		<path class="ok-mark" d="M-8 0.5 L-2 6.5 L9 -5.5" style:stroke-width="4.5" />
	</g>
</svg>

<style>
	.needle {
		transform-origin: 157px 158px;
		animation: weigh 2.8s ease-in-out infinite;
	}

	@keyframes weigh {
		0%,
		100% {
			transform: rotate(0deg);
		}
		35% {
			transform: rotate(-9deg);
		}
		60% {
			transform: rotate(4deg);
		}
		80% {
			transform: rotate(-1.5deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.needle {
			animation: none;
		}
	}
</style>
