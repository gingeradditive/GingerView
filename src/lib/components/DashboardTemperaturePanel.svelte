<script lang="ts">
	import { onMount } from 'svelte';
	import ExtruderTemperatureCard from '$lib/components/ExtruderTemperatureCard.svelte';
	import { configService } from '$lib/services/config';

	type HeaterStatus = {
		temperature?: number;
		target?: number;
	};

	const extruderKeys = ['extruder', 'extruder1', 'extruder2', 'extruder3'];
	const pollIntervalMs = 1500;

	let extruderTemperatures = $state<(number | null)[]>([null, null, null, null]);
	let extruderTargets = $state<(number | null)[]>([null, null, null, null]);
	let bedTemperature = $state<number | null>(null);
	let bedTarget = $state<number | null>(null);

	const formatTemperature = (value: number | null): string => {
		if (value == null || Number.isNaN(value)) return '--';
		return `${Math.round(value)}`;
	};

	const setTolerance = 5;

	const isBedHeating = (): boolean => {
		return (
			bedTarget != null &&
			!Number.isNaN(bedTarget) &&
			bedTarget > 0 &&
			bedTemperature != null &&
			!Number.isNaN(bedTemperature) &&
			bedTemperature < bedTarget
		);
	};

	const isBedReady = (): boolean => {
		return (
			bedTarget != null &&
			!Number.isNaN(bedTarget) &&
			bedTarget > 0 &&
			bedTemperature != null &&
			!Number.isNaN(bedTemperature) &&
			Math.abs(bedTemperature - bedTarget) <= setTolerance
		);
	};

	const showBedSet = (): boolean => {
		return (
			bedTarget != null &&
			!Number.isNaN(bedTarget) &&
			bedTarget > 0 &&
			!isBedReady()
		);
	};

	const getApiUrl = (): string => {
		const config = configService.getKlipperConfig();
		const baseUrl = config.moonrakerApiUrl ?? `http://${config.moonrakerHost}:${config.moonrakerPort}`;
		return baseUrl.replace(/\/$/, '');
	};

	const getQueryPath = (): string => {
		const objects = [...extruderKeys, 'heater_bed'];
		return `/printer/objects/query?${objects.join('&')}`;
	};

	const updateTemperatures = async (): Promise<void> => {
		try {
			const response = await fetch(`${getApiUrl()}${getQueryPath()}`);
			if (!response.ok) {
				return;
			}

			const payload = await response.json();
			const status = payload?.result?.status as Record<string, HeaterStatus> | undefined;
			if (!status) {
				return;
			}

			extruderTemperatures = extruderKeys.map((key) => {
				const temperature = status[key]?.temperature;
				return typeof temperature === 'number' ? temperature : null;
			});

			extruderTargets = extruderKeys.map((key) => {
				const target = status[key]?.target;
				if (typeof target !== 'number' || Number.isNaN(target)) return null;
				return target > 0 ? target : null;
			});

			const heaterBed = status.heater_bed?.temperature;
			bedTemperature = typeof heaterBed === 'number' ? heaterBed : null;

			const heaterBedTarget = status.heater_bed?.target;
			bedTarget = typeof heaterBedTarget === 'number' && heaterBedTarget > 0 ? heaterBedTarget : null;
		} catch {
			return;
		}
	};

	onMount(() => {
		updateTemperatures();
		const interval = window.setInterval(updateTemperatures, pollIntervalMs);
		return () => window.clearInterval(interval);
	});
</script>

<section class="temperature-panel" aria-label="Pannello temperature Klipper">
	<div class="extruders">
		{#each extruderTemperatures as temperature, index}
			<ExtruderTemperatureCard index={index + 1} {temperature} target={extruderTargets[index] ?? null} />
		{/each}
	</div>

	<div class="bed-section" aria-label="Temperatura bed">
		<div class="bed-triangle">
			<img src="/NozzleHead.svg" alt="Nozzle" class="bed-triangle-icon" />
		</div>
		<div class={`bed-card ${isBedHeating() ? 'heating' : ''} ${isBedReady() ? 'ready' : ''}`}>
			<span class="bed-label">BED</span>
			<div class={`bed-temperature-stack ${showBedSet() ? 'with-set' : ''}`}>
				<span class={`bed-value ${isBedHeating() ? 'heating' : ''} ${isBedReady() ? 'ready' : ''}`}>{formatTemperature(bedTemperature)}</span>
				{#if showBedSet()}
					<span class="bed-set-temperature">{formatTemperature(bedTarget)}</span>
				{/if}
			</div>
		</div>
	</div>
</section>

<style>
	.temperature-panel {
		background: #ffffff;
		border-radius: 16px;
		padding: 16px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 9px;
		width: 100%;
		height: 100%;
		box-sizing: border-box;
		box-shadow: 0px 4px 3px 0px #00000040;
	}

	.extruders {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.bed-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 7px;
	}

	.bed-triangle {
		width: 62px;
		height: 33px;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		transform: translateY(-2px);
	}

	.bed-triangle-icon {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	
	.bed-card {
		display: flex;
		align-items: baseline;
		justify-content: flex-start;
		position: relative;
		width: 144px;
		height: 81px;
		padding: 7px 8px;
		border-radius: 7px;
		border: 1px solid #8f8f93;
		background: #b9b9bc;
		box-sizing: border-box;
		transition: background-color 220ms ease, border-color 220ms ease;
	}

	.bed-card.heating {
		border-color: #d72e28;
	}

	.bed-card.ready {
		border-color: #d72e28;
		background: #d72e28;
	}

	.bed-label {
		font-size: 0.8rem;
		font-weight: 600;
		color: #ececec;
		line-height: 1;
	}

	.bed-temperature-stack {
		position: absolute;
		bottom: 7px;
		right: 8px;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		justify-content: center;
		gap: 1px;
	}


	.bed-value {
		font-size: 1.5rem;
		font-weight: 600;
		color: #7a7a7e;
		line-height: 1;
	}

	.bed-value::after {
		content: '°';
		font-size: 0.8em;
		margin-left: 0.1em;
	}

	.bed-value.heating {
		color: #d72e28;
	}

	.bed-value.ready {
		color: #ffffff;
	}

	.bed-set-temperature {
		font-size: 0.8rem;
		font-weight: 500;
		line-height: 1;
		color: #ffffff;
		opacity: 1;
	}
</style>
