<script lang="ts">
	// Quantità sufficiente: la tramoggia (la stessa forma degli altri disegni) piena al 90%,
	// e accanto la barra di livello quasi piena.
	const rows = [119, 106, 93, 80];
	const pellets = rows.flatMap((y, row) =>
		(row % 2 ? [97, 112, 127] : [89, 104, 119]).map((x) => [x, y] as const)
	);
</script>

<svg class="gv-illu bold" viewBox="0 0 240 200" aria-hidden="true">
	<ellipse class="bg" cx="120" cy="106" rx="104" ry="86" />
	<path class="sf" d="M64 50 H148 V124 L124 148 H88 L64 124 Z" />
	<rect class="sf-gray" x="58" y="38" width="96" height="16" rx="6" />
	<rect class="sf" x="76" y="66" width="62" height="62" rx="9" />
	{#each pellets as [x, y], i (i)}
		<circle class="accent" cx={x} cy={y} r="7" />
	{/each}
	<rect class="sf-gray" x="96" y="148" width="20" height="16" rx="4" />
	<rect class="sf" x="164" y="66" width="20" height="98" rx="10" />
	<rect class="accent" x="170" y="80" width="8" height="78" rx="4" />
	<g transform="translate(170 36)">
		<circle class="ok" r="18" />
		<path class="ok-mark" d="M-8 0.5 L-2.5 6 L8.5 -6" />
	</g>
</svg>
