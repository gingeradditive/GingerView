<script lang="ts">
	import ExtruderTemperatureCard from '$lib/components/ExtruderTemperatureCard.svelte';
	import { loadNozzleZones } from '$lib/services/moonraker-zones';
	import { queryPrinterObjects } from '$lib/services/moonraker-poll';
	import { pollWhileVisible } from '$lib/services/panel-poll.svelte';

	/** Falso quando la slide è fuori dalla viewport del carosello: il polling si ferma. */
	let { visible = true }: { visible?: boolean } = $props();

	type HeaterStatus = {
		temperature?: number;
		target?: number;
	};

	const pollSource = 'dashboard-temperature';
	const pollIntervalMs = 1500;

	// The heated zones of the one nozzle, as the machine declares them: four on
	// the G2, three on the G1 — see moonraker-zones.ts. Empty until it answers,
	// which is the only honest thing to draw when the count is unknown; the bed
	// is read either way, so the panel is never blank.
	let zoneKeys = $state<string[]>([]);
	let extruderTemperatures = $state<(number | null)[]>([]);
	let extruderTargets = $state<(number | null)[]>([]);
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
		return bedTarget != null && !Number.isNaN(bedTarget) && bedTarget > 0 && !isBedReady();
	};

	const getQuery = (): string => [...zoneKeys, 'heater_bed'].join('&');

	const updateTemperatures = async (): Promise<void> => {
		// Cached after the first answer, so this costs one request until the
		// machine replies and nothing afterwards (see moonraker-zones.ts).
		if (zoneKeys.length === 0) {
			zoneKeys = await loadNozzleZones();
		}

		const status = await queryPrinterObjects<Record<string, HeaterStatus>>(pollSource, getQuery());
		if (!status) return;

		extruderTemperatures = zoneKeys.map((key) => {
			const temperature = status[key]?.temperature;
			return typeof temperature === 'number' ? temperature : null;
		});

		extruderTargets = zoneKeys.map((key) => {
			const target = status[key]?.target;
			if (typeof target !== 'number' || Number.isNaN(target)) return null;
			return target > 0 ? target : null;
		});

		const heaterBed = status.heater_bed?.temperature;
		bedTemperature = typeof heaterBed === 'number' ? heaterBed : null;

		const heaterBedTarget = status.heater_bed?.target;
		bedTarget = typeof heaterBedTarget === 'number' && heaterBedTarget > 0 ? heaterBedTarget : null;
	};

	pollWhileVisible(pollSource, pollIntervalMs, updateTemperatures, () => visible);
</script>

<section class="temperature-panel" aria-label="Klipper temperature panel">
	<div class="extruders">
		{#each zoneKeys as zone, index (zone)}
			<ExtruderTemperatureCard
				index={index + 1}
				temperature={extruderTemperatures[index] ?? null}
				target={extruderTargets[index] ?? null}
			/>
		{/each}
	</div>

	<div class="bed-section" aria-label="Bed temperature">
		<div class="bed-triangle">
			<img src="/NozzleHead.svg" alt="Nozzle" class="bed-triangle-icon" />
		</div>
		<div class={`bed-card ${isBedHeating() ? 'heating' : ''} ${isBedReady() ? 'ready' : ''}`}>
			<span class="bed-label">BED</span>
			<div class={`bed-temperature-stack ${showBedSet() ? 'with-set' : ''}`}>
				<span class={`bed-value ${isBedHeating() ? 'heating' : ''} ${isBedReady() ? 'ready' : ''}`}
					>{formatTemperature(bedTemperature)}<span class="degree-symbol">°</span></span
				>
				{#if showBedSet()}
					<span class="bed-set-temperature">{formatTemperature(bedTarget)}</span>
				{/if}
			</div>
		</div>
	</div>
</section>

<style>
	.temperature-panel {
		background: var(--color-white);
		border-radius: 19.2px;
		padding: 16px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 9px;
		width: 100%;
		height: 100%;
		box-sizing: border-box;
		box-shadow: var(--shadow-panel);
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
		border: 1px solid var(--color-text-subtle);
		background: var(--color-gray-light);
		box-sizing: border-box;
		transition:
			background-color 220ms ease,
			border-color 220ms ease;
	}

	.bed-card.heating {
		border-color: var(--color-red);
	}

	.bed-card.ready {
		border-color: var(--color-red);
		background: var(--color-red);
	}

	.bed-label {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-surface-sunken);
		line-height: 1;
	}

	.bed-temperature-stack {
		position: absolute;
		bottom: 7px;
		right: 18px;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		justify-content: center;
		gap: 1px;
	}

	.bed-value {
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

	.bed-value.heating {
		color: var(--color-red);
	}

	.bed-value.ready {
		color: var(--color-white);
	}

	.bed-set-temperature {
		font-size: 0.8rem;
		font-weight: 500;
		line-height: 1;
		color: var(--color-white);
		opacity: 1;
	}
</style>
