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

	const steps = [0.01, 0.05, 0.1] as const;
	let step = $state<number>(0.05);
	/** Comandi in volo: Kalico li esegue in ordine, qui serve solo per lo stato "Reset". */
	let pending = $state(0);

	// -0.00 diventerebbe "-0.00": sotto il mezzo centesimo è zero.
	const shown = $derived(Math.abs(offset) < 0.005 ? 0 : offset);
	const label = $derived(`${shown > 0 ? '+' : ''}${shown.toFixed(2)} mm`);

	async function run(script: string) {
		pending += 1;
		await sendGcode(script, "Couldn't change the Z offset");
		pending -= 1;
	}

	const move = $derived(printing ? ' MOVE=1' : '');
	const adjust = (direction: 1 | -1) =>
		run(`SET_GCODE_OFFSET Z_ADJUST=${(direction * step).toFixed(3)}${move}`);
</script>

{#if isOpen}
	<Sheet label="Z offset" {onClose} size="sm">
		{#snippet header()}
			<h3 class="sheet-title">Z offset</h3>
			<p class="sheet-subtitle">
				{printing
					? 'Fine-tunes the nozzle height while printing.'
					: 'Fine-tunes the nozzle height, from the next move.'}
			</p>
		{/snippet}

		<p class="value" aria-live="polite">{label}</p>

		<div class="nudge">
			<button
				type="button"
				class="nudge-btn"
				aria-label="Lower the nozzle by {step} mm"
				onclick={() => adjust(-1)}
			>
				<ArrowDown size={24} />
				<span>Closer</span>
			</button>
			<button
				type="button"
				class="nudge-btn"
				aria-label="Raise the nozzle by {step} mm"
				onclick={() => adjust(1)}
			>
				<ArrowUp size={24} />
				<span>Farther</span>
			</button>
		</div>

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

		{#snippet footer()}
			<button
				type="button"
				class="btn btn-secondary"
				disabled={shown === 0 || pending > 0}
				onclick={() => run(`SET_GCODE_OFFSET Z=0${move}`)}>Reset</button
			>
			<button type="button" class="btn btn-primary" onclick={onClose}>Done</button>
		{/snippet}
	</Sheet>
{/if}

<style>
	.value {
		margin: 4px 0 16px;
		font-size: 2.2rem;
		font-weight: 700;
		text-align: center;
		color: var(--color-black);
		font-variant-numeric: tabular-nums;
	}

	.nudge {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.nudge-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-height: 64px;
		border: 1px solid var(--color-border-light);
		border-radius: 14px;
		background: var(--color-background);
		color: var(--color-black);
		font: inherit;
		font-size: 1.05rem;
		font-weight: 700;
		cursor: pointer;
		transition:
			background-color 0.15s,
			transform 0.1s;
		-webkit-tap-highlight-color: transparent;
	}

	.nudge-btn :global(svg) {
		color: var(--color-red);
	}

	.nudge-btn:hover {
		background: var(--color-surface-sunken);
	}

	.nudge-btn:active {
		transform: scale(0.97);
	}

	.steps {
		margin-top: 12px;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 6px;
		padding: 4px;
		border-radius: 12px;
		background: var(--color-background);
	}

	.step {
		min-height: 40px;
		border: none;
		border-radius: 9px;
		background: transparent;
		color: var(--color-text-muted);
		font: inherit;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
	}

	.step.active {
		background: var(--color-white);
		color: var(--color-black);
		box-shadow: 0 1px 3px rgba(var(--rgb-black), 0.12);
	}

	@media (prefers-reduced-motion: reduce) {
		.nudge-btn {
			transition: none;
		}
	}
</style>
