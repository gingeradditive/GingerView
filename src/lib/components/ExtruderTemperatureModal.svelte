<script lang="ts">
	import { Power } from 'lucide-svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import ZoneTemperatureEditor from '$lib/components/ZoneTemperatureEditor.svelte';
	import TemperaturePresetChips from '$lib/components/TemperaturePresetChips.svelte';
	import { sendGcode } from '$lib/services/moonraker-gcode';
	import {
		MAX_BED_TEMPERATURE,
		MAX_NOZZLE_TEMPERATURE as MAX_TEMPERATURE,
		builtInPresets,
		customTemperaturePresets,
		isPresetNameTaken,
		loadTemperaturePresets,
		matchesPreset,
		newPresetId,
		presetTargets,
		saveTemperaturePreset,
		type HeaterPreset
	} from '$lib/stores/temperaturePresetsStore';

	/**
	 * Temperature libere delle zone dell'ugello e del piatto — solo in modalità
	 * avanzata, la apre il pulsante sulla card temperature della dashboard.
	 *
	 * I campi partono dai target attuali e diventano effettivi solo con Apply:
	 * nessun comando parte mentre si scrive. Campo vuoto o 0 = zona spenta.
	 *
	 * In cima i preset (PLA, PETG e quelli salvati): un tocco riempie i campi, sempre
	 * senza inviare niente. "Save" salva i campi attuali come preset nuovo.
	 */
	let {
		isOpen,
		zones,
		temperatures,
		targets,
		bedTemperature,
		bedTarget,
		onClose
	}: {
		isOpen: boolean;
		/** Nomi Kalico delle zone (`extruder`, `extruder1`, …), in ordine. */
		zones: string[];
		temperatures: (number | null)[];
		targets: (number | null)[];
		bedTemperature: number | null;
		bedTarget: number | null;
		onClose: () => void;
	} = $props();

	let inputs = $state<(number | null)[]>([]);
	let bedInput = $state<number | null>(null);
	let busy = $state(false);

	// Riempie i campi a ogni apertura, non mentre è aperta: i target che
	// arrivano dalla stampante non devono sovrascrivere quello che si sta scrivendo.
	let wasOpen = false;
	$effect(() => {
		if (isOpen && !wasOpen) {
			inputs = zones.map((_, index) => {
				const target = targets[index];
				return target != null && target > 0 ? Math.round(target) : null;
			});
			bedInput = bedTarget != null && bedTarget > 0 ? Math.round(bedTarget) : null;
			loadTemperaturePresets();
		}
		wasOpen = isOpen;
	});

	const isValid = (value: number | null, max = MAX_TEMPERATURE): boolean =>
		value == null || (Number.isInteger(value) && value >= 0 && value <= max);

	const bedValid = $derived(isValid(bedInput, MAX_BED_TEMPERATURE));
	const allValid = $derived(inputs.every((value) => isValid(value)) && bedValid);

	const presets = $derived([...builtInPresets(zones), ...$customTemperaturePresets]);
	const activeId = $derived(
		presets.find((preset) => matchesPreset(preset, zones, inputs, bedInput))?.id ?? null
	);
	const anyOn = $derived(inputs.some((value) => (value ?? 0) > 0) || (bedInput ?? 0) > 0);

	const pickPreset = (preset: HeaterPreset): void => {
		inputs = presetTargets(preset, zones, inputs);
		bedInput = preset.bed > 0 ? preset.bed : null;
	};

	const savePreset = (name: string): Promise<boolean> =>
		saveTemperaturePreset({
			id: newPresetId(),
			name,
			zones: Object.fromEntries(zones.map((zone, index) => [zone, inputs[index] ?? 0])),
			bed: bedInput ?? 0
		});

	const send = async (values: (number | null)[], bed: number | null): Promise<void> => {
		busy = true;
		const script = [
			...zones.map(
				(zone, index) => `SET_HEATER_TEMPERATURE HEATER=${zone} TARGET=${values[index] ?? 0}`
			),
			`SET_HEATER_TEMPERATURE HEATER=heater_bed TARGET=${bed ?? 0}`
		].join('\n');
		const ok = await sendGcode(script, "Couldn't set the temperatures");
		busy = false;
		if (ok) onClose();
	};

	const apply = (): void => {
		if (!allValid || busy) return;
		send(inputs, bedInput);
	};

	// Spegne solo i campi: come per i valori scritti a mano, il comando parte con Apply.
	const allOff = (): void => {
		if (busy) return;
		inputs = zones.map(() => null);
		bedInput = null;
	};
</script>

{#if isOpen}
	<Sheet label="Temperatures" {onClose} size="sm">
		{#snippet header()}
			<h3 class="sheet-title">Temperatures</h3>
			<p class="sheet-subtitle">
				Target for each nozzle zone and the bed, in °C. Leave it empty or type 0 to turn it off.
			</p>
		{/snippet}

		<TemperaturePresetChips
			{presets}
			{activeId}
			disabled={busy}
			canSave={allValid && anyOn}
			isNameTaken={(name) => isPresetNameTaken(name, zones)}
			onPick={pickPreset}
			onSave={savePreset}
		/>

		<ZoneTemperatureEditor
			bind:values={inputs}
			current={temperatures}
			invalid={inputs.map((value) => !isValid(value))}
			withBed
			bind:bed={bedInput}
			bedCurrent={bedTemperature}
			bedInvalid={!bedValid}
			bedMax={MAX_BED_TEMPERATURE}
			disabled={busy}
			max={MAX_TEMPERATURE}
			placeholder="Off"
			onEnter={apply}
		/>

		{#if !allValid}
			<p class="sheet-error error">
				Use numbers between 0 and {MAX_TEMPERATURE} °C for the nozzle, 0 and {MAX_BED_TEMPERATURE} °C
				for the bed.
			</p>
		{/if}

		{#snippet footer()}
			<button
				type="button"
				class="btn btn-secondary off"
				disabled={busy || (inputs.every((value) => value == null) && bedInput == null)}
				onclick={allOff}
			>
				<Power size={18} />
				Turn all off
			</button>
			<button type="button" class="btn btn-secondary" onclick={onClose}>Cancel</button>
			<button type="button" class="btn btn-primary" disabled={busy || !allValid} onclick={apply}>
				{busy ? 'Applying…' : 'Apply'}
			</button>
		{/snippet}
	</Sheet>
{/if}

<style>
	.off {
		color: var(--color-red);
	}

	.error {
		margin-top: 12px;
	}
</style>
