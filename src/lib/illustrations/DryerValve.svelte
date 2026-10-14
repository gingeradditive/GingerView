<!-- La valvola tra essiccatore e tubo: leva parallela al tubo = aperta, il pellet passa. -->
<svg class="gv-illu" viewBox="0 0 240 160" aria-hidden="true">
	<ellipse class="bg" cx="120" cy="84" rx="100" ry="70" />
	<rect class="sf-gray" x="22" y="14" width="68" height="58" rx="9" />
	<line class="ln-thin" x1="34" y1="28" x2="78" y2="28" />
	<line class="ln-thin" x1="34" y1="38" x2="64" y2="38" />
	<path class="pipe-wall" d="M56 72 V112 H214" />
	<path class="pipe-hollow" d="M56 72 V112 H214" />
	<path class="pellets" d="M56 76 V112 H210" />
	<g transform="translate(128 112)">
		<rect class="sf" x="-17" y="-17" width="34" height="34" rx="7" />
		<g class="lever">
			<rect class="accent" x="-34" y="-4" width="68" height="8" rx="4" />
			<circle class="dark" r="6" />
		</g>
	</g>
	<g transform="translate(190 66)">
		<circle class="ok" r="15" />
		<path class="ok-mark" d="M-6.5 0.5 L-2 5 L7 -5" />
	</g>
</svg>

<style>
	.pipe-wall {
		fill: none;
		stroke: var(--color-text-muted);
		stroke-width: 18;
		stroke-linejoin: round;
	}

	.pipe-hollow {
		fill: none;
		stroke: var(--color-white);
		stroke-width: 12;
		stroke-linejoin: round;
	}

	.pellets {
		fill: none;
		stroke: var(--color-red);
		stroke-width: 6;
		stroke-linecap: round;
		stroke-dasharray: 0.1 10;
		animation: flow 1.2s linear infinite;
	}

	.lever {
		transform-box: fill-box;
		transform-origin: center;
		animation: open 3.2s ease-in-out infinite;
	}

	@keyframes flow {
		to {
			stroke-dashoffset: -20.2;
		}
	}

	/* Chiusa (leva di traverso) → aperta (leva lungo il tubo), poi resta aperta. */
	@keyframes open {
		0%,
		12% {
			transform: rotate(-90deg);
		}
		35%,
		100% {
			transform: rotate(0deg);
		}
	}
</style>
