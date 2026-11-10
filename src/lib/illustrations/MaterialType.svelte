<script lang="ts">
	// Tipo di materiale: il sacco appoggiato a terra, gonfio come un cuscino, con
	// un'etichetta che mostra il pellet che contiene. Tutto dello stesso rosso: un materiale
	// solo, non una miscela.
	const label = [
		[104, 110],
		[120, 110],
		[136, 110],
		[104, 128],
		[120, 128],
		[136, 128]
	] as const;
	const ground = [
		[40, 180],
		[56, 186],
		[186, 186],
		[202, 180]
	] as const;
</script>

<svg class="gv-illu bold" viewBox="0 0 240 200" aria-hidden="true">
	<ellipse class="bg" cx="120" cy="106" rx="104" ry="86" />
	<!-- Angoli a punta e lati un po' rientrati, sopra gonfio e sotto schiacciato a terra. -->
	<path class="sf" d="M46 76 Q120 42 194 76 Q178 122 198 168 Q120 180 42 168 Q62 122 46 76 Z" />
	<!-- Le due cuciture di chiusura ai lati corti. -->
	<path class="ln-detail" d="M62 74 Q74 122 58 164" stroke-dasharray="2 8" />
	<path class="ln-detail" d="M178 74 Q166 122 182 164" stroke-dasharray="2 8" />
	<rect class="sf" x="86" y="94" width="68" height="52" rx="8" />
	{#each label as [x, y], i (i)}
		<circle class="accent" cx={x} cy={y} r="7" />
	{/each}
	{#each ground as [x, y], i (i)}
		<circle class="accent" cx={x} cy={y} r="7" />
	{/each}
	<g transform="translate(192 66)">
		<circle class="ok" r="18" />
		<path class="ok-mark" d="M-8 0.5 L-2.5 6 L8.5 -6" />
	</g>
</svg>
