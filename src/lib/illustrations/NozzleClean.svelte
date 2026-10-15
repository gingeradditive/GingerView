<script lang="ts">
	// La testa con l'ugello pulito: le scintille dicono "niente residui sulla punta".
	const sparkle = 'M0 -9 L2.4 -2.4 L9 0 L2.4 2.4 L0 9 L-2.4 2.4 L-9 0 L-2.4 -2.4 Z';
	const sparkles = [
		[154, 116, 1],
		[86, 106, 0.7],
		[142, 140, 0.55]
	] as const;
</script>

<svg class="gv-illu" viewBox="0 0 240 160" aria-hidden="true">
	<ellipse class="bg" cx="120" cy="84" rx="100" ry="70" />
	<rect class="sf-gray" x="78" y="16" width="84" height="44" rx="9" />
	<line class="ln-thin" x1="92" y1="30" x2="148" y2="30" />
	<line class="ln-thin" x1="92" y1="40" x2="132" y2="40" />
	<rect class="sf" x="90" y="60" width="60" height="28" rx="5" />
	<rect class="accent" x="96" y="67" width="48" height="5" rx="2" />
	<rect class="accent" x="96" y="76" width="48" height="5" rx="2" />
	<path class="sf" d="M102 88 H138 L126 116 H114 Z" />
	<rect class="dark" x="115" y="116" width="10" height="7" rx="1.5" />
	{#each sparkles as [x, y, s], i (i)}
		<path
			class="accent sparkle"
			d={sparkle}
			transform="translate({x} {y}) scale({s})"
			style:animation-delay="{i * 0.5}s"
		/>
	{/each}
	<g transform="translate(184 74)">
		<circle class="ok" r="15" />
		<path class="ok-mark" d="M-6.5 0.5 L-2 5 L7 -5" />
	</g>
</svg>

<style>
	.sparkle {
		transform-box: fill-box;
		transform-origin: center;
		animation: twinkle 1.8s ease-in-out infinite;
	}

	@keyframes twinkle {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.25;
		}
	}
</style>
