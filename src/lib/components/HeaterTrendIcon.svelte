<script lang="ts">
	import { Flame, Snowflake } from 'lucide-svelte';
	import { fade } from 'svelte/transition';
	import type { HeaterTrend } from '$lib/utils/heater-trend';

	/**
	 * L'icona che dice dove va una banda della dashboard: fiamma se si scalda, fiocco di neve
	 * se si raffredda, niente a temperatura o da spenta e fredda.
	 *
	 * Animazioni leggere apposta: le bande sono tante e l'occhio deve restare sui numeri. La
	 * fiamma tremola, il fiocco gira piano; con "riduci movimento" restano ferme.
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
			<Flame strokeWidth={2.4} />
		{:else}
			<Snowflake strokeWidth={2.4} />
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

	/* Il tremolio parte dalla base, come una fiamma vera. */
	.heating :global(svg) {
		transform-origin: 50% 90%;
		animation: flicker 1.2s ease-in-out infinite;
	}

	.cooling :global(svg) {
		animation: drift 8s linear infinite;
	}

	@keyframes flicker {
		0%,
		100% {
			transform: scaleY(1) scaleX(1);
			opacity: 1;
		}
		30% {
			transform: scaleY(1.12) scaleX(0.95);
			opacity: 0.85;
		}
		60% {
			transform: scaleY(0.96) scaleX(1.03);
			opacity: 0.95;
		}
	}

	@keyframes drift {
		0% {
			transform: rotate(0deg);
			opacity: 1;
		}
		50% {
			transform: rotate(180deg);
			opacity: 0.7;
		}
		100% {
			transform: rotate(360deg);
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.heating :global(svg),
		.cooling :global(svg) {
			animation: none;
		}
	}
</style>
