<script lang="ts">
	let {
		index,
		temperature,
		target
	}: {
		index: number;
		temperature: number | null;
		target: number | null;
	} = $props();

	const setTolerance = 5;

	const hasSet = $derived(target != null && !Number.isNaN(target) && target > 0);
	const isReady = $derived(
		hasSet &&
			temperature != null &&
			!Number.isNaN(temperature) &&
			Math.abs(temperature - (target as number)) <= setTolerance
	);
	const isHeating = $derived(
		hasSet &&
			!isReady &&
			temperature != null &&
			!Number.isNaN(temperature) &&
			temperature < (target as number)
	);
	const showSet = $derived(hasSet && !isReady);

	const formatTemperature = (value: number | null): string => {
		if (value == null || Number.isNaN(value)) return '--';
		return `${Math.round(value)}`;
	};
</script>

<div
	class={`extruder-card ${isHeating ? 'heating' : ''} ${isReady ? 'ready' : ''}`}
	aria-label={`Temperatura estrusore ${index}`}
>
	<span class="index">{index}</span>
	<div class={`temperature-stack ${showSet ? 'with-set' : ''}`}>
		<span class={`temperature ${isHeating ? 'heating' : ''} ${isReady ? 'ready' : ''}`}
			>{formatTemperature(temperature)}<span class="degree-symbol">°</span></span
		>
		{#if showSet}
			<span class="set-temperature">{formatTemperature(target)}</span>
		{/if}
	</div>
</div>

<style>
	.extruder-card {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		position: relative;
		background: var(--color-gray-light);
		border: 1px solid var(--color-text-subtle);
		border-radius: 5px;
		width: 100px;
		height: 53px;
		padding: 0 7px;
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

	.index {
		font-size: 0.8rem;
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

	.temperature {
		font-size: 1.5rem;
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

	.set-temperature {
		font-size: 0.8rem;
		font-weight: 500;
		line-height: 1;
		color: var(--color-white);
		opacity: 1;
	}

	@media (max-width: 767.98px) {
		.extruder-card {
			width: 88px;
			height: 49px;
		}

		.temperature {
			font-size: 1.25rem;
		}
	}
</style>
