<!--
	La G2 stilizzata come le altre illustrazioni: il cubo di profilati con gli angolari rossi,
	il gantry con la testa che scorre e il tubo del materiale, un vaso sul piano rosso e un
	sacco di pellet sul fondo.
-->
<svg class="gv-illu" viewBox="0 0 240 160" aria-hidden="true">
	<ellipse class="bg" cx="120" cy="84" rx="104" ry="72" />

	<!-- Faccia dietro, più leggera. -->
	<path class="ln-thin" d="M86 116 V16 H186 V116 Z" />
	<path class="ln-thin" d="M56 140 L86 116" />

	<!-- Il sacco di pellet sul fondo. -->
	<path class="sf-gray" d="M160 116 V96 Q160 90 166 90 H174 Q180 90 180 96 V116 Z" />
	<path class="ln-thin" d="M163 96 Q170 99 177 96" />

	<!-- Il piano di vetro e il vaso in stampa. -->
	<path class="bed" d="M58 138 H154 L184 114 H88 Z" />
	<path class="vase" d="M110 130 C106 122 108 115 113 112 H127 C132 115 134 122 130 130 Z" />
	<path class="ln-thin vase-lines" d="M109 124 H131 M110 118 H130" />

	<!-- Spigoli laterali e il gantry. -->
	<path class="ln" d="M56 40 L86 16 M156 40 L186 16 M156 140 L186 116" />
	<path class="ln gantry" d="M71 78 H171" />

	<g class="head">
		<path class="ln-thin" d="M140 16 C140 40 120 40 120 70" />
		<rect class="accent" x="111" y="70" width="18" height="16" rx="3" />
		<path class="sf" d="M114 86 H126 L122 96 H118 Z" />
	</g>

	<!-- Faccia davanti. -->
	<rect class="frame" x="56" y="40" width="100" height="100" rx="3" />

	<!-- Angolari rossi. -->
	<g class="accent">
		<rect x="51" y="35" width="10" height="10" rx="2.5" />
		<rect x="151" y="35" width="10" height="10" rx="2.5" />
		<rect x="51" y="135" width="10" height="10" rx="2.5" />
		<rect x="151" y="135" width="10" height="10" rx="2.5" />
		<rect x="82" y="12" width="8" height="8" rx="2" />
		<rect x="182" y="12" width="8" height="8" rx="2" />
		<rect x="182" y="112" width="8" height="8" rx="2" />
	</g>
</svg>

<style>
	.frame {
		fill: none;
		stroke: var(--color-text-muted);
		stroke-width: 4;
	}

	.gantry {
		stroke-width: 5;
	}

	.bed {
		fill: var(--color-danger-bg);
		stroke: var(--color-red);
		stroke-width: 3;
		stroke-linejoin: round;
	}

	.vase {
		fill: var(--color-white);
		stroke: var(--color-red);
		stroke-width: 3;
		stroke-linejoin: round;
	}

	.vase-lines {
		stroke: var(--color-red);
		opacity: 0.5;
	}

	/* La testa va avanti e indietro lungo il gantry. */
	.head {
		animation: travel 3.2s ease-in-out infinite;
	}

	@keyframes travel {
		0%,
		100% {
			transform: translateX(-22px);
		}
		50% {
			transform: translateX(22px);
		}
	}
</style>
