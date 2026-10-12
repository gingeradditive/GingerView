<script lang="ts">
	import { onMount } from 'svelte';
	import ExtruderTemperatureCard from '$lib/components/ExtruderTemperatureCard.svelte';
	import { loadNozzleZones } from '$lib/services/moonraker-zones';
	import { subscribeWhileVisible } from '$lib/services/panel-subscription.svelte';

	/** Falso quando la slide è fuori dalla viewport del carosello: l'iscrizione si ferma. */
	let { visible = true }: { visible?: boolean } = $props();

	type HeaterStatus = {
		temperature?: number;
		target?: number;
	};

	const dataSource = 'dashboard-temperature';

	/**
	 * Ogni quanto richiedere la lista delle zone quando la macchina non l'ha data.
	 * Succede mentre Klippy si riavvia: prima l'iscrizione chiedeva le zone a ogni
	 * poll e riprovava da sé, ora che non c'è più un poll il tentativo va rifatto
	 * qui — a passo lento, perché l'unica cosa che può cambiare la risposta è un
	 * riavvio di Klippy.
	 */
	const zonesRetryMs = 5000;

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

	// Il bed c'è sempre: finché le zone non si sanno il pannello è iscritto solo a
	// quello, e si riscrive da sé — la query cambia e l'iscrizione si rifà —
	// quando la macchina risponde.
	const getQuery = (): string => [...zoneKeys, 'heater_bed'].join('&');

	onMount(() => {
		let stopped = false;
		let retry: ReturnType<typeof setTimeout> | null = null;

		// Cached after the first answer, so this costs one request until the
		// machine replies and nothing afterwards (see moonraker-zones.ts).
		const loadZones = async (): Promise<void> => {
			const zones = await loadNozzleZones();
			if (stopped) return;
			if (zones.length > 0) {
				zoneKeys = zones;
				return;
			}
			retry = setTimeout(loadZones, zonesRetryMs);
		};
		loadZones();

		return () => {
			stopped = true;
			if (retry !== null) clearTimeout(retry);
		};
	});

	const updateTemperatures = (status: Record<string, HeaterStatus>): void => {
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

	subscribeWhileVisible<Record<string, HeaterStatus>>(
		dataSource,
		getQuery,
		updateTemperatures,
		() => visible
	);
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
		width: 100%;
		height: 100%;
		box-sizing: border-box;
		box-shadow: var(--shadow-panel);
		/*
		 * Everything inside is drawn in `--u`, a pixel that shrinks when the panel
		 * is too short (13" laptops, small screens) and is a plain pixel otherwise.
		 * The stack is ~362u tall (four zones, the nozzle, the bed) and the bed
		 * ~150u wide. Resolved by the children, so `cq*` refers to this panel.
		 */
		container-type: size;
		--u: min(1px, calc(100cqh / 362), calc(100cqw / 150));
	}

	.extruders {
		display: flex;
		flex-direction: column;
		gap: calc(var(--u) * 6);
	}

	.bed-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: calc(var(--u) * 7);
		margin-top: calc(var(--u) * 9);
	}

	.bed-triangle {
		width: calc(var(--u) * 62);
		height: calc(var(--u) * 33);
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
		width: calc(var(--u) * 144);
		height: calc(var(--u) * 81);
		padding: calc(var(--u) * 7) calc(var(--u) * 8);
		border-radius: calc(var(--u) * 7);
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
		font-size: calc(var(--u) * 12.8);
		font-weight: 600;
		color: var(--color-surface-sunken);
		line-height: 1;
	}

	.bed-temperature-stack {
		position: absolute;
		bottom: calc(var(--u) * 7);
		right: calc(var(--u) * 18);
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		justify-content: center;
		gap: 1px;
	}

	.bed-value {
		font-size: calc(var(--u) * 24);
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
		font-size: calc(var(--u) * 12.8);
		font-weight: 500;
		line-height: 1;
		color: var(--color-white);
		opacity: 1;
	}
</style>
