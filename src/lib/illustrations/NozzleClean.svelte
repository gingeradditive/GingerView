<script lang="ts">
	// La testa con l'ugello da pulire: sulla punta c'è un grumo di plastica colata e indurita,
	// che viene staccato e portato via; poi le scintille dicono "niente residui sulla punta".
	// Tutto in un ciclo solo (CYCLE), così grumo e scintille restano sincronizzati.
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
	<!-- Il grumo di plastica attaccato alla punta, che viene tolto. -->
	<rect class="accent blob" x="113" y="122" width="14" height="12" rx="3" />
	{#each sparkles as [x, y, s], i (i)}
		<!-- La posizione sta sul gruppo: l'animazione CSS della stella la sostituirebbe. -->
		<g transform="translate({x} {y}) scale({s})">
			<path class="accent sparkle" d={sparkle} style:animation-delay="{i * 0.12}s" />
		</g>
	{/each}
	<g transform="translate(184 74)">
		<circle class="ok" r="15" />
		<path class="ok-mark" d="M-6.5 0.5 L-2 5 L7 -5" />
	</g>
</svg>

<style>
	.gv-illu {
		--cycle: 3.2s;
	}

	/* Cola dalla punta (altezza da zero, cresce verso il basso con un piccolo rimbalzo da
	   goccia), resta lì, una scossa come a staccarlo, poi via in basso a destra ruotando e
	   sparendo. Torna al suo posto mentre è invisibile. */
	.blob {
		transform-box: fill-box;
		transform-origin: center top;
		animation: blob-off var(--cycle) ease-in-out infinite;
	}

	@keyframes blob-off {
		0% {
			transform: translate(0, 0) rotate(0deg) scaleY(0);
			opacity: 1;
		}
		7% {
			transform: translate(0, 0) rotate(0deg) scaleY(1.15);
		}
		10%,
		18% {
			transform: translate(0, 0) rotate(0deg) scaleY(1);
			opacity: 1;
		}
		24% {
			transform: translate(-1.5px, 0) rotate(-6deg);
		}
		30% {
			transform: translate(1.5px, 0) rotate(6deg);
			opacity: 1;
		}
		52% {
			transform: translate(34px, 26px) rotate(40deg);
			opacity: 0;
		}
		53%,
		100% {
			transform: translate(0, 0) rotate(0deg);
			opacity: 0;
		}
	}

	/* Le scintille solo a punta pulita, dopo che il grumo se n'è andato. */
	.sparkle {
		transform-box: fill-box;
		transform-origin: center;
		opacity: 0;
		animation: sparkle-in var(--cycle) ease-in-out infinite;
	}

	@keyframes sparkle-in {
		0%,
		50% {
			opacity: 0;
			transform: scale(0.4);
		}
		60% {
			opacity: 1;
			transform: scale(1.1);
		}
		68% {
			transform: scale(1);
		}
		80% {
			opacity: 0.35;
		}
		90% {
			opacity: 1;
		}
		98%,
		100% {
			opacity: 0;
		}
	}

	/* Senza animazioni: l'ugello già pulito, con le scintille. */
	@media (prefers-reduced-motion: reduce) {
		.blob {
			animation: none;
			opacity: 0;
		}

		.sparkle {
			animation: none;
			opacity: 1;
		}
	}
</style>
