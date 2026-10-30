<script lang="ts">
	import { Check, LoaderCircle, X as XIcon } from 'lucide-svelte';
	import { tooltip } from '$lib/actions/tooltip';
	import HomingWarningModal from '$lib/components/HomingWarningModal.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import ZoneTemperatureEditor from '$lib/components/ZoneTemperatureEditor.svelte';
	import ExtruderLive from '$lib/illustrations/ExtruderLive.svelte';
	import { loadNozzleZones } from '$lib/services/moonraker-zones';
	import { subscribeWhileVisible } from '$lib/services/panel-subscription.svelte';
	import { toastActions } from '$lib/stores/toastStore';
	import {
		amountOptions,
		customTemperaturePreset,
		cancelExtrudeSequence,
		extrudeAmount,
		extrudeCancelRequested,
		extrudeOutcome,
		extrudePhase,
		extrudeSpeed,
		extrudeTemperature,
		fillZoneTemperatures,
		materialPresets,
		speedOptions,
		startExtrudeSequence,
		temperatureOptions,
		type Amount,
		type ExtrudePhase,
		type Speed,
		type Temperature,
		type TemperatureZones
	} from '$lib/stores/movementStore';

	// Selected parameters and running phase live in the store, so leaving the page
	// mid-sequence no longer resets the dialog — see movementStore.
	let showHomingWarning = $state(false);

	const phaseLabels: Record<ExtrudePhase, string> = {
		idle: 'HEAT & EXTRUDE',
		homing: 'Homing…',
		moving: 'Moving…',
		heating: 'Heating…',
		extruding: 'Extruding…'
	};

	// Le quattro fasi della sequenza, nell'ordine in cui le vede l'utente. Mentre gira (e
	// subito dopo, per dire com'è finita) il pannello mostra queste al posto delle opzioni:
	// prima l'unico segno era l'etichetta del pulsante.
	type SequencePhase = Exclude<ExtrudePhase, 'idle'>;
	const sequence: { phase: SequencePhase; label: string }[] = [
		{ phase: 'homing', label: 'Homing' },
		{ phase: 'moving', label: 'Move to purge position' },
		{ phase: 'heating', label: 'Heating the nozzle' },
		{ phase: 'extruding', label: 'Extrude' }
	];
	type StepState = 'done' | 'active' | 'failed' | 'todo';

	const running = $derived($extrudePhase !== 'idle');
	const showProgress = $derived(running || $extrudeOutcome !== null);

	const stepState = (index: number): StepState => {
		const outcome = $extrudeOutcome;
		if (outcome?.status === 'done') return 'done';
		const current = sequence.findIndex(
			(step) => step.phase === (outcome?.status === 'failed' ? outcome.phase : $extrudePhase)
		);
		if (index < current) return 'done';
		if (index > current) return 'todo';
		return outcome?.status === 'failed' ? 'failed' : 'active';
	};

	const progressTitle = $derived(
		$extrudeOutcome?.status === 'done'
			? 'DONE'
			: $extrudeOutcome?.status === 'failed'
				? 'STOPPED'
				: 'IN PROGRESS'
	);

	// "Done" resta qualche secondo, poi tornano le opzioni. Un errore resta finché
	// l'utente non sceglie Retry o Back.
	$effect(() => {
		if ($extrudeOutcome?.status !== 'done') return;
		const timer = setTimeout(() => extrudeOutcome.set(null), 4000);
		return () => clearTimeout(timer);
	});

	const dismissOutcome = (): void => {
		extrudeOutcome.set(null);
	};

	const retrySequence = (): void => {
		startExtrudeSequence();
	};

	// Temperatura delle zone mentre scalda: è la fase lunga, e senza numeri sembrava ferma.
	type HeaterStatus = { temperature?: number; target?: number };
	let progressZones = $state<string[]>([]);
	let zoneReadings = $state<{ temperature: number | null; target: number | null }[]>([]);

	// Le zone servono anche da fermo: il disegno ha una fascia per zona. La lista è in cache
	// dopo la prima risposta (moonraker-zones.ts), quindi chiederla qui non costa.
	$effect(() => {
		if (progressZones.length > 0) return;
		loadNozzleZones().then((zones) => (progressZones = zones));
	});

	subscribeWhileVisible<Record<string, HeaterStatus>>(
		'extrude-progress',
		() => progressZones.join('&'),
		(status) => {
			zoneReadings = progressZones.map((zone) => {
				const { temperature, target } = status[zone] ?? {};
				return {
					temperature: typeof temperature === 'number' ? temperature : null,
					target: typeof target === 'number' && target > 0 ? target : null
				};
			});
		},
		// Sempre, non solo mentre gira: il disegno mostra le temperature vere delle zone
		// come il pannello della dashboard.
		() => progressZones.length > 0
	);

	// --- Parametri per il disegno ---------------------------------------------------

	// Quanto impiega un tratto del filo a scendere: Boost scorre visibilmente più veloce.
	const flowSecondsBySpeed: Record<Speed, number> = { slow: 1.2, standard: 0.7, boost: 0.35 };

	// Durata stimata dell'estrusione (volume / portata), tenuta in un intervallo sensato per
	// l'animazione: sotto i 3 s la colata scatta, sopra i 40 s sembra ferma.
	const fillSeconds = $derived.by(() => {
		const amount = amountOptions.find((option) => option.value === $extrudeAmount)!;
		const speed = speedOptions.find((option) => option.value === $extrudeSpeed)!;
		return Math.min(40, Math.max(3, amount.volumeMm3 / speed.speedMm3PerS));
	});

	const drawnZones = $derived(
		zoneReadings.length > 0
			? zoneReadings
			: Array.from({ length: progressZones.length || 4 }, () => ({
					temperature: null,
					target: null
				}))
	);

	// Riassunto della configurazione nel pannello basso mentre la sequenza gira.
	const temperatureSummary = $derived.by(() => {
		if ($extrudeTemperature === 'custom') {
			const values = Object.values($customTemperaturePreset.zones).filter((v) => v > 0);
			return values.length > 0 ? `Custom · ${Math.max(...values)} °C` : 'Custom';
		}
		const preset = materialPresets[$extrudeTemperature];
		const label = temperatureOptions.find((option) => option.value === $extrudeTemperature)!.label;
		return `${label} · ${Math.max(preset.firstZoneC, preset.otherZonesC)} °C`;
	});
	const amountSummary = $derived.by(() => {
		const option = amountOptions.find((o) => o.value === $extrudeAmount)!;
		return `${option.label} · ${formatCm3(option.volumeMm3)}`;
	});
	const speedSummary = $derived.by(() => {
		const option = speedOptions.find((o) => o.value === $extrudeSpeed)!;
		return `${option.label} · ${option.speedMm3PerS} mm³/s`;
	});

	// One field per heated zone of the nozzle, so both are filled when the popup
	// opens: how many zones there are is known only once the machine has been
	// asked (see moonraker-zones.ts).
	let showCustomTemperatureModal = $state(false);
	let customTemperatureZones = $state<string[]>([]);
	let customTemperatureInputs = $state<(number | null)[]>([]);
	let customTemperatureError = $state('');

	// Cosa fa ogni opzione, con i numeri veri: "Mid" da solo non dice quanto.
	const formatCm3 = (mm3: number): string => `${mm3 / 1000} cm³`;
	const amountHint = (option: (typeof amountOptions)[number]): string =>
		`Extrude ${formatCm3(option.volumeMm3)} of material`;
	const speedHint = (option: (typeof speedOptions)[number]): string =>
		`Extrude at ${option.speedMm3PerS} mm³/s`;
	const temperatureHint = (value: Temperature): string => {
		if (value === 'custom') return 'Set your own temperature for each nozzle zone';
		const preset = materialPresets[value];
		return preset.firstZoneC === preset.otherZonesC
			? `All nozzle zones at ${preset.firstZoneC} °C`
			: `Zone 1 at ${preset.firstZoneC} °C, other zones at ${preset.otherZonesC} °C`;
	};

	const selectAmount = (value: Amount): void => {
		extrudeAmount.set(value);
	};

	const selectSpeed = (value: Speed): void => {
		extrudeSpeed.set(value);
	};

	const selectTemperature = async (value: Temperature): Promise<void> => {
		if (value !== 'custom') {
			extrudeTemperature.set(value);
			return;
		}

		const zones = await loadNozzleZones();
		if (zones.length === 0) {
			// Without the zone list there is no way to know how many fields to show,
			// and the sequence would refuse to heat anyway. Say so instead of opening
			// an empty popup.
			toastActions.error(
				'klipper',
				"Can't set a custom temperature right now",
				"Couldn't read the nozzle zones from the printer"
			);
			return;
		}

		customTemperatureZones = zones;
		const stored = fillZoneTemperatures(zones, $customTemperaturePreset.zones);
		customTemperatureInputs = zones.map((zone) => stored[zone] ?? null);
		customTemperatureError = '';
		showCustomTemperatureModal = true;
	};

	const isCustomValueValid = (value: number | null): boolean =>
		value != null && Number.isFinite(value) && value > 0 && value <= 300;

	const cancelCustomTemperature = (): void => {
		showCustomTemperatureModal = false;
	};

	const confirmCustomTemperature = (): void => {
		const isValid = customTemperatureInputs.every(isCustomValueValid);
		// Prima un valore non valido veniva ignorato in silenzio e "Custom" restava selezionato
		// con le temperature vecchie.
		if (!isValid) {
			customTemperatureError = 'Every zone needs a temperature from 1 to 300 °C.';
			return;
		}
		const zones: TemperatureZones = {};
		customTemperatureZones.forEach((zone, index) => {
			zones[zone] = customTemperatureInputs[index] as number;
		});
		customTemperaturePreset.set({
			zones,
			rotationVolume: $customTemperaturePreset.rotationVolume
		});
		extrudeTemperature.set('custom');
		showCustomTemperatureModal = false;
	};

	const handleExtrude = (): void => {
		if ($extrudePhase !== 'idle') return;
		showHomingWarning = true;
	};

	const cancelHomingWarning = (): void => {
		showHomingWarning = false;
	};

	const confirmHomingWarning = (): void => {
		showHomingWarning = false;
		startExtrudeSequence();
	};
</script>

<div class="extrude-dialog-card" class:progress-mode={showProgress}>
	<div class="viz-card">
		<div class="viz-art">
			<ExtruderLive
				phase={$extrudePhase}
				outcome={$extrudeOutcome?.status ?? null}
				amount={$extrudeAmount}
				flowSeconds={flowSecondsBySpeed[$extrudeSpeed]}
				{fillSeconds}
				zones={drawnZones}
			/>
		</div>

		{#if showProgress}
			<div class="sequence" aria-live="polite">
				<span class="option-label">{progressTitle}</span>
				<ol class="stepper">
					{#each sequence as step, index (step.phase)}
						{@const state = stepState(index)}
						<li class="step {state}">
							<span class="step-dot" aria-hidden="true">
								{#if state === 'done'}
									<Check size={15} strokeWidth={3} />
								{:else if state === 'failed'}
									<XIcon size={15} strokeWidth={3} />
								{:else if state === 'active'}
									<LoaderCircle size={15} strokeWidth={3} class="spin" />
								{:else}
									{index + 1}
								{/if}
							</span>
							<span class="step-label">{step.label}</span>
						</li>
					{/each}
				</ol>

				{#if $extrudeOutcome?.status === 'failed'}
					<p class="sheet-error">{$extrudeOutcome.message}</p>
				{:else if $extrudeOutcome?.status === 'done'}
					<p class="done-note">Purge complete. The heaters have been switched off.</p>
				{/if}
			</div>
		{/if}
	</div>

	<div class="settings-card">
		<!-- Le opzioni si chiudono e il riassunto si apre con una transizione d'altezza: il
		     riquadro sopra cresce piano, e le card delle zone (che ne seguono la misura) con lui. -->
		<div class="fold" class:closed={showProgress} inert={showProgress}>
			<div class="fold-inner options">
				<div class="option-section">
					<span class="option-label">AMOUNT</span>
					<div class="option-row">
						{#each amountOptions as option (option.value)}
							<button
								class="option-btn"
								class:selected={$extrudeAmount === option.value}
								disabled={showProgress}
								use:tooltip={amountHint(option)}
								onclick={() => selectAmount(option.value)}
							>
								{option.label}
							</button>
						{/each}
					</div>
				</div>

				<div class="divider"></div>

				<div class="option-section">
					<span class="option-label">SPEED</span>
					<div class="option-row">
						{#each speedOptions as option (option.value)}
							<button
								class="option-btn"
								class:selected={$extrudeSpeed === option.value}
								disabled={showProgress}
								use:tooltip={speedHint(option)}
								onclick={() => selectSpeed(option.value)}
							>
								{option.label}
							</button>
						{/each}
					</div>
				</div>

				<div class="divider"></div>

				<div class="option-section">
					<span class="option-label">TEMPERATURE</span>
					<div class="option-row">
						{#each temperatureOptions as option (option.value)}
							<button
								class="option-btn"
								class:selected={$extrudeTemperature === option.value}
								disabled={showProgress}
								use:tooltip={temperatureHint(option.value)}
								onclick={() => selectTemperature(option.value)}
							>
								{option.label}
							</button>
						{/each}
					</div>
				</div>
			</div>
		</div>

		<div class="fold" class:closed={!showProgress}>
			<div class="fold-inner">
				<dl class="summary" aria-label="Extrude settings">
					<div>
						<dt>Amount</dt>
						<dd>{amountSummary}</dd>
					</div>
					<div>
						<dt>Speed</dt>
						<dd>{speedSummary}</dd>
					</div>
					<div>
						<dt>Temperature</dt>
						<dd>{temperatureSummary}</dd>
					</div>
				</dl>
			</div>
		</div>

		{#if $extrudeOutcome?.status === 'failed'}
			<div class="outcome-actions">
				<button type="button" class="btn btn-secondary" onclick={dismissOutcome}>Back</button>
				<button type="button" class="btn btn-primary" onclick={retrySequence}>Try again</button>
			</div>
		{:else if $extrudeOutcome?.status === 'done'}
			<button class="btn btn-primary outcome-btn" onclick={dismissOutcome}>All done</button>
		{:else if running}
			<button
				type="button"
				class="btn btn-secondary outcome-btn cancel"
				disabled={$extrudeCancelRequested}
				onclick={cancelExtrudeSequence}
			>
				{$extrudeCancelRequested ? 'Cancelling…' : 'Cancel'}
			</button>
		{:else}
			<button
				class="extrude-btn"
				use:tooltip={'Home if needed, move to the purge position, heat the nozzle and extrude; heaters switch off at the end'}
				onclick={handleExtrude}
			>
				{phaseLabels.idle}
			</button>
		{/if}
	</div>
</div>

<HomingWarningModal
	isOpen={showHomingWarning}
	action="extrude"
	onConfirm={confirmHomingWarning}
	onCancel={cancelHomingWarning}
/>

{#if showCustomTemperatureModal}
	<Sheet label="Custom temperature" onClose={cancelCustomTemperature} size="sm">
		{#snippet header()}
			<h3 class="sheet-title">Custom temperature</h3>
			<p class="sheet-subtitle">Pick a target for each nozzle zone, in °C</p>
		{/snippet}

		<ZoneTemperatureEditor
			bind:values={customTemperatureInputs}
			current={customTemperatureZones.map(
				(zone) => zoneReadings[progressZones.indexOf(zone)]?.temperature ?? null
			)}
			invalid={customTemperatureInputs.map(
				(value) => !!customTemperatureError && !isCustomValueValid(value)
			)}
			onEdit={() => (customTemperatureError = '')}
			onEnter={confirmCustomTemperature}
		/>
		{#if customTemperatureError}
			<p class="sheet-error custom-error" role="alert">{customTemperatureError}</p>
		{/if}

		{#snippet footer()}
			<button type="button" class="btn btn-secondary" onclick={cancelCustomTemperature}>
				Cancel
			</button>
			<button type="button" class="btn btn-primary" onclick={confirmCustomTemperature}>
				Confirm
			</button>
		{/snippet}
	</Sheet>
{/if}

<style>
	.extrude-dialog-card {
		width: 100%;
		height: 100%;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 24px;
		container-type: size;
	}

	.viz-card {
		background: var(--color-white);
		border-radius: 16px;
		box-shadow: var(--shadow-panel);
		box-sizing: border-box;
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 20px;
		padding: 16px 20px;
		container-type: size;
	}

	.viz-art {
		height: 100%;
		min-width: 0;
		aspect-ratio: 2 / 3;
		max-width: 50%;
	}

	/* Durante la sequenza disegno e avanzamento si dividono il riquadro. */
	.progress-mode .viz-card {
		justify-content: flex-start;
	}

	.progress-mode .sequence {
		flex: 1;
		min-width: 0;
		max-height: 100%;
		overflow-y: auto;
		/* Lo scroll taglia ciò che esce dal riquadro: l'alone del pallino attivo sta qui dentro. */
		padding: 6px;
		box-sizing: border-box;
	}

	.option-btn:disabled {
		cursor: default;
		opacity: 0.5;
	}

	.settings-card {
		background: var(--color-white);
		border-radius: 16px;
		box-shadow: var(--shadow-panel);
		box-sizing: border-box;
		flex-shrink: 0;
		padding: 20px;
		display: flex;
		flex-direction: column;
		transition: padding 0.45s ease;
	}

	.option-section {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.option-label {
		font-size: 0.85rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		color: var(--color-black);
	}

	.option-row {
		display: flex;
		gap: 12px;
	}

	.option-btn {
		flex: 1;
		background: var(--color-white);
		border: 1px solid var(--color-border-light);
		border-radius: 10px;
		box-sizing: border-box;
		padding: 12px 8px;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.option-btn:hover:not(:disabled) {
		background: var(--color-background);
	}

	.option-btn.selected {
		border: 2px solid var(--color-red);
		color: var(--color-red);
		padding: 11px 7px;
	}

	.divider {
		height: 1px;
		background: var(--color-surface-sunken);
	}

	.extrude-btn {
		background: var(--color-red);
		border: none;
		border-radius: 16px;
		box-sizing: border-box;
		padding: 18px;
		color: var(--color-white);
		font-size: 1.2rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		cursor: pointer;
	}

	.extrude-btn:hover {
		background: var(--color-red-dark);
	}

	.extrude-btn:disabled {
		cursor: default;
		opacity: 0.55;
		pointer-events: none;
	}

	.custom-error {
		margin-top: 12px;
	}

	/* --- Sequenza in corso ------------------------------------------------- */

	.sequence {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.stepper {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.step {
		position: relative;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 6px 0;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--color-text-subtle);
	}

	/* La linea che unisce i pallini. */
	.step:not(:last-child)::after {
		content: '';
		position: absolute;
		left: 13px;
		top: 34px;
		bottom: -8px;
		width: 2px;
		background: var(--color-border-light);
	}

	.step.done:not(:last-child)::after {
		background: var(--color-red);
	}

	.step-dot {
		position: relative;
		z-index: 1;
		flex-shrink: 0;
		width: 28px;
		height: 28px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: var(--color-surface-sunken);
		color: var(--color-text-subtle);
		font-size: 0.8rem;
		font-weight: 700;
	}

	.step.done {
		color: var(--color-text-muted);
	}

	.step.done .step-dot {
		background: var(--color-red);
		color: var(--color-white);
	}

	.step.active {
		color: var(--color-black);
	}

	.step.active .step-dot {
		background: var(--color-danger-bg);
		color: var(--color-red);
		box-shadow: 0 0 0 4px rgba(var(--rgb-red), 0.12);
	}

	.step.failed {
		color: var(--color-red);
	}

	.step.failed .step-dot {
		background: var(--color-red);
		color: var(--color-white);
	}

	.done-note {
		margin: 0;
		padding: 10px 12px;
		border-radius: 10px;
		background: var(--color-success-bg);
		color: var(--color-success);
		font-size: 0.875rem;
		font-weight: 600;
	}

	.outcome-actions {
		display: flex;
		gap: 10px;
	}

	.outcome-actions .btn,
	.outcome-btn {
		flex: 1;
		min-height: 56px;
		font-size: 1.05rem;
	}

	.cancel {
		color: var(--color-red);
	}

	/* Durante la sequenza il pannello basso si stringe: cosa è stato scelto e Cancel. */
	.progress-mode .settings-card {
		padding: 14px 16px;
	}

	.fold {
		display: grid;
		grid-template-rows: 1fr;
		transition:
			grid-template-rows 0.45s ease,
			opacity 0.3s ease;
	}

	.fold.closed {
		grid-template-rows: 0fr;
		opacity: 0;
	}

	.fold-inner {
		min-height: 0;
		overflow: hidden;
	}

	.fold-inner.options {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	/* Lo spazio sopra il pulsante sta fuori dalle parti che si chiudono: un padding dentro
	   resterebbe anche da chiuse (0fr non schiaccia il padding). */
	.fold + .fold + * {
		margin-top: 16px;
	}

	.summary {
		margin: 0;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
	}

	.summary div {
		min-width: 0;
		padding: 8px 10px;
		border-radius: 10px;
		background: var(--color-surface-soft);
	}

	.summary dt {
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--color-text-subtle);
	}

	.summary dd {
		margin: 2px 0 0;
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--color-black);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Riquadro basso (telefono): stepper e temperature più compatti. */
	@container (max-height: 300px) {
		.sequence {
			gap: 8px;
		}

		.step {
			padding: 2px 0;
			font-size: 0.85rem;
		}

		.step:not(:last-child)::after {
			top: 26px;
			bottom: -4px;
			left: 11px;
		}

		.step-dot {
			width: 24px;
			height: 24px;
		}
	}

	@container (max-width: 380px) {
		.viz-card {
			gap: 10px;
			padding: 12px;
		}

		.step-label {
			font-size: 0.82rem;
		}
	}

	/*
	 * The drawing gets whatever height the settings leave (~424px + the 24px gap).
	 * Under ~160px it is a sliver nobody can read, and on the shortest screens it
	 * pushed the settings out of the column: below that it goes, and the settings
	 * take the whole column. Last in the file, so it wins over the base rules.
	 */
	@container (max-height: 607px) {
		.viz-card {
			display: none;
		}

		/* Mentre la sequenza gira l'avanzamento conta più delle opzioni (che sono bloccate):
		   il riquadro torna e le opzioni lasciano il posto. */
		.progress-mode .viz-card {
			display: flex;
		}

		.progress-mode .settings-card {
			flex: 0 0 auto;
		}

		/* La card occupa tutta la colonna: AMOUNT in cima, il pulsante ancorato in fondo e lo
		   spazio in più diviso tra le righe (i divisori restano a metà tra due sezioni). */
		.settings-card {
			flex: 1;
			justify-content: space-between;
		}

		.fold:not(.closed):has(.options) {
			flex: 1;
		}

		.fold-inner.options {
			justify-content: space-between;
		}
	}
</style>
