<script lang="ts">
	// Tubi di alimentazione puliti: dall'essiccatore alla testa, nessun pellet rimasto
	// dentro; le scintille lungo il tubo dicono "pulito".
	const tube = 'M75 132 C75 192 124 184 156 128 C184 79 240 58 240 112';
	const sparkles = [
		[85.1, 166.8, 6.5, 0],
		[115.8, 169.9, 4.5, 0.25],
		[151.1, 136, 5.5, 0.5],
		[197.7, 85.6, 6, 0.15],
		[230.8, 84.8, 4, 0.4]
	] as const;
	const star = (r: number) =>
		`M0 ${-r} Q1.2 -1.2 ${r} 0 Q1.2 1.2 0 ${r} Q-1.2 1.2 ${-r} 0 Q-1.2 -1.2 0 ${-r} Z`;
</script>

<svg class="gv-illu bold" viewBox="0 0 300 200" aria-hidden="true">
	<ellipse class="bg" cx="150" cy="103" rx="128" ry="84" />
	<path class="ln" d={tube} style:stroke-width="24" />
	<path class="ln-white" d={tube} style:stroke-width="12" />
	{#each sparkles as [x, y, r, delay], i (i)}
		<!-- La posizione sta sul gruppo: l'animazione CSS della stella la sostituirebbe. -->
		<g transform="translate({x} {y})">
			<path class="accent sparkle" d={star(r)} style:animation-delay="{delay}s" />
		</g>
	{/each}
	<!-- L'essiccatore. -->
	<rect class="sf-gray" x="66" y="120" width="18" height="16" rx="3" />
	<path class="sf" d="M31 46 L31 112 A44 13 0 0 0 119 112 L119 46 Z" />
	<ellipse class="sf-gray" cx="75" cy="46" rx="44" ry="13" />
	<rect class="sf-gray" x="53" y="68" width="44" height="16" rx="4" style:stroke-width="4" />
	<circle class="accent" cx="60" cy="100" r="5" />
	<line class="ln-thin" x1="72" y1="100" x2="96" y2="100" style:stroke-width="4" />
	<!-- La testa, col tubo che entra dall'alto. -->
	<path class="sf" d="M228 160 L252 160 L244 178 L236 178 Z" />
	<rect class="sf" x="221.5" y="143" width="37" height="19" rx="4" />
	<line class="ln-accent" x1="228" y1="149" x2="252" y2="149" style:stroke-width="3.5" />
	<line class="ln-accent" x1="228" y1="156" x2="252" y2="156" style:stroke-width="3.5" />
	<rect class="sf-gray" x="213.5" y="116" width="53" height="29" rx="7" />
	<rect class="sf-gray" x="230.5" y="108" width="19" height="10" rx="3" />
	<line class="ln-thin" x1="223" y1="127" x2="247" y2="127" style:stroke-width="3.5" />
	<line class="ln-thin" x1="223" y1="134" x2="239" y2="134" style:stroke-width="3.5" />
	<g transform="translate(160 64)">
		<circle class="ok" r="20" />
		<path class="ok-mark" d="M-9 0 L-3 6.5 L9 -6.5" style:stroke-width="5.5" />
	</g>
</svg>

<style>
	.sparkle {
		transform-box: fill-box;
		transform-origin: center;
		opacity: 0;
		animation: twinkle 3s ease-in-out infinite;
	}

	@keyframes twinkle {
		0% {
			transform: scale(0);
			opacity: 0;
		}
		12% {
			transform: scale(1.15);
			opacity: 1;
		}
		26% {
			transform: scale(0.85);
			opacity: 0.6;
		}
		40% {
			transform: scale(1);
			opacity: 1;
		}
		54% {
			transform: scale(0.8);
			opacity: 0.6;
		}
		64%,
		100% {
			transform: scale(0);
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.sparkle {
			animation: none;
			opacity: 1;
		}
	}
</style>
