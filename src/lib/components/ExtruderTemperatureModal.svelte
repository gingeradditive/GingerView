<script lang="ts">
	import { Minus, Plus } from 'lucide-svelte';
	import { portal } from '$lib/actions/portal';
	import { getMoonrakerApiUrl } from '$lib/services/config';
	import { toastActions } from '$lib/stores/toastStore';

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
	const STEP = 5;

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

	const step = (index: number, direction: 1 | -1): void => {
		const current = inputs[index] ?? 0;
		// Allinea al multiplo di 5 nella direzione del tasto: 212 → 215 / 210.
		const next =
			direction > 0
				? Math.floor(current / STEP) * STEP + STEP
				: Math.ceil(current / STEP) * STEP - STEP;
		const clamped = Math.max(0, Math.min(MAX_TEMPERATURE, next));
		inputs[index] = clamped === 0 ? null : clamped;
	};

	const formatTemperature = (value: number | null | undefined): string =>
		value == null || Number.isNaN(value) ? '--' : `${Math.round(value)}°`;

	const send = async (values: (number | null)[]): Promise<void> => {
		busy = true;
		try {
			const script = zones
				.map((zone, index) => `SET_HEATER_TEMPERATURE HEATER=${zone} TARGET=${values[index] ?? 0}`)
				.join('\n');
			const response = await fetch(
				`${getMoonrakerApiUrl()}/printer/gcode/script?script=${encodeURIComponent(script)}`,
				{ method: 'POST' }
			);
			if (!response.ok) {
				let message = `${response.status} ${response.statusText}`;
				try {
					const payload = await response.json();
					if (typeof payload?.error?.message === 'string') message = payload.error.message;
				} catch {
					// Corpo non JSON: resta lo stato HTTP.
				}
				throw new Error(message);
			}
			onClose();
		} catch (error) {
			toastActions.error(
				'klipper',
				'Could not set the temperatures',
				error instanceof Error ? error.message : 'Moonraker is unreachable'
			);
		} finally {
			busy = false;
		}
	};

	const apply = (): void => {
		if (!allValid || busy) return;
		send(inputs);
	};

	const allOff = (): void => {
		if (busy) return;
		send(zones.map(() => null));
	};
</script>

{#if isOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events,a11y_no_noninteractive_element_interactions -->
	<div
		class="modal-overlay"
		role="dialog"
		aria-modal="true"
		aria-label="Extruder temperatures"
		tabindex="-1"
		use:portal
		onclick={onClose}
		onkeydown={(e) => e.key === 'Escape' && onClose()}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events,a11y_no_noninteractive_element_interactions -->
		<div class="modal-content" role="document" onclick={(e) => e.stopPropagation()}>
			<h3>Extruder temperatures</h3>
			<p class="hint">Target per zone, in °C. Empty or 0 switches the zone off.</p>

			<div class="zone-list">
				{#each zones as zone, index (zone)}
					<div class="zone-row" class:invalid={!isValid(inputs[index])}>
						<div class="zone-info">
							<span class="zone-name">Zone {index + 1}</span>
							<span class="zone-current">Now {formatTemperature(temperatures[index])}</span>
						</div>
						<div class="stepper">
							<button
								type="button"
								class="step-btn"
								aria-label={`Lower zone ${index + 1}`}
								disabled={busy || (inputs[index] ?? 0) <= 0}
								onclick={() => step(index, -1)}><Minus size={20} /></button
							>
							<input
								type="number"
								inputmode="numeric"
								min="0"
								max={MAX_TEMPERATURE}
								step="1"
								placeholder="Off"
								aria-label={`Zone ${index + 1} target`}
								disabled={busy}
								bind:value={inputs[index]}
								onkeydown={(e) => e.key === 'Enter' && apply()}
							/>
							<button
								type="button"
								class="step-btn"
								aria-label={`Raise zone ${index + 1}`}
								disabled={busy || (inputs[index] ?? 0) >= MAX_TEMPERATURE}
								onclick={() => step(index, 1)}><Plus size={20} /></button
							>
						</div>
					</div>
				{/each}
			</div>

			{#if !allValid}
				<p class="error">Use whole numbers from 0 to {MAX_TEMPERATURE} °C.</p>
			{/if}

			<div class="modal-actions">
				<button type="button" class="btn-off" disabled={busy} onclick={allOff}>All off</button>
				<span class="spacer"></span>
				<button type="button" class="btn-cancel" onclick={onClose}>Cancel</button>
				<button type="button" class="btn-apply" disabled={busy || !allValid} onclick={apply}>
					{busy ? 'Applying…' : 'Apply'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: linear-gradient(
			135deg,
			rgba(var(--rgb-gray-mid), 0.3),
			rgba(var(--rgb-gray-mid), 0.22)
		);
		backdrop-filter: blur(12px) saturate(130%);
		-webkit-backdrop-filter: blur(12px) saturate(130%);
		z-index: 2000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
		box-sizing: border-box;
	}

	.modal-content {
		background: var(--color-white);
		border-radius: 16px;
		padding: 24px;
		width: 100%;
		max-width: 420px;
		max-height: 100%;
		overflow-y: auto;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		box-shadow: var(--shadow-panel);
	}

	h3 {
		margin: 0 0 4px;
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--color-black);
	}

	.hint {
		margin: 0 0 16px;
		font-size: 0.85rem;
		color: var(--color-text-soft);
	}

	.zone-list {
		display: flex;
		flex-direction: column;
	}

	.zone-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 10px 0;
		border-bottom: 1px solid var(--color-surface-sunken);
	}

	.zone-row:last-child {
		border-bottom: none;
	}

	.zone-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.zone-name {
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--color-black);
	}

	.zone-current {
		font-size: 0.8rem;
		color: var(--color-text-subtle);
	}

	.stepper {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}

	.step-btn {
		width: 44px;
		height: 44px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--color-background);
		border: 1px solid var(--color-border-light);
		border-radius: 10px;
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.step-btn:hover:not(:disabled) {
		background: var(--color-surface-sunken);
	}

	.step-btn:disabled {
		cursor: default;
		opacity: 0.4;
	}

	.stepper input {
		width: 72px;
		height: 44px;
		box-sizing: border-box;
		padding: 0 8px;
		border: 1px solid var(--color-gray);
		border-radius: 10px;
		font-size: 1.05rem;
		font-weight: 600;
		text-align: center;
		color: var(--color-black);
		-moz-appearance: textfield;
		appearance: textfield;
	}

	.stepper input::-webkit-outer-spin-button,
	.stepper input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.stepper input:focus {
		outline: none;
		border: 2px solid var(--color-red);
		padding: 0 7px;
	}

	.zone-row.invalid .stepper input {
		border: 2px solid var(--color-red);
		padding: 0 7px;
		color: var(--color-red);
	}

	.error {
		margin: 8px 0 0;
		font-size: 0.85rem;
		color: var(--color-red);
	}

	.modal-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 20px;
	}

	.spacer {
		flex: 1;
	}

	.modal-actions button {
		height: 40px;
		padding: 0 18px;
		border-radius: 8px;
		font-size: 0.9rem;
		cursor: pointer;
	}

	.modal-actions button:disabled {
		cursor: default;
		opacity: 0.55;
	}

	.btn-off {
		border: 1px solid var(--color-red);
		background: var(--color-white);
		color: var(--color-red);
		font-weight: 600;
	}

	.btn-cancel {
		border: 1px solid var(--color-gray);
		background: var(--color-white);
		color: var(--color-text-soft);
	}

	.btn-cancel:hover {
		background: var(--color-background);
	}

	.btn-apply {
		border: none;
		background: var(--color-red);
		color: var(--color-white);
		font-weight: 600;
	}

	.btn-apply:hover:not(:disabled) {
		background: var(--color-red-dark);
	}
</style>
