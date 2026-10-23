<script lang="ts">
	import { Power } from 'lucide-svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import ZoneTemperatureEditor from '$lib/components/ZoneTemperatureEditor.svelte';
	import { sendGcode } from '$lib/services/moonraker-gcode';

	/**
	 * Temperature libere delle zone dell'ugello — solo in modalità avanzata, la
	 * apre il pulsante sulla card temperature della dashboard.
	 *
	 * I campi partono dai target attuali e diventano effettivi solo con Apply:
	 * nessun comando parte mentre si scrive. Campo vuoto o 0 = zona spenta.
	 */
	let {
		isOpen,
		zones,
		temperatures,
		targets,
		onClose
	}: {
		isOpen: boolean;
		/** Nomi Kalico delle zone (`extruder`, `extruder1`, …), in ordine. */
		zones: string[];
		temperatures: (number | null)[];
		targets: (number | null)[];
		onClose: () => void;
	} = $props();

	// Kalico accetta fino a max_temp (1000 nella config attuale, valore di
	// calibrazione): l'interfaccia si ferma a un limite da pellet, lo stesso
	// del popup Custom di Heat & Extrude.
	const MAX_TEMPERATURE = 300;

	let inputs = $state<(number | null)[]>([]);
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
		}
		wasOpen = isOpen;
	});

	const isValid = (value: number | null): boolean =>
		value == null || (Number.isInteger(value) && value >= 0 && value <= MAX_TEMPERATURE);

	const allValid = $derived(inputs.every(isValid));

	const send = async (values: (number | null)[]): Promise<void> => {
		busy = true;
		const script = zones
			.map((zone, index) => `SET_HEATER_TEMPERATURE HEATER=${zone} TARGET=${values[index] ?? 0}`)
			.join('\n');
		const ok = await sendGcode(script, "Couldn't set the temperatures");
		busy = false;
		if (ok) onClose();
	};

	const apply = (): void => {
		if (!allValid || busy) return;
		send(inputs);
	};

	// Spegne solo i campi: come per i valori scritti a mano, il comando parte con Apply.
	const allOff = (): void => {
		if (busy) return;
		inputs = zones.map(() => null);
	};
</script>

{#if isOpen}
	<Sheet label="Extruder temperatures" {onClose} size="sm">
		{#snippet header()}
			<h3 class="sheet-title">Extruder temperatures</h3>
			<p class="sheet-subtitle">
				Target for each zone, in °C. Leave it empty or type 0 to turn a zone off.
			</p>
		{/snippet}

		<ZoneTemperatureEditor
			bind:values={inputs}
			current={temperatures}
			invalid={inputs.map((value) => !isValid(value))}
			disabled={busy}
			max={MAX_TEMPERATURE}
			placeholder="Off"
			onEnter={apply}
		/>

		{#if !allValid}
			<p class="sheet-error error">Use numbers between 0 and {MAX_TEMPERATURE} °C.</p>
		{/if}

		{#snippet footer()}
			<button
				type="button"
				class="btn btn-secondary off"
				disabled={busy || inputs.every((value) => value == null)}
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
