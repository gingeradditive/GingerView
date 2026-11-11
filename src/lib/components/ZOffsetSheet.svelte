<script lang="ts">
	import { ArrowDown, ArrowUp } from 'lucide-svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import { sendGcode } from '$lib/services/moonraker-gcode';

	/**
	 * Lo z-offset, aperto toccando la card Z HEIGHT della dashboard.
	 *
	 * In stampa ogni tocco manda subito `SET_GCODE_OFFSET Z_ADJUST=… MOVE=1`: la testa si
	 * sposta mentre stampa, come il babystepping di Mainsail. A macchina ferma niente
	 * `MOVE=1` (vorrebbe gli assi in home): l'offset vale dal movimento successivo. Il
	 * valore mostrato è quello che la macchina riporta (`gcode_move.homing_origin`).
	 */
	let {
		isOpen,
		offset,
		printing,
		onClose
	}: {
		isOpen: boolean;
		/** Lo z-offset attuale in mm, da `gcode_move.homing_origin[2]`. */
		offset: number;
		/** In stampa (o in pausa) l'offset si applica subito spostando la testa. */
		printing: boolean;
		onClose: () => void;
	} = $props();

	const steps = [0.05, 0.1, 0.5] as const;
	let step = $state<number>(0.05);

	// -0.00 diventerebbe "-0.00": sotto il mezzo centesimo è zero.
	const shown = $derived(Math.abs(offset) < 0.005 ? 0 : offset);
	const label = $derived(`${shown > 0 ? '+' : ''}${shown.toFixed(2)} mm`);

	async function run(script: string) {
		await sendGcode(script, "Couldn't change the Z offset");
	}

	const move = $derived(printing ? ' MOVE=1' : '');
	const adjust = (direction: 1 | -1) =>
		run(`SET_GCODE_OFFSET Z_ADJUST=${(direction * step).toFixed(3)}${move}`);
</script>

{#if isOpen}
	<Sheet label="Z Offset" {onClose} size="sm">
		{#snippet header()}
			<h3 class="sheet-title">Z Offset</h3>
			<p class="sheet-subtitle">
				{printing
					? 'Fine-tunes the nozzle height while printing.'
					: 'Fine-tunes the nozzle height from the next move.'}
			</p>
		{/snippet}

		<!-- Jog verticale: Up sopra, Down sotto, la direzione si legge dalla posizione. Il
		     valore è un riferimento, non il protagonista. -->
		<div class="jog">
			<button
				type="button"
				class="btn btn-secondary nudge-btn"
				aria-label="Raise the nozzle by {step} mm"
				onclick={() => adjust(1)}
			>
				<ArrowUp size={24} />
				<span>Up</span>
			</button>

			<div class="steps" role="radiogroup" aria-label="Step">
				{#each steps as value (value)}
					<button
						type="button"
						class="step"
						class:active={step === value}
						role="radio"
						aria-checked={step === value}
						onclick={() => (step = value)}>{value} mm</button
					>
				{/each}
			</div>

			<button
				type="button"
				class="btn btn-secondary nudge-btn"
				aria-label="Lower the nozzle by {step} mm"
				onclick={() => adjust(-1)}
			>
				<ArrowDown size={24} />
				<span>Down</span>
			</button>
		</div>

		<p class="value" aria-live="polite">Current offset {label}</p>

		{#snippet footer()}
			<button type="button" class="btn btn-primary" onclick={onClose}>Done</button>
		{/snippet}
	</Sheet>
{/if}

<style>
	.value {
		margin: 12px 0 0;
		font-size: 0.85rem;
		font-weight: 500;
		text-align: center;
		color: var(--color-text-soft);
		font-variant-numeric: tabular-nums;
	}

	.jog {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-top: 4px;
	}

	/* Up e Down: i pulsanti dei popup (btn-secondary, come Cancel di Heat & extrude),
	   solo più alti perché sono il comando principale. */
	.nudge-btn {
		min-height: 64px;
	}

	.nudge-btn :global(svg) {
		color: var(--color-red);
	}

	/* Gli step come Amount di Heat & extrude: bordo sottile, quello scelto bordato di rosso. */
	.steps {
		display: flex;
		gap: 12px;
	}

	.step {
		flex: 1;
		background: var(--color-white);
		border: 1px solid var(--color-border-light);
		border-radius: 10px;
		box-sizing: border-box;
		padding: 12px 8px;
		font: inherit;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.step:hover {
		background: var(--color-background);
	}

	.step.active {
		border: 2px solid var(--color-red);
		color: var(--color-red);
		padding: 11px 7px;
	}
</style>
