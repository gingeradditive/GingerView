<script lang="ts">
	import { onMount } from 'svelte';
	import { SlidersHorizontal } from 'lucide-svelte';
	import ExtruderTemperatureCard from '$lib/components/ExtruderTemperatureCard.svelte';
	import ExtruderTemperatureModal from '$lib/components/ExtruderTemperatureModal.svelte';
	import TemperaturePresetsSheet from '$lib/components/TemperaturePresetsSheet.svelte';
	import HeaterTrendIcon from '$lib/components/HeaterTrendIcon.svelte';
	import { describeTrend, heaterTrend } from '$lib/utils/heater-trend';
	import { uiMode } from '$lib/stores/uiModeStore';
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
	// Solo in modalità avanzata il disegno si tocca: apre i preset, e da lì "Custom" apre i
	// campi liberi. In semplice il pannello è di sola lettura.
	let sheet = $state<'presets' | 'custom' | null>(null);
	let canSet = $derived($uiMode === 'advanced' && zoneKeys.length > 0);

	const formatTemperature = (value: number | null): string => {
		if (value == null || Number.isNaN(value)) return '--';
		return `${Math.round(value)}`;
	};

	const bedTrend = $derived(heaterTrend(bedTemperature, bedTarget));
	// Il target del piatto resta visibile finché non ci si arriva, in salita o in discesa.
	const showBedSet = $derived(bedTarget != null && bedTarget > 0 && bedTrend !== 'ready');

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

{#snippet drawing()}
	<div class="extruders">
		{#each zoneKeys as zone, index (zone)}
			<ExtruderTemperatureCard
				index={index + 1}
				temperature={extruderTemperatures[index] ?? null}
				target={extruderTargets[index] ?? null}
			/>
		{/each}
	</div>

	<div
		class="bed-section"
		aria-label={`Bed: ${formatTemperature(bedTemperature)}°, ${describeTrend(bedTrend, bedTarget)}`}
	>
		<div class="bed-triangle">
			<img src="/NozzleHead.svg" alt="Nozzle" class="bed-triangle-icon" />
		</div>
		<div class="bed-card {bedTrend}">
			<span class="bed-label">BED</span>
			<span class="bed-trend"><HeaterTrendIcon trend={bedTrend} size={16} /></span>
			<div class={`bed-temperature-stack ${showBedSet ? 'with-set' : ''}`}>
				<span class="bed-value {bedTrend}"
					>{formatTemperature(bedTemperature)}<span class="degree-symbol">°</span></span
				>
				{#if showBedSet}
					<span class="bed-set-temperature">{formatTemperature(bedTarget)}</span>
				{/if}
			</div>
		</div>
	</div>
{/snippet}

<section class="temperature-panel" aria-label="Nozzle and bed temperatures">
	{#if canSet}
		<!-- Tutta la card è il pulsante, bordi compresi, non solo il disegno. Il badge in alto
		     a destra dice che si tocca, ora che la barra "EXTRUDER · SET" non c'è più. -->
		<button
			type="button"
			class="drawing interactive"
			aria-label="Set the extruder and bed temperatures"
			onclick={() => (sheet = 'presets')}
		>
			{@render drawing()}
		</button>
		<span class="set-badge" aria-hidden="true"><SlidersHorizontal size={16} /></span>
	{:else}
		<div class="drawing">
			{@render drawing()}
		</div>
	{/if}
</section>

<TemperaturePresetsSheet
	isOpen={sheet === 'presets'}
	zones={zoneKeys}
	targets={extruderTargets}
	{bedTarget}
	onClose={() => (sheet = null)}
	onCustom={() => (sheet = 'custom')}
/>

<ExtruderTemperatureModal
	isOpen={sheet === 'custom'}
	zones={zoneKeys}
	temperatures={extruderTemperatures}
	targets={extruderTargets}
	{bedTemperature}
	{bedTarget}
	onClose={() => (sheet = null)}
/>

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
		position: relative;
		/*
		 * Everything inside is drawn in `--u`, a pixel that shrinks when the panel
		 * is too short (13" laptops, small screens) and is a plain pixel otherwise.
		 * The stack is ~362u tall (four zones, the nozzle, the bed) and the bed
		 * ~150u wide. Resolved by the children, so `cq*` refers to this panel.
		 */
		container-type: size;
		--u: min(1px, calc(100cqh / 362), calc(100cqw / 150));
	}

	/* Il contenitore del disegno: un div in semplice, un pulsante in advanced. Non
	   aggiunge misure sue, così `--u` resta quello del pannello. */
	.drawing {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	/* Copre tutta la card, padding compreso: si tocca anche fuori dal disegno. */
	button.drawing {
		width: calc(100% + 32px);
		height: calc(100% + 32px);
		margin: -16px;
		padding: 16px;
		box-sizing: border-box;
		border: none;
		border-radius: 19.2px;
		background: transparent;
		font: inherit;
		color: inherit;
		cursor: pointer;
		transition:
			background-color 0.15s,
			transform 0.1s;
		-webkit-tap-highlight-color: transparent;
	}

	button.drawing:hover {
		background: var(--color-background);
	}

	button.drawing:active {
		transform: scale(0.98);
	}

	button.drawing:focus-visible {
		outline: 2px solid var(--color-red);
		outline-offset: -4px;
	}

	.set-badge {
		position: absolute;
		top: 12px;
		right: 12px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border-radius: 10px;
		background: var(--color-surface-sunken);
		color: var(--color-text-muted);
		pointer-events: none;
	}

	@media (prefers-reduced-motion: reduce) {
		button.drawing {
			transition: none;
		}
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

	.bed-card.cooling {
		border-color: rgba(var(--rgb-info), 0.7);
	}

	/* In alto a destra: "BED" sta in alto a sinistra, i valori in basso a destra. */
	.bed-trend {
		position: absolute;
		top: calc(var(--u) * 7);
		right: calc(var(--u) * 8);
		display: inline-flex;
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

	.bed-value.cooling {
		color: var(--color-info);
	}

	.bed-set-temperature {
		font-size: calc(var(--u) * 12.8);
		font-weight: 500;
		line-height: 1;
		color: var(--color-white);
		opacity: 1;
	}
</style>
