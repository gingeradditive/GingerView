<script lang="ts">
	// Il tubo dall'essiccatore all'estrusore, vuoto: dentro passa solo aria.
	const tube = 'M48 62 C48 128 112 132 140 104 S184 56 196 66';
</script>

<svg class="gv-illu" viewBox="0 0 240 160" aria-hidden="true">
	<ellipse class="bg" cx="120" cy="84" rx="100" ry="70" />
	<rect class="sf-gray" x="24" y="26" width="48" height="36" rx="6" />
	<line class="ln-thin" x1="34" y1="38" x2="62" y2="38" />
	<path class="tube-wall" d={tube} />
	<path class="tube-hollow" d={tube} />
	<path class="tube-air" d={tube} />
	<path class="sf" d="M180 30 H216 V48 L204 62 H192 L180 48 Z" />
	<g transform="translate(108 54)">
		<circle class="ok" r="15" />
		<path class="ok-mark" d="M-6.5 0.5 L-2 5 L7 -5" />
	</g>
</svg>

<style>
	.tube-wall {
		fill: none;
		stroke: var(--color-text-muted);
		stroke-width: 20;
		stroke-linecap: round;
	}

	.tube-hollow {
		fill: none;
		stroke: var(--color-white);
		stroke-width: 14;
		stroke-linecap: round;
	}

	.tube-air {
		fill: none;
		stroke: var(--color-info-soft);
		stroke-width: 3;
		stroke-linecap: round;
		stroke-dasharray: 2 12;
		animation: flow 1.6s linear infinite;
	}

	@keyframes flow {
		to {
			stroke-dashoffset: -28;
		}
	}
</style>
