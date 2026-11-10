<script lang="ts">
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import ZoneTemperatureEditor from '$lib/components/ZoneTemperatureEditor.svelte';
	import {
		MAX_BED_TEMPERATURE,
		MAX_NOZZLE_TEMPERATURE as MAX_TEMPERATURE,
		applyHeaterTargets
	} from '$lib/stores/temperaturePresetsStore';

	/**
	 * Temperature libere delle zone dell'ugello e del piatto — solo in modalità
	 * avanzata. È il "Custom" del popup dei preset (`TemperaturePresetsSheet`), che si
	 * apre toccando il disegno dell'estrusore nella dashboard.
	 *
	 * I campi partono dai target attuali e diventano effettivi solo con Apply:
	 * nessun comando parte mentre si scrive. Campo vuoto o 0 = zona spenta.
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
		}
		wasOpen = isOpen;
	});

	const isValid = (value: number | null, max = MAX_TEMPERATURE): boolean =>
		value == null || (Number.isInteger(value) && value >= 0 && value <= max);

	const bedValid = $derived(isValid(bedInput, MAX_BED_TEMPERATURE));
	const allValid = $derived(inputs.every((value) => isValid(value)) && bedValid);

	const send = async (values: (number | null)[], bed: number | null): Promise<void> => {
		busy = true;
		const ok = await applyHeaterTargets(zones, values, bed);
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
	<Sheet label="Custom temperatures" {onClose} size="md">
		{#snippet header()}
			<h3 class="sheet-title">Custom temperatures</h3>
			<p class="sheet-subtitle">
				Target for each nozzle zone and the bed, in °C. Leave it empty or type 0 to turn it off.
			</p>
		{/snippet}

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
	/* Testo solo, centrato: con tre pulsanti in fila su telefono va a capo invece di uscire. */
	.off {
		padding: 0 12px;
		color: var(--color-red);
		white-space: normal;
		text-align: center;
	}

	.error {
		margin-top: 12px;
	}
</style>
