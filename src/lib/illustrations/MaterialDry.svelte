<script lang="ts">
	// Materiale asciutto: la goccia barrata. La barra si traccia, resta, poi riparte.
	// Lo stacco bianco attorno alla barra sta dentro la goccia (clip), fuori è del colore
	// dello sfondo: l'id del clip è unico per ogni istanza.
	const uid = $props.id();
	const drop = 'M151 38 C151 38 106 92 106 128 A45 45 0 0 0 196 128 C196 92 151 38 151 38 Z';
</script>

<svg class="gv-illu bold" viewBox="0 0 302 242" aria-hidden="true">
	<ellipse class="bg" cx="157" cy="104" rx="100" ry="92" />
	<path class="sf drop" d={drop} />
	<clipPath id="drop-{uid}"><path d={drop} /></clipPath>
	<g class="slash">
		<line class="gap-bg" x1="104" y1="58" x2="200" y2="176" />
		<line class="gap-in" x1="104" y1="58" x2="200" y2="176" clip-path="url(#drop-{uid})" />
		<line
			class="ln-accent bar"
			x1="104"
			y1="58"
			x2="200"
			y2="176"
			pathLength="100"
			style:stroke-width="7"
		/>
	</g>
	<g transform="translate(208 56)">
		<circle class="ok" r="17" />
		<path class="ok-mark" d="M-8 0.5 L-2 6.5 L9 -5.5" style:stroke-width="4.5" />
	</g>
</svg>

<style>
	.gap-bg,
	.gap-in {
		stroke-width: 16;
		fill: none;
	}

	.gap-bg {
		stroke: var(--color-background);
		stroke-linecap: round;
	}

	.gap-in {
		stroke: var(--color-white);
	}

	.bar {
		stroke-dasharray: 100 100;
		animation: strike 3.6s ease-in-out infinite;
	}

	/* La barra si traccia dall'alto, resta, sparisce in fretta e ricomincia. */
	@keyframes strike {
		0%,
		8% {
			stroke-dashoffset: 100;
		}
		30%,
		88% {
			stroke-dashoffset: 0;
			opacity: 1;
		}
		96% {
			stroke-dashoffset: 0;
			opacity: 0;
		}
		100% {
			stroke-dashoffset: 100;
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.bar {
			animation: none;
			stroke-dashoffset: 0;
		}
	}
</style>
