<script lang="ts">
	// Tipo di materiale: il sacco appoggiato a terra, con l'etichetta che mostra il pellet.
	// Tutto dello stesso rosso: un materiale solo, non una miscela. Il sacco "respira"
	// appena, come un cuscino che si assesta.
	const pellets = [
		[148.6, 77.1],
		[164.8, 86.4],
		[181, 95.7],
		[156.4, 72],
		[172.6, 81.3],
		[188.8, 90.6]
	] as const;
</script>

<svg class="gv-illu bold" viewBox="0 0 302 242" aria-hidden="true">
	<ellipse class="bg" cx="157" cy="104" rx="100" ry="92" />
	<g class="sack">
		<path
			class="sf"
			d="M58 118 C70 98 80 88 100 75 S150 48 172 40 L256 89 Q249 108 224 123 L153 159 Q146 163 139 164 Z"
		/>
		<path
			class="ln-detail"
			d="M72 116 L122 142 Q131 147 132 154"
			style:stroke-width="4.5"
			stroke-dasharray="0.1 8.5"
		/>
		<path class="ln" d="M140 162 C140 152 145 140 159 132 L218 98 Q236 88 255 88" />
		<path class="ln" d="M79 98 L146 134.5" />
		<path class="ln" d="M118 83 L153 61 L207 92 L169 116 Z M130 76 L180 108" />
		{#each pellets as [x, y], i (i)}
			<circle class="accent" cx={x} cy={y} r="3.8" />
		{/each}
	</g>
	<g transform="translate(240 56)">
		<circle class="ok" r="17" />
		<path class="ok-mark" d="M-8 0.5 L-2 6.5 L9 -5.5" style:stroke-width="4.5" />
	</g>
</svg>

<style>
	.sack {
		transform-box: fill-box;
		transform-origin: center bottom;
		animation: settle 3.2s ease-in-out infinite;
	}

	@keyframes settle {
		0%,
		100% {
			transform: scale(1, 1);
		}
		50% {
			transform: scale(1.012, 0.975);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.sack {
			animation: none;
		}
	}
</style>
