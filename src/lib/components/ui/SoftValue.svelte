<script lang="ts">
	import { fade } from 'svelte/transition';

	/**
	 * Un testo che cambia in dissolvenza: il vecchio sfuma mentre il nuovo compare, nello
	 * stesso punto (sovrapposti nella stessa cella della griglia). Per i valori stimati
	 * che si aggiornano ogni tanto, dove un salto secco si nota troppo.
	 */
	let { value }: { value: string } = $props();

	// Le transizioni di Svelte non passano dal CSS: il "movimento ridotto" va chiesto qui.
	const reducedMotion =
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const duration = reducedMotion ? 0 : 400;
</script>

<span class="soft">
	{#key value}
		<span class="layer" transition:fade={{ duration }}>{value}</span>
	{/key}
</span>

<style>
	.soft {
		display: inline-grid;
	}

	.layer {
		grid-area: 1 / 1;
		white-space: nowrap;
	}
</style>
