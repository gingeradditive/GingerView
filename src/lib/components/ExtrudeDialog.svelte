<script lang="ts">
	import { portal } from '$lib/actions/portal';
	import { getMoonrakerApiUrl } from '$lib/services/config';
	import HomingWarningModal from '$lib/components/HomingWarningModal.svelte';

	type Amount = 'low' | 'mid' | 'high';
	type Speed = 'slow' | 'standard' | 'boost';
	type Temperature = 'petg' | 'pla' | 'custom';
	type Phase = 'idle' | 'homing' | 'moving' | 'heating' | 'extruding';

	// One nozzle, four heated zones (see extruderKeys in DashboardTemperaturePanel).
	type TemperatureZones = { extruder: number; extruder1: number; extruder2: number; extruder3: number };

	type TemperaturePreset = {
		zones: TemperatureZones;
		// Klipper rotation_distance for this material; not shown in the UI.
		rotationVolume: number;
	};

	const zoneKeys: (keyof TemperatureZones)[] = ['extruder', 'extruder1', 'extruder2', 'extruder3'];

	let amount = $state<Amount>('mid');
	let speed = $state<Speed>('standard');
	let temperature = $state<Temperature>('pla');

	let phase = $state<Phase>('idle');
	let showHomingWarning = $state(false);

	const phaseLabels: Record<Phase, string> = {
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
	let customPreset = $state<TemperaturePreset>({
		zones: { extruder: 200, extruder1: 200, extruder2: 200, extruder3: 200 },
		rotationVolume: 330
	});

	const amountOptions: { value: Amount; label: string; volumeMm3: number }[] = [
		{ value: 'low', label: 'Low', volumeMm3: 1000 },
		{ value: 'mid', label: 'Mid', volumeMm3: 10000 },
		{ value: 'high', label: 'High', volumeMm3: 20000 }
	];

	const speedOptions: { value: Speed; label: string; speedMm3PerS: number }[] = [
		{ value: 'slow', label: 'Slow', speedMm3PerS: 50 },
		{ value: 'standard', label: 'Standard', speedMm3PerS: 150 },
		{ value: 'boost', label: 'Boost', speedMm3PerS: 250 }
	];

	const temperaturePresets: Record<'petg' | 'pla', TemperaturePreset> = {
		petg: {
			zones: { extruder: 200, extruder1: 220, extruder2: 220, extruder3: 220 },
			rotationVolume: 450
		},
		pla: {
			zones: { extruder: 200, extruder1: 200, extruder2: 200, extruder3: 200 },
			rotationVolume: 330
		}
	};

	const temperatureOptions: { value: Temperature; label: string }[] = [
		{ value: 'petg', label: 'PETG' },
		{ value: 'pla', label: 'PLA' },
		{ value: 'custom', label: 'Custom' }
	];

	const selectAmount = (value: Amount): void => {
		amount = value;
	};

	const selectSpeed = (value: Speed): void => {
		speed = value;
	};

	const selectTemperature = (value: Temperature): void => {
		if (value === 'custom') {
			customTemperatureInputs = { ...customPreset.zones };
			showCustomTemperatureModal = true;
			return;
		}
		temperature = value;
	};

	const cancelCustomTemperature = (): void => {
		showCustomTemperatureModal = false;
	};

	const confirmCustomTemperature = (): void => {
		const isValid = zoneKeys.every(
			(key) => Number.isFinite(customTemperatureInputs[key]) && customTemperatureInputs[key] > 0
		);
		if (isValid) {
			customPreset = {
				zones: { ...customTemperatureInputs },
				rotationVolume: customPreset.rotationVolume
			};
		}
		temperature = 'custom';
		showCustomTemperatureModal = false;
	};

	const resolveTemperaturePreset = (): TemperaturePreset =>
		temperature === 'custom' ? customPreset : temperaturePresets[temperature];

	const runGcode = async (script: string): Promise<void> => {
		await fetch(`${getMoonrakerApiUrl()}/printer/gcode/script?script=${encodeURIComponent(script)}`, {
			method: 'POST'
		});
	};

	// Purge/maintenance position: nozzle centered on X, front of the bed, well clear of it on Z.
	const getPurgePositionX = async (): Promise<number> => {
		const response = await fetch(`${getMoonrakerApiUrl()}/printer/objects/query?toolhead=axis_maximum`);
		const payload = await response.json();
		const axisMaximum = payload?.result?.status?.toolhead?.axis_maximum;
		if (!Array.isArray(axisMaximum) || typeof axisMaximum[0] !== 'number') {
			throw new Error('axis_maximum unavailable');
		}
		return axisMaximum[0] / 2;
	};

	const runExtrudeSequence = async (): Promise<void> => {
		try {
			phase = 'homing';
			await runGcode('G28');

			phase = 'moving';
			const centerX = await getPurgePositionX();
			await runGcode(`G90\nG1 X${centerX} Y0 Z250 F3000`);

			phase = 'heating';
			const preset = resolveTemperaturePreset();
			const setTemperatures = zoneKeys.map(
				(key) => `SET_HEATER_TEMPERATURE HEATER=${key} TARGET=${preset.zones[key]}`
			);
			const waitTemperatures = zoneKeys.map((key) => `TEMPERATURE_WAIT SENSOR=${key} MINIMUM=${preset.zones[key]}`);
			await runGcode([...setTemperatures, ...waitTemperatures].join('\n'));

			phase = 'extruding';
			const amountValue = amountOptions.find((option) => option.value === amount)!;
			const speedValue = speedOptions.find((option) => option.value === speed)!;
			// Assumes `extruder`'s rotation_distance is calibrated in mm3-per-rotation for the
			// active material ("rotation volume"), so a relative E move of <volumeMm3> mm
			// dispenses that many mm3. Unconfirmed on real hardware — see Q32 in docs/Q&A.md.
			await runGcode(
				[
					`SET_EXTRUDER_ROTATION_DISTANCE EXTRUDER=extruder DISTANCE=${preset.rotationVolume}`,
					'M83',
					`G1 E${amountValue.volumeMm3} F${speedValue.speedMm3PerS * 60}`,
					'M82'
				].join('\n')
			);
		} catch (error) {
			console.error('Extrude sequence failed', error);
		} finally {
			phase = 'idle';
		}
	};

	const handleExtrude = (): void => {
		if (phase !== 'idle') return;
		showHomingWarning = true;
	};

	const cancelHomingWarning = (): void => {
		showHomingWarning = false;
	};

	const confirmHomingWarning = (): void => {
		showHomingWarning = false;
		runExtrudeSequence();
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
						class:selected={amount === option.value}
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
						class:selected={speed === option.value}
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
						class:selected={temperature === option.value}
						onclick={() => selectTemperature(option.value)}
					>
						{option.label}
					</button>
				{/each}
			</div>
		</div>

		<button class="extrude-btn" disabled={phase !== 'idle'} onclick={handleExtrude}>
			{phaseLabels[phase]}
		</button>
	</div>
</div>

<HomingWarningModal isOpen={showHomingWarning} onConfirm={confirmHomingWarning} onCancel={cancelHomingWarning} />

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
