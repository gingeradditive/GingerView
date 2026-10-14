<!-- La G2 vista di fronte, con la testa che stampa un vaso: l'apertura della demo. -->
<svg class="gv-illu" viewBox="0 0 240 160" aria-hidden="true">
	<ellipse class="bg" cx="120" cy="86" rx="110" ry="70" />
	<rect class="sf-gray" x="150" y="4" width="34" height="18" rx="4" />
	<rect class="sf" x="40" y="16" width="160" height="128" rx="10" />
	<rect class="inner" x="52" y="28" width="136" height="96" rx="5" />
	<rect class="dark" x="52" y="42" width="136" height="7" rx="2" />
	<path class="vase" d="M104 112 C98 100 101 90 110 84 H130 C139 90 142 100 136 112 Z" />
	<path class="ln-thin" d="M101 102 H139 M102 94 H138" />
	<g class="head">
		<rect class="accent" x="108" y="38" width="24" height="24" rx="4" />
		<path class="dark" d="M115 62 H125 L122 72 H118 Z" />
	</g>
	<rect class="dark" x="60" y="112" width="120" height="6" rx="2" />
	<text x="120" y="137" text-anchor="middle">G2</text>
	<rect class="dark" x="50" y="144" width="16" height="6" rx="2" />
	<rect class="dark" x="174" y="144" width="16" height="6" rx="2" />
</svg>

<style>
	.inner {
		fill: var(--color-background);
		stroke: var(--color-text-subtle);
		stroke-width: 2;
	}

	.vase {
		fill: var(--color-danger-bg);
		stroke: var(--color-red);
		stroke-width: 3;
		stroke-linejoin: round;
	}

	text {
		font-family: var(--font-sans);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.1em;
		fill: var(--color-text-muted);
	}

	.head {
		animation: travel 3s ease-in-out infinite;
	}

	@keyframes travel {
		0%,
		100% {
			transform: translateX(-14px);
		}
		50% {
			transform: translateX(14px);
		}
	}
</style>
