<script lang="ts">
	import { ArrowDown, ArrowUp } from 'lucide-svelte';
	import { fade } from 'svelte/transition';
	import type { HeaterTrend } from '$lib/utils/heater-trend';

	/**
	 * L'icona che dice dove va una banda della dashboard: freccia su (rossa) se si scalda,
	 * freccia giù (blu) se si raffredda, niente a temperatura o da spenta e fredda.
	 *
	 * Animazione leggera apposta: le bande sono tante e l'occhio deve restare sui numeri. La
	 * freccia scivola di poco nella sua direzione e svanisce, poi riparte; con "riduci
	 * movimento" resta ferma.
	 *
	 * `size` è in `--u`, l'unità del disegno della card (vedi DashboardTemperaturePanel), così
	 * l'icona si rimpicciolisce insieme alle bande sugli schermi bassi.
	 */
	let { trend, size = 14 }: { trend: HeaterTrend; size?: number } = $props();
</script>

{#if trend === 'heating' || trend === 'cooling'}
	<span
		class="trend {trend}"
		style:--trend-size={size}
		aria-hidden="true"
		transition:fade={{ duration: 200 }}
	>
		{#if trend === 'heating'}
			<ArrowUp strokeWidth={2.8} />
		{:else}
			<ArrowDown strokeWidth={2.8} />
		{/if}
	</span>
{/if}

<style>
	.trend {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: calc(var(--u, 1px) * var(--trend-size));
		height: calc(var(--u, 1px) * var(--trend-size));
		flex-shrink: 0;
		pointer-events: none;
	}

	.trend :global(svg) {
		width: 100%;
		height: 100%;
	}

	.heating {
		color: var(--color-red);
	}

	.cooling {
		color: var(--color-info);
	}

	/* Di quanto scivola la freccia: una frazione della sua altezza, così vale a ogni misura. */
	.heating :global(svg) {
		animation: rise 1.6s ease-in-out infinite;
	}

	.cooling :global(svg) {
		animation: sink 1.6s ease-in-out infinite;
	}

	@keyframes rise {
		0% {
			transform: translateY(18%);
			opacity: 0.55;
		}
		50% {
			opacity: 1;
		}
		100% {
			transform: translateY(-18%);
			opacity: 0.55;
		}
	}

	@keyframes sink {
		0% {
			transform: translateY(-18%);
			opacity: 0.55;
		}
		50% {
			opacity: 1;
		}
		100% {
			transform: translateY(18%);
			opacity: 0.55;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.heating :global(svg),
		.cooling :global(svg) {
			animation: none;
		}
	}
</style>
