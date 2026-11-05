<script lang="ts">
	import HeaterTrendIcon from '$lib/components/HeaterTrendIcon.svelte';
	import { describeTrend, heaterTrend } from '$lib/utils/heater-trend';

	let {
		index,
		temperature,
		target
	}: {
		index: number;
		temperature: number | null;
		target: number | null;
	} = $props();

	const trend = $derived(heaterTrend(temperature, target));
	const hasSet = $derived(target != null && !Number.isNaN(target) && target > 0);
	// Il target sotto la temperatura resta finché non ci si arriva, in salita o in discesa.
	const showSet = $derived(hasSet && trend !== 'ready');

	const formatTemperature = (value: number | null): string => {
		if (value == null || Number.isNaN(value)) return '--';
		return `${Math.round(value)}`;
	};
</script>

<div
	class="extruder-card {trend}"
	aria-label={`Zone ${index}: ${formatTemperature(temperature)}°, ${describeTrend(trend, target)}`}
>
	<span class="index">{index}</span>
	<div class={`temperature-stack ${showSet ? 'with-set' : ''}`}>
		<span class="temperature {trend}"
			>{formatTemperature(temperature)}<span class="degree-symbol">°</span></span
		>
		{#if showSet}
			<span class="set-temperature">{formatTemperature(target)}</span>
		{/if}
	</div>
	<span class="trend-slot"><HeaterTrendIcon {trend} size={13} /></span>
</div>

<style>
	.extruder-card {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		position: relative;
		background: var(--color-gray-light);
		border: 1px solid var(--color-text-subtle);
		/* `--u` comes from DashboardTemperaturePanel: 1px unless the panel is short. */
		border-radius: calc(var(--u, 1px) * 5);
		width: calc(var(--u, 1px) * 100);
		height: calc(var(--u, 1px) * 53);
		padding: 0 calc(var(--u, 1px) * 7);
		box-sizing: border-box;
		transition:
			background-color 220ms ease,
			border-color 220ms ease;
	}

	.extruder-card.heating {
		border-color: var(--color-red);
	}

	.extruder-card.ready {
		border-color: var(--color-red);
		background: var(--color-red);
	}

	.extruder-card.cooling {
		border-color: rgba(var(--rgb-info), 0.7);
	}

	/* Al bordo destro, in asse con la temperatura: a sinistra c'è il numero della zona. */
	.trend-slot {
		position: absolute;
		top: 50%;
		right: calc(var(--u, 1px) * 6);
		transform: translateY(-50%);
		display: inline-flex;
	}

	.index {
		font-size: calc(var(--u, 1px) * 12.8);
		font-weight: 500;
		color: var(--color-surface-sunken);
		line-height: 1;
	}

	.temperature-stack {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1px;
	}

	.temperature-stack.with-set {
		transform: translate(-50%, -43%);
	}

	/* Con l'icona a destra il numero si sposta un poco a sinistra: con tre cifre il "°" la
	   toccava. */
	.extruder-card.heating .temperature-stack,
	.extruder-card.cooling .temperature-stack {
		transform: translate(calc(-50% - var(--u, 1px) * 5), -50%);
	}

	.extruder-card.heating .temperature-stack.with-set,
	.extruder-card.cooling .temperature-stack.with-set {
		transform: translate(calc(-50% - var(--u, 1px) * 5), -43%);
	}

	.temperature {
		font-size: calc(var(--u, 1px) * 24);
		font-weight: 600;
		color: var(--color-text-subtle);
		line-height: 1;
		position: relative;
	}

	.degree-symbol {
		font-size: 0.8em;
		position: absolute;
		left: 100%;
		top: 0;
	}

	.temperature.heating {
		color: var(--color-red);
	}

	.temperature.ready {
		color: var(--color-white);
	}

	.temperature.cooling {
		color: var(--color-info);
	}

	.set-temperature {
		font-size: calc(var(--u, 1px) * 12.8);
		font-weight: 500;
		line-height: 1;
		color: var(--color-white);
		opacity: 1;
	}

	@media (max-width: 767.98px) {
		.extruder-card {
			width: calc(var(--u, 1px) * 88);
			height: calc(var(--u, 1px) * 49);
		}

		.temperature {
			font-size: calc(var(--u, 1px) * 20);
		}
	}
</style>
