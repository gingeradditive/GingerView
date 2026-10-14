<script lang="ts">
	/**
	 * Un valore sul suo totale scritto come frazione: il valore sopra, il totale
	 * sotto, separati da una barra orizzontale. Eredita dimensione e colore del
	 * testo da chi lo contiene. Per i lettori di schermo si legge "46.8 mm of 1050 mm".
	 */
	let { value, total }: { value: string; total: string } = $props();
</script>

<span class="fraction">
	<span class="numerator">{value}</span>
	<span class="sr-only"> of </span>
	<span class="denominator">{total}</span>
</span>

<style>
	.fraction {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		line-height: 1.15;
		white-space: nowrap;
	}

	.numerator,
	.denominator {
		padding: 0 0.25em;
	}

	.numerator {
		padding-bottom: 0.1em;
	}

	/* La barra della frazione: larga quanto il più lungo dei due numeri. */
	.denominator {
		align-self: stretch;
		text-align: center;
		padding-top: 0.1em;
		border-top: max(1.5px, 0.07em) solid currentColor;
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
