<script lang="ts">
	// La saracinesca dell'essiccatore: la lama si apre, il pellet scende nel tubo e arriva
	// fino in fondo, poi la scena ricomincia. Il maschera che "scopre" il tubo ha un id
	// unico per istanza.
	const uid = $props.id();
	const tube = 'M110 92 L110 150 Q110 168 128 168 L264 168';
	const lower = 'M110 138 L110 150 Q110 168 128 168 L262 168';
</script>

<svg class="gv-illu bold" viewBox="0 0 300 200" aria-hidden="true">
	<defs>
		<mask id="reveal-{uid}" maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="200">
			<!-- Nelle maschere conta la luminosità: bianco vero, non il colore del tema. -->
			<path class="reveal" d={lower} pathLength="100" fill="none" stroke="#fff" stroke-width="20" />
		</mask>
	</defs>
	<ellipse class="bg" cx="150" cy="103" rx="128" ry="84" />
	<path class="ln" d={tube} style:stroke-width="26" />
	<path class="ln-white" d={tube} style:stroke-width="14" />
	<path class="ln-accent dots" d="M110 100 L110 124" style:stroke-width="8" />
	<g class="low" mask="url(#reveal-{uid})">
		<path class="ln-accent dots" d={lower} style:stroke-width="8" />
	</g>
	<!-- L'essiccatore. -->
	<path class="sf" d="M70 24 L70 84 A40 12 0 0 0 150 84 L150 24 Z" />
	<ellipse class="sf-gray" cx="110" cy="24" rx="40" ry="12" />
	<rect class="sf-gray" x="90" y="44" width="40" height="15" rx="4" style:stroke-width="4" />
	<circle class="accent" cx="96" cy="73" r="4.5" />
	<line class="ln-thin" x1="107" y1="73" x2="128" y2="73" style:stroke-width="4" />
	<!-- La saracinesca: la sede, il foro e la lama rossa con la maniglia. -->
	<rect class="sf-gray" x="92" y="122" width="80" height="18" rx="4" />
	<rect class="white" x="104" y="126" width="12" height="10" />
	<g class="gate">
		<line class="ln" x1="131" y1="131" x2="186" y2="131" style:stroke-width="4" />
		<rect class="accent" x="99" y="127" width="32" height="8" rx="2" />
		<rect class="sf" x="184" y="123" width="10" height="16" rx="3" style:stroke-width="5" />
	</g>
	<g transform="translate(236 56)">
		<circle class="ok" r="20" />
		<path class="ok-mark" d="M-9 0 L-3 6.5 L9 -6.5" style:stroke-width="5.5" />
	</g>
</svg>

<style>
	.dots {
		stroke-dasharray: 0.1 12;
		animation: flow 4s linear infinite;
	}

	.gate {
		animation: gate 4s ease-in-out infinite;
	}

	.reveal {
		stroke-dasharray: 100 100;
		animation: reveal 4s linear infinite;
	}

	.low {
		animation: fade 4s linear infinite;
	}

	/* La lama si apre, il pellet scorre e scopre il tubo, poi tutto torna chiuso. */
	@keyframes gate {
		0%,
		15% {
			transform: translateX(0);
		}
		30%,
		85% {
			transform: translateX(34px);
		}
		100% {
			transform: translateX(0);
		}
	}

	@keyframes flow {
		0%,
		30% {
			stroke-dashoffset: 0;
		}
		85%,
		100% {
			stroke-dashoffset: -96;
		}
	}

	@keyframes reveal {
		0%,
		30% {
			stroke-dashoffset: 100;
		}
		50%,
		100% {
			stroke-dashoffset: 0;
		}
	}

	@keyframes fade {
		0%,
		84% {
			opacity: 1;
		}
		92%,
		100% {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.dots,
		.low {
			animation: none;
		}

		.gate {
			animation: none;
			transform: translateX(34px);
		}

		.reveal {
			animation: none;
			stroke-dashoffset: 0;
		}
	}
</style>
