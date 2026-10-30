<script lang="ts">
	import { Power } from 'lucide-svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import ZoneTemperatureEditor from '$lib/components/ZoneTemperatureEditor.svelte';
	import { sendGcode } from '$lib/services/moonraker-gcode';

	/**
	 * Temperature libere delle zone dell'ugello e del piatto — solo in modalità
	 * avanzata, la apre il pulsante sulla card temperature della dashboard.
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

	// Kalico accetta fino a max_temp (1000 nella config attuale, valore di
	// calibrazione): l'interfaccia si ferma a un limite da pellet, lo stesso
	// del popup Custom di Heat & Extrude.
	const MAX_TEMPERATURE = 300;
	// max_temp di [heater_bed] in 30_bed.cfg.
	const MAX_BED_TEMPERATURE = 110;

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
