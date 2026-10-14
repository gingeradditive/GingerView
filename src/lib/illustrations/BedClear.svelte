<!-- Il piano vuoto sotto l'ugello: nessun pezzo, nessun residuo. -->
<svg class="gv-illu" viewBox="0 0 240 160" aria-hidden="true">
	<ellipse class="bg" cx="120" cy="84" rx="100" ry="70" />
	<path class="sf-gray" d="M34 112 V122 H172 V112 Z" />
	<path class="sf-gray" d="M172 122 L208 84 V74 L172 112 Z" />
	<path class="sf" d="M34 112 L172 112 L208 74 L70 74 Z" />
	<path class="ln-thin" d="M80 74 L46 112 M114 74 L80 112 M148 74 L114 112 M182 74 L148 112" />
	<path class="ln-thin" d="M52 93 H190" />
	<rect class="sf-gray" x="108" y="14" width="32" height="20" rx="4" />
	<path class="sf" d="M112 34 H136 L128 50 H120 Z" />
	<line class="ln-thin sweep" x1="124" y1="54" x2="124" y2="70" stroke-dasharray="3 4" />
	<path class="ln-accent sweep-arrow" d="M58 104 Q118 82 186 88 M178 81 L187 88 L178 95" />
	<g transform="translate(196 36)">
		<circle class="ok" r="15" />
		<path class="ok-mark" d="M-6.5 0.5 L-2 5 L7 -5" />
	</g>
</svg>

<style>
	.sweep-arrow {
		stroke-dasharray: 160;
		animation: sweep 2.4s ease-in-out infinite;
	}

	@keyframes sweep {
		0% {
			stroke-dashoffset: 160;
		}
		45%,
		100% {
			stroke-dashoffset: 0;
		}
	}
</style>
