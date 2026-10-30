<script lang="ts">
	import { Minus, Plus, Thermometer } from 'lucide-svelte';

	/**
	 * I target delle zone dell'ugello disegnati come lo scheletro dell'estrusore della
	 * dashboard: zona 1 in alto, l'ugello in fondo, così si vede quale zona si sta impostando.
	 * Lo usano il Custom di Heat & Extrude e le temperature della dashboard.
	 *
	 * Ogni banda grigia contiene solo il campo; −/+ (passi da 5 °C) stanno ai suoi lati, il
	 * nome della zona fuori a sinistra (con la temperatura attuale, se passata); il °C sta nel
	 * riquadro bianco accanto al numero.
	 * La validazione è del chiamante: `invalid` dice quali bande colorare di rosso.
	 *
	 * Con `withBed` sotto l'ugello compare anche il piatto, come nella card della dashboard.
	 */
	let {
		values = $bindable(),
		current,
		invalid = [],
		disabled = false,
		max = 300,
		placeholder = '',
		withBed = false,
		bed = $bindable(null),
		bedCurrent,
		bedInvalid = false,
		bedMax = 110,
		onEdit,
		onEnter
	}: {
		values: (number | null)[];
		/** Temperature attuali, mostrate sotto il numero della zona. */
		current?: (number | null)[];
		invalid?: boolean[];
		disabled?: boolean;
		max?: number;
		placeholder?: string;
		withBed?: boolean;
		bed?: number | null;
		bedCurrent?: number | null;
		bedInvalid?: boolean;
		bedMax?: number;
		/** A ogni modifica, da campo o da −/+: per togliere l'errore mentre si corregge. */
		onEdit?: () => void;
		onEnter?: () => void;
	} = $props();

	const STEP = 5;

	// Allinea al multiplo di 5 nella direzione del tasto: 212 → 215 / 210.
	const stepped = (value: number | null, direction: 1 | -1, limit: number): number | null => {
		const from = value ?? 0;
		const next =
			direction > 0 ? Math.floor(from / STEP) * STEP + STEP : Math.ceil(from / STEP) * STEP - STEP;
		const clamped = Math.max(0, Math.min(limit, next));
		return clamped === 0 ? null : clamped;
	};

	const step = (index: number, direction: 1 | -1): void => {
		values[index] = stepped(values[index], direction, max);
		onEdit?.();
	};

	const stepBed = (direction: 1 | -1): void => {
		bed = stepped(bed, direction, bedMax);
		onEdit?.();
	};

	const formatCurrent = (value: number | null | undefined): string =>
		value == null || Number.isNaN(value) ? '--' : `${Math.round(value)} °C`;
</script>

<div class="skeleton">
	{#each values as _, index (index)}
		<div class="zone-row">
			<span class="zone-label">
				<span class="zone-name">Zone {index + 1}</span>
				{#if current}
					<span class="zone-current" title="Current temperature">
						<Thermometer size={12} />
						{formatCurrent(current[index])}
					</span>
				{/if}
			</span>
			<button
				type="button"
				class="step-btn"
				aria-label={`Lower zone ${index + 1} by ${STEP} °C`}
				disabled={disabled || (values[index] ?? 0) <= 0}
				onclick={() => step(index, -1)}><Minus size={18} /></button
			>
			<span class="zone-band" class:invalid={invalid[index]}>
				<span class="field" class:empty={values[index] == null}>
					<input
						type="number"
						inputmode="numeric"
						min="0"
						{max}
						step="1"
						{placeholder}
						{disabled}
						aria-label={`Zone ${index + 1} target, °C`}
						aria-invalid={invalid[index]}
						bind:value={values[index]}
						oninput={() => onEdit?.()}
						onkeydown={(e) => e.key === 'Enter' && onEnter?.()}
					/>
					{#if values[index] != null}
						<span class="unit" aria-hidden="true">°C</span>
					{/if}
				</span>
			</span>
			<button
				type="button"
				class="step-btn"
				aria-label={`Raise zone ${index + 1} by ${STEP} °C`}
				disabled={disabled || (values[index] ?? 0) >= max}
				onclick={() => step(index, 1)}><Plus size={18} /></button
			>
		</div>
	{/each}
	<img class="skeleton-nozzle" src="/NozzleHead.svg" alt="" />
	{#if withBed}
		<div class="zone-row bed-row">
			<span class="zone-label">
				<span class="zone-name">Bed</span>
				{#if bedCurrent !== undefined}
					<span class="zone-current" title="Current temperature">
						<Thermometer size={12} />
						{formatCurrent(bedCurrent)}
					</span>
				{/if}
			</span>
			<button
				type="button"
				class="step-btn"
				aria-label={`Lower the bed by ${STEP} °C`}
				disabled={disabled || (bed ?? 0) <= 0}
				onclick={() => stepBed(-1)}><Minus size={18} /></button
			>
			<span class="zone-band" class:invalid={bedInvalid}>
				<span class="field" class:empty={bed == null}>
					<input
						type="number"
						inputmode="numeric"
						min="0"
						max={bedMax}
						step="1"
						{placeholder}
						{disabled}
						aria-label="Bed target, °C"
						aria-invalid={bedInvalid}
						bind:value={bed}
						oninput={() => onEdit?.()}
						onkeydown={(e) => e.key === 'Enter' && onEnter?.()}
					/>
					{#if bed != null}
						<span class="unit" aria-hidden="true">°C</span>
					{/if}
				</span>
			</span>
			<button
				type="button"
				class="step-btn"
				aria-label={`Raise the bed by ${STEP} °C`}
				disabled={disabled || (bed ?? 0) >= bedMax}
				onclick={() => stepBed(1)}><Plus size={18} /></button
			>
		</div>
	{/if}
</div>

<style>
	.skeleton {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}

	/* Colonne laterali uguali (l'ultima vuota): la banda resta in asse con l'ugello. */
	.zone-row {
		display: grid;
		grid-template-columns: 68px 40px 120px 40px 68px;
		align-items: center;
		gap: 8px;
	}

	.zone-label {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 2px;
		text-align: right;
		line-height: 1.15;
	}

	.zone-name {
		font-size: 0.9rem;
		font-weight: 700;
		color: var(--color-text-secondary);
		white-space: nowrap;
	}

	.zone-current {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-subtle);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	/* La card grigia della dashboard, con dentro solo il campo. */
	.zone-band {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 54px;
		border: 1px solid var(--color-text-subtle);
		border-radius: 8px;
		background: var(--color-gray-light);
		box-sizing: border-box;
	}

	.zone-band:focus-within {
		border-color: var(--color-red);
		box-shadow: 0 0 0 3px rgba(var(--rgb-red), 0.15);
	}

	.zone-band.invalid {
		border-color: var(--color-red);
	}

	.zone-band.invalid input {
		color: var(--color-red);
	}

	.step-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		padding: 0;
		border: 1px solid var(--color-border-light);
		border-radius: 10px;
		background: var(--color-white);
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.step-btn:hover:not(:disabled) {
		background: var(--color-background);
	}

	.step-btn:disabled {
		cursor: default;
		opacity: 0.35;
	}

	/* Il riquadro bianco: numero e °C, cliccabile tutto come il campo. */
	.field {
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 6px;
		width: 96px;
		height: 40px;
		padding: 0 8px;
		box-sizing: border-box;
		border-radius: 8px;
		background: var(--color-white);
		line-height: 40px;
	}

	input {
		width: 48px;
		height: 40px;
		padding: 0;
		border: none;
		background: transparent;
		font-family: inherit;
		font-size: 1.25rem;
		font-weight: 700;
		text-align: right;
		color: var(--color-black);
		appearance: textfield;
		-moz-appearance: textfield;
	}

	/* Vuoto mostra il placeholder ("Off"): senza °C accanto, centrato. */
	.field.empty input {
		width: 100%;
		text-align: center;
	}

	.unit {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-text-subtle);
	}

	input::placeholder {
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-text-subtle);
	}

	input::-webkit-outer-spin-button,
	input::-webkit-inner-spin-button {
		appearance: none;
		margin: 0;
	}

	input:focus {
		outline: none;
	}

	.skeleton-nozzle {
		width: 62px;
		height: 33px;
		margin-top: 2px;
		object-fit: contain;
	}

	/* Il piatto sta sotto l'ugello, staccato come nella card della dashboard. */
	.bed-row {
		margin-top: 4px;
	}
</style>
