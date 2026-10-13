<script lang="ts">
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import { getMoonrakerApiUrl } from '$lib/services/config';
	import { getFileMetadata } from '$lib/services/moonraker-files';
	import { toastActions } from '$lib/stores/toastStore';
	import { subscribeWhileVisible } from '$lib/services/panel-subscription.svelte';

	/** Falso quando la slide è fuori dalla viewport del carosello: l'iscrizione si ferma. */
	let { visible = true }: { visible?: boolean } = $props();

	type PelletStatus = {
		print_stats?: { state?: string; filename?: string; filament_used?: number };
		'output_pin _FEEDER_STATUS'?: { value?: number };
	};

	const dataSource = 'dashboard-pellet';
	const dataQuery = 'print_stats&output_pin _FEEDER_STATUS';
	const maxPelletKg = 5;

	let usedKg = $state(0);
	let totalKg = $state(maxPelletKg);
	let isIdle = $state(true);
	// The feeder's on/off, as the machine reports it (`_FEEDER_STATUS` in
	// 50_feeder.cfg). START_PRINT switches it on and END_PRINT off: this switch is
	// for doing it by hand in between.
	let feederOn = $state(false);
	let feederBusy = $state(false);
	let showFeederOffConfirm = $state(false);
	let remainingKg = $derived(Math.max(0, totalKg - usedKg));
	let percentage = $derived(totalKg > 0 ? (remainingKg / totalKg) * 100 : 0);

	// Generate circles for the SVG
	const circles = Array.from({ length: 40 }, (_, i) => ({
		cx: (i + 0.5) * 2.5,
		cy: 24,
		r: Math.random() * 12 + 6,
		duration: (Math.random() * 0.6 + 0.6).toFixed(2),
		delay: (Math.random() * 0.6).toFixed(2)
	}));

	let lastFilename: string | null = null;
	let filamentWeightTotal: number | null = null;

	const loadFileWeight = async (filename: string): Promise<void> => {
		if (!filename || filename === lastFilename) return;
		lastFilename = filename;
		try {
			const metadata = await getFileMetadata(filename);
			// filament_weight_total is in grams
			if (metadata.filament_weight_total && metadata.filament_weight_total > 0) {
				filamentWeightTotal = metadata.filament_weight_total;
				totalKg = filamentWeightTotal / 1000;
			} else {
				filamentWeightTotal = null;
				totalKg = maxPelletKg;
			}
		} catch {
			filamentWeightTotal = null;
			totalKg = maxPelletKg;
		}
	};

	const updatePellet = (status: PelletStatus): void => {
		const feederStatus = status['output_pin _FEEDER_STATUS'];
		if (feederStatus && typeof feederStatus.value === 'number') {
			feederOn = feederStatus.value > 0;
		}

		const printStats = status.print_stats;
		if (!printStats) return;

		const printState = printStats.state ?? 'standby';
		isIdle = printState !== 'printing' && printState !== 'paused';

		const filename = printStats.filename ?? '';
		if (filename) {
			loadFileWeight(filename);
		} else {
			lastFilename = null;
			filamentWeightTotal = null;
			totalKg = maxPelletKg;
		}

		// filament_used is in mm; approximate weight using ~1.24 g/cm³ PLA density
		// and 1.75mm filament: weight(g) = length(mm) * π * (0.875)² * 1.24 / 1000
		const filamentUsedMm = printStats.filament_used ?? 0;
		const filamentArea = Math.PI * Math.pow(0.875, 2); // mm²
		const densityGPerMm3 = 0.00124; // g/mm³ (1.24 g/cm³)
		usedKg = (filamentUsedMm * filamentArea * densityGPerMm3) / 1000;
	};

	const setFeeder = async (enable: boolean): Promise<void> => {
		feederBusy = true;
		try {
			const response = await fetch(
				`${getMoonrakerApiUrl()}/printer/gcode/script?script=${enable ? 'FEEDER_ENABLE' : 'FEEDER_DISABLE'}`,
				{ method: 'POST' }
			);
			if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
			// The status pin follows within a second; show the new state now.
			feederOn = enable;
		} catch (error) {
			toastActions.error(
				'klipper',
				enable ? 'Could not switch the feeder on' : 'Could not switch the feeder off',
				error instanceof Error ? error.message : 'Moonraker is unreachable'
			);
		} finally {
			feederBusy = false;
		}
	};

	const toggleFeeder = (): void => {
		if (feederBusy) return;
		// With the feeder off the runout check no longer pauses the print
		// (GINGER_FEEDER_RUNOUT_PAUSE), so mid-job it takes a second tap.
		if (feederOn && !isIdle) {
			showFeederOffConfirm = true;
			return;
		}
		setFeeder(!feederOn);
	};

	const confirmFeederOff = (): void => {
		showFeederOffConfirm = false;
		setFeeder(false);
	};

	subscribeWhileVisible<PelletStatus>(
		dataSource,
		() => dataQuery,
		updatePellet,
		() => visible
	);
</script>

<section class="pellet-panel" aria-label="Pellet Level">
	<button
		class="feeder-toggle"
		class:on={feederOn}
		role="switch"
		aria-checked={feederOn}
		aria-label="Feeder"
		disabled={feederBusy}
		onclick={toggleFeeder}
	>
		<span class="feeder-toggle-label">FEEDER</span>
		<span class="feeder-toggle-track"><span class="feeder-toggle-thumb"></span></span>
	</button>
	<div class="pellet-visual">
		{#if !isIdle}
			<div class="pellet-fill" style="height: {percentage}%">
				<svg width="100%" height="48px" style="position: absolute; top: -24px; left: 0;">
					<!-- Lista statica di 40 bolle, mai riordinata: l'indice è una key corretta. -->
					{#each circles as circle, i (i)}
						<circle
							cx="{circle.cx}%"
							cy={circle.cy}
							r={circle.r}
							fill="#D72E28"
							style="animation: pellet-vibrate {circle.duration}s ease-in-out {circle.delay}s infinite;"
						/>
					{/each}
				</svg>
			</div>
		{/if}
		<div class="pellet-text">
			<span class="pellet-label">PELLET</span>
			{#if isIdle}
				<span class="pellet-value">Waiting for<br />your material!</span>
			{:else}
				<span class="pellet-value">{remainingKg.toFixed(1)}/{totalKg.toFixed(1)} KG</span>
			{/if}
		</div>
	</div>
</section>

<ConfirmModal
	isOpen={showFeederOffConfirm}
	title="Switch the feeder off?"
	message="A print is running: with the feeder off, running out of pellet will no longer pause it."
	confirmLabel="Switch off"
	onConfirm={confirmFeederOff}
	onCancel={() => (showFeederOffConfirm = false)}
/>

<style>
	.pellet-panel {
		background: var(--color-white);
		border-radius: 19.2px;
		padding: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		box-sizing: border-box;
		overflow: hidden;
		position: relative;
		box-shadow: var(--shadow-panel);
		container-type: inline-size;
	}

	/* Sopra il riempimento rosso (z-index 1) e il testo (2): fondo bianco sempre,
	   così resta leggibile anche a serbatoio pieno. */
	.feeder-toggle {
		position: absolute;
		top: 12px;
		right: 12px;
		z-index: 3;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 8px 6px 12px;
		background: var(--color-white);
		border: 1px solid var(--color-border-light);
		border-radius: 999px;
		box-shadow: var(--shadow-panel);
		cursor: pointer;
	}

	.feeder-toggle:disabled {
		cursor: default;
		opacity: 0.6;
	}

	.feeder-toggle-label {
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		color: var(--color-text-muted);
	}

	.feeder-toggle.on .feeder-toggle-label {
		color: var(--color-red);
	}

	.feeder-toggle-track {
		position: relative;
		width: 36px;
		height: 20px;
		border-radius: 999px;
		background: var(--color-gray);
		transition: background 0.15s;
	}

	.feeder-toggle.on .feeder-toggle-track {
		background: var(--color-red);
	}

	.feeder-toggle-thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--color-white);
		transition: transform 0.15s;
	}

	.feeder-toggle.on .feeder-toggle-thumb {
		transform: translateX(16px);
	}

	.pellet-visual {
		width: 100%;
		height: 100%;
		background: var(--color-white);
		border-radius: 19.2px;
		overflow: hidden;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.pellet-fill {
		position: absolute;
		bottom: 0;
		left: 0;
		width: 100%;
		background: var(--color-red);
		transition: height 0.3s ease;
		z-index: 1;
	}

	@keyframes -global-pellet-vibrate {
		0%,
		100% {
			transform: translate(0, 0);
		}
		25% {
			transform: translate(1px, -1.5px);
		}
		50% {
			transform: translate(-1.5px, 1px);
		}
		75% {
			transform: translate(1px, 1px);
		}
	}

	/* Tutta la larghezza del pannello: con left: 50% il testo ne aveva solo metà e andava a capo
	   a ogni parola. */
	.pellet-text {
		position: absolute;
		inset: 0;
		padding: 16px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		z-index: 2;
		color: var(--color-black-pure);
		text-align: center;
	}

	.pellet-label {
		font-size: min(2rem, 18cqw);
		font-weight: 700;
		color: var(--color-black-pure);
	}

	.pellet-value {
		font-size: min(1.7rem, 13cqw);
		color: var(--color-black-pure);
		font-weight: 500;
	}
</style>
