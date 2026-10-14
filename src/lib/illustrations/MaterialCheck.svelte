<script lang="ts">
	// Essiccatore con il pellet in vista: tipo, quantità (la linea di livello) e asciutto
	// (la goccia barrata).
	const pellets = [
		[102, 96, 'accent'],
		[112, 98, 'dark'],
		[122, 96, 'accent'],
		[132, 98, 'gray'],
		[138, 90, 'accent'],
		[107, 88, 'gray'],
		[117, 89, 'accent'],
		[128, 88, 'dark'],
		[101, 80, 'accent'],
		[111, 79, 'dark'],
		[122, 80, 'gray'],
		[133, 79, 'accent'],
		[106, 71, 'gray'],
		[117, 70, 'accent'],
		[128, 71, 'dark'],
		[138, 70, 'accent']
	] as const;
</script>

<svg class="gv-illu" viewBox="0 0 240 160" aria-hidden="true">
	<ellipse class="bg" cx="120" cy="84" rx="100" ry="70" />
	<path class="sf" d="M78 30 H162 V104 L138 128 H102 L78 104 Z" />
	<rect class="sf-gray" x="72" y="20" width="96" height="14" rx="5" />
	<rect class="sf" x="94" y="46" width="52" height="60" rx="8" />
	{#each pellets as [x, y, tone], i (i)}
		<circle class="{tone} pellet" cx={x} cy={y} r="4.2" style:animation-delay="{(i % 5) * 0.18}s" />
	{/each}
	<line class="ln-accent level" x1="90" y1="62" x2="150" y2="62" stroke-dasharray="5 5" />
	<rect class="sf-gray" x="110" y="128" width="20" height="14" rx="3" />
	<g transform="translate(184 46)">
		<circle class="sf" r="20" />
		<path class="ln" d="M0 -11 C6 -3 9 2 9 6 A9 9 0 0 1 -9 6 C-9 2 -6 -3 0 -11 Z" />
		<line class="ln-accent" x1="-13" y1="13" x2="13" y2="-13" />
	</g>
</svg>

<style>
	.pellet {
		animation: settle 2.4s ease-in-out infinite;
	}

	@keyframes settle {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(1.5px);
		}
	}
</style>
