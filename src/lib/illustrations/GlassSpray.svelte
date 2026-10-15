<script lang="ts">
	// La bomboletta che spruzza il protettivo sul vetro del piano.
	const mist = [
		[104, 52, 3],
		[114, 60, 2.5],
		[110, 46, 2],
		[124, 66, 3],
		[120, 52, 2],
		[134, 72, 2.5],
		[130, 58, 3],
		[144, 78, 2],
		[140, 66, 2.5],
		[154, 84, 3],
		[126, 78, 2],
		[150, 70, 2]
	] as const;
</script>

<svg class="gv-illu" viewBox="0 0 240 160" aria-hidden="true">
	<ellipse class="bg" cx="120" cy="84" rx="100" ry="70" />
	<path class="sf-gray" d="M64 120 V128 H192 V120 Z" />
	<path class="sf-gray" d="M192 128 L222 96 V88 L192 120 Z" />
	<path class="sf" d="M64 120 L192 120 L222 88 L94 88 Z" />
	<path class="spray-film" d="M110 112 L170 112 L184 96 L124 96 Z" />
	<path class="ln-thin shine" d="M136 106 L146 96 M150 108 L160 98" />
	<g transform="rotate(-38 58 74)">
		<rect class="sf" x="40" y="48" width="36" height="70" rx="8" />
		<rect class="accent" x="40" y="70" width="36" height="22" />
		<rect class="ln" x="40" y="48" width="36" height="70" rx="8" />
		<rect class="sf-gray" x="46" y="34" width="24" height="16" rx="4" />
		<rect class="dark" x="66" y="36" width="10" height="7" rx="2" />
	</g>
	{#each mist as [x, y, r], i (i)}
		<circle class="gray mist" cx={x} cy={y} {r} style:animation-delay="{(i % 4) * 0.25}s" />
	{/each}
</svg>

<style>
	.spray-film {
		fill: rgba(var(--rgb-info), 0.12);
	}

	.mist {
		animation: drift 1.4s ease-out infinite;
	}

	@keyframes drift {
		0% {
			opacity: 0;
			transform: translate(-6px, -4px);
		}
		30% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translate(6px, 6px);
		}
	}
</style>
