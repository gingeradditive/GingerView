<script lang="ts">
	/**
	 * Un valore sul suo totale scritto come frazione: il valore sopra, il totale
	 * sotto, separati da una barra orizzontale, e l'unità una sola volta, a destra
	 * all'altezza della barra. Eredita dimensione e colore del testo da chi lo
	 * contiene. Per i lettori di schermo si legge "46.8 of 1050 mm".
	 */
	let { value, total, unit }: { value: string; total: string; unit: string } = $props();
</script>

<span class="fraction">
	<span class="numerator">{value}</span>
	<span class="sr-only"> of </span>
	<span class="denominator">{total}</span>
	<span class="unit">{unit}</span>
</span>

<style>
	.fraction {
		display: inline-grid;
		grid-template-columns: auto auto;
		align-items: center;
		column-gap: 0.3em;
		line-height: 1.15;
		white-space: nowrap;
	}

	.numerator,
	.denominator {
		grid-column: 1;
		text-align: center;
		padding: 0 0.2em;
	}

	.numerator {
		grid-row: 1;
		padding-bottom: 0.1em;
	}

	/* La barra della frazione: larga quanto il più lungo dei due numeri. */
	.denominator {
		grid-row: 2;
		padding-top: 0.1em;
		border-top: max(1.5px, 0.07em) solid currentColor;
	}

	.unit {
		grid-column: 2;
		grid-row: 1 / 3;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
