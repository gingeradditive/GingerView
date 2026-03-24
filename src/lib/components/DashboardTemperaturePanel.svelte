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
	const useMockData = true;
	const mockExtruderBase = [105, 55, 35, 45];
	const mockBedBase = 23;

	let extruderTemperatures = $state<(number | null)[]>([null, null, null, null]);
	let bedTemperature = $state<number | null>(null);

	const formatTemperature = (value: number | null): string => {
		if (value == null || Number.isNaN(value)) return '--°';
		return `${Math.round(value)}°`;
	};

	const getApiUrl = (): string => {
		const config = configService.getKlipperConfig();
		return config.moonrakerApiUrl ?? `http://${config.moonrakerHost}:${config.moonrakerPort}`;
	};

	const getQueryPath = (): string => {
		const objects = [...extruderKeys, 'heater_bed'];
		return `/printer/objects/query?${objects.join('&')}`;
	};

	const withJitter = (base: number, spread: number): number => {
		const delta = (Math.random() * 2 - 1) * spread;
		return Math.max(0, base + delta);
	};

	const updateMockTemperatures = (): void => {
		extruderTemperatures = mockExtruderBase.map((base) => withJitter(base, 1.8));
		bedTemperature = withJitter(mockBedBase, 0.8);
	};

	const updateTemperatures = async (): Promise<void> => {
		if (useMockData) {
			updateMockTemperatures();
			return;
		}

		try {
			const response = await fetch(`${getApiUrl()}${getQueryPath()}`);
			if (!response.ok) {
				updateMockTemperatures();
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

			const heaterBed = status.heater_bed?.temperature;
			bedTemperature = typeof heaterBed === 'number' ? heaterBed : null;
		} catch {
			updateMockTemperatures();
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
			<ExtruderTemperatureCard index={index + 1} {temperature} />
		{/each}
	</div>

	<div class="bed-section" aria-label="Temperatura bed">
		<div class="bed-triangle">
		</div>
		<div class="bed-card">
			<span class="bed-label">BED</span>
			<span class="bed-value">{formatTemperature(bedTemperature)}</span>
		</div>
	</div>
</section>

<style>
	.temperature-panel {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 9px;
		padding: 11px 8px 16px;
		width: 25vw;
		height: auto;
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
		width: 0;
		height: 0;
		border-left: 31px solid transparent;
		border-right: 31px solid transparent;
		border-top: 31px solid #8f8f93;
		position: relative;
	}

	
	.bed-card {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		width: 115px;
		height: 49px;
		padding: 7px 8px;
		border-radius: 7px;
		border: 1px solid #8f8f93;
		background: #b9b9bc;
		box-sizing: border-box;
	}

	.bed-label {
		font-size: 0.8rem;
		font-weight: 600;
		color: #ececec;
		line-height: 1;
	}

	.bed-value {
		font-size: 1.5rem;
		font-weight: 700;
		line-height: 1;
		color: #7a7a7e;
	}
</style>
