<script lang="ts">
	import { portal } from '$lib/actions/portal';
	import HomingWarningModal from '$lib/components/HomingWarningModal.svelte';
	import {
		amountOptions,
		customTemperaturePreset,
		extrudeAmount,
		extrudePhase,
		extrudeSpeed,
		extrudeTemperature,
		speedOptions,
		startExtrudeSequence,
		temperatureOptions,
		zoneKeys,
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
		idle: 'EXTRUDE',
		homing: 'Homing...',
		moving: 'Moving...',
		heating: 'Heating...',
		extruding: 'Extruding...'
	};

	let showCustomTemperatureModal = $state(false);
	let customTemperatureInputs = $state<TemperatureZones>({
		extruder: 200,
		extruder1: 200,
		extruder2: 200,
		extruder3: 200
	});

	const selectAmount = (value: Amount): void => {
		extrudeAmount.set(value);
	};

	const selectSpeed = (value: Speed): void => {
		extrudeSpeed.set(value);
	};

	const selectTemperature = (value: Temperature): void => {
		if (value === 'custom') {
			customTemperatureInputs = { ...$customTemperaturePreset.zones };
			showCustomTemperatureModal = true;
			return;
		}
		extrudeTemperature.set(value);
	};

	const cancelCustomTemperature = (): void => {
		showCustomTemperatureModal = false;
	};

	const confirmCustomTemperature = (): void => {
		const isValid = zoneKeys.every(
			(key) => Number.isFinite(customTemperatureInputs[key]) && customTemperatureInputs[key] > 0
		);
		if (isValid) {
			customTemperaturePreset.set({
				zones: { ...customTemperatureInputs },
				rotationVolume: $customTemperaturePreset.rotationVolume
			});
		}
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

<div class="extrude-dialog-card">
	<div class="viz-card">
		<svg viewBox="0 0 200 358" class="extruder-svg" role="presentation" aria-hidden="true">
			<path
				class="funnel"
				d="M70,10 L130,10 L130,46 L150,46 L150,86 L100,128 L50,86 L50,46 L70,46 Z"
				fill="#d9d9d9"
				stroke="#9a9a9a"
				stroke-width="6"
				stroke-linejoin="round"
			/>
			<line
				class="stem"
				x1="100"
				y1="128"
				x2="100"
				y2="302"
				stroke="#d72e28"
				stroke-width="8"
				stroke-linecap="round"
			/>
			<rect
				class="drip drip-top"
				x="79"
				y="299"
				width="42"
				height="10"
				rx="4"
				fill="#d72e28"
				stroke="#ffffff"
				stroke-width="1"
			/>
			<rect
				class="drip drip-mid"
				x="68.5"
				y="309"
				width="63"
				height="12"
				rx="5"
				fill="#d72e28"
				stroke="#ffffff"
				stroke-width="1"
			/>
			<rect
				class="drip drip-base"
				x="58"
				y="321"
				width="84"
				height="14"
				rx="6"
				fill="#d72e28"
				stroke="#ffffff"
				stroke-width="1"
			/>
		</svg>
	</div>

	<div class="settings-card">
		<div class="option-section">
			<span class="option-label">AMOUNT</span>
			<div class="option-row">
				{#each amountOptions as option (option.value)}
					<button
						class="option-btn"
						class:selected={$extrudeAmount === option.value}
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
						onclick={() => selectTemperature(option.value)}
					>
						{option.label}
					</button>
				{/each}
			</div>
		</div>

		<button class="extrude-btn" disabled={$extrudePhase !== 'idle'} onclick={handleExtrude}>
			{phaseLabels[$extrudePhase]}
		</button>
	</div>
</div>

<HomingWarningModal
	isOpen={showHomingWarning}
	onConfirm={confirmHomingWarning}
	onCancel={cancelHomingWarning}
/>

{#if showCustomTemperatureModal}
	<!-- svelte-ignore a11y_click_events_have_key_events,a11y_no_noninteractive_element_interactions -->
	<div
		class="modal-overlay"
		role="dialog"
		aria-modal="true"
		aria-label="Custom temperature"
		tabindex="-1"
		use:portal
		onclick={cancelCustomTemperature}
		onkeydown={(e) => e.key === 'Escape' && cancelCustomTemperature()}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events,a11y_no_noninteractive_element_interactions -->
		<div class="modal-content" role="document" onclick={(e) => e.stopPropagation()}>
			<h3>Custom temperature</h3>
			<div class="modal-field-grid">
				<label class="modal-field">
					<span>Zone 1 (°C)</span>
					<input
						type="number"
						min="0"
						max="300"
						bind:value={customTemperatureInputs.extruder}
						onkeydown={(e) => e.key === 'Enter' && confirmCustomTemperature()}
					/>
				</label>
				<label class="modal-field">
					<span>Zone 2 (°C)</span>
					<input
						type="number"
						min="0"
						max="300"
						bind:value={customTemperatureInputs.extruder1}
						onkeydown={(e) => e.key === 'Enter' && confirmCustomTemperature()}
					/>
				</label>
				<label class="modal-field">
					<span>Zone 3 (°C)</span>
					<input
						type="number"
						min="0"
						max="300"
						bind:value={customTemperatureInputs.extruder2}
						onkeydown={(e) => e.key === 'Enter' && confirmCustomTemperature()}
					/>
				</label>
				<label class="modal-field">
					<span>Zone 4 (°C)</span>
					<input
						type="number"
						min="0"
						max="300"
						bind:value={customTemperatureInputs.extruder3}
						onkeydown={(e) => e.key === 'Enter' && confirmCustomTemperature()}
					/>
				</label>
			</div>
			<div class="modal-actions">
				<button class="modal-cancel" onclick={cancelCustomTemperature}>Cancel</button>
				<button class="modal-confirm" onclick={confirmCustomTemperature}>Confirm</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.extrude-dialog-card {
		width: 100%;
		height: 100%;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.viz-card {
		background: #ffffff;
		border-radius: 16px;
		box-shadow: 0px 4px 3px 0px #00000040;
		box-sizing: border-box;
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
	}

	.extruder-svg {
		width: 40%;
		height: 95%;
		display: block;
	}

	.settings-card {
		background: #ffffff;
		border-radius: 16px;
		box-shadow: 0px 4px 3px 0px #00000040;
		box-sizing: border-box;
		flex-shrink: 0;
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 16px;
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
		color: #111111;
	}

	.option-row {
		display: flex;
		gap: 12px;
	}

	.option-btn {
		flex: 1;
		background: #ffffff;
		border: 1px solid #e0e0e0;
		border-radius: 10px;
		box-sizing: border-box;
		padding: 12px 8px;
		font-size: 0.95rem;
		font-weight: 600;
		color: #4a4a4a;
		cursor: pointer;
	}

	.option-btn:hover {
		background: #f5f5f5;
	}

	.option-btn.selected {
		border: 2px solid #d72e28;
		color: #d72e28;
		padding: 11px 7px;
	}

	.divider {
		height: 1px;
		background: #ececec;
	}

	.extrude-btn {
		background: #d72e28;
		border: none;
		border-radius: 16px;
		box-sizing: border-box;
		padding: 18px;
		color: #ffffff;
		font-size: 1.2rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		cursor: pointer;
	}

	.extrude-btn:hover {
		background: #b82520;
	}

	.extrude-btn:disabled {
		cursor: default;
		opacity: 0.55;
		pointer-events: none;
	}

	.modal-overlay {
		position: fixed;
		inset: 0;
		background: linear-gradient(135deg, rgba(100, 100, 100, 0.3), rgba(100, 100, 100, 0.22));
		backdrop-filter: blur(12px) saturate(130%);
		-webkit-backdrop-filter: blur(12px) saturate(130%);
		z-index: 2000;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.modal-content {
		background: #fff;
		border-radius: 16px;
		padding: 24px;
		min-width: 300px;
		max-width: 400px;
		display: flex;
		flex-direction: column;
		box-shadow: 0px 4px 3px 0px #00000040;
	}

	.modal-content h3 {
		margin: 0 0 16px 0;
		font-size: 1.1rem;
		font-weight: 700;
		color: #111;
	}

	.modal-field-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		margin-bottom: 20px;
	}

	.modal-field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 0.9rem;
		color: #4a4a4a;
	}

	.modal-field input {
		width: 100%;
		box-sizing: border-box;
		padding: 10px 12px;
		border: 1px solid #c8c8c8;
		border-radius: 8px;
		font-size: 1rem;
	}

	.modal-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}

	.modal-cancel {
		padding: 8px 20px;
		border: 1px solid #c8c8c8;
		border-radius: 8px;
		background: #fff;
		cursor: pointer;
		font-size: 0.9rem;
		color: #666;
	}

	.modal-cancel:hover {
		background-color: #f5f5f5;
	}

	.modal-confirm {
		padding: 8px 20px;
		border: none;
		border-radius: 8px;
		background: #d72e28;
		color: white;
		cursor: pointer;
		font-size: 0.9rem;
		transition: background-color 0.15s;
	}

	.modal-confirm:hover {
		background: #b82520;
	}
</style>
