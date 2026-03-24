<script lang="ts">
	let {
		index,
		temperature
	}: {
		index: number;
		temperature: number | null;
	} = $props();

	const formatTemperature = (value: number | null): string => {
		if (value == null || Number.isNaN(value)) return '--°';
		return `${Math.round(value)}°`;
	};
</script>

<div class="extruder-card" aria-label={`Temperatura estrusore ${index}`}>
	<span class="index">{index}</span>
	<span class="temperature">{formatTemperature(temperature)}</span>
</div>

<style>
	.extruder-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: #b9b9bc;
		border: 1px solid #8f8f93;
		border-radius: 5px;
		width: 80px;
		height: 42px;
		padding: 0 7px;
		box-sizing: border-box;
	}

	.index {
		font-size: 0.8rem;
		font-weight: 500;
		color: #ececec;
		line-height: 1;
	}

	.temperature {
		font-size: 1.5rem;
		font-weight: 700;
		color: #7a7a7e;
		line-height: 1;
	}

	@media (max-width: 640px) {
		.extruder-card {
			width: 70px;
			height: 39px;
		}

		.temperature {
			font-size: 1.25rem;
		}
	}
</style>
