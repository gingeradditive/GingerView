<script lang="ts">
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import DashboardCardBar from '$lib/components/DashboardCardBar.svelte';
	import Fraction from '$lib/components/Fraction.svelte';
	import { getFileMetadata } from '$lib/services/moonraker-files';
	import { sendGcode } from '$lib/services/moonraker-gcode';
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
	// I G-code Ginger contano il "filamento" in mm³: filament_diameter 1.1284 dà
	// 1 mm³ per mm, e 1.24 g/cm³ è la densità che Orca usa di default.
	const defaultGramsPerMm = 0.00124;
	// Senza filament_used in crescita da questo tempo, la macchina non estrude.
	const extrudingTimeoutMs = 2000;

	let usedKg = $state(0);
	let totalKg = $state(maxPelletKg);
	let isIdle = $state(true);
	// I pallini vibrano solo mentre il pellet scende davvero: fermi in pausa e
	// durante il riscaldamento.
	let extruding = $state(false);
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
	let gramsPerMm = defaultGramsPerMm;
	let lastFilamentUsed = 0;
	let lastExtrusionAt = 0;
	let printing = false;

	const updateExtruding = (): void => {
		extruding = printing && Date.now() - lastExtrusionAt < extrudingTimeoutMs;
	};

	// Lo stato arriva solo quando cambia: se filament_used smette di salire non
	// arriva niente, e i pallini si fermano grazie a questo controllo.
	$effect(() => {
		const timer = setInterval(updateExtruding, 500);
		return () => clearInterval(timer);
	});

	const loadFileWeight = async (filename: string): Promise<void> => {
		if (!filename || filename === lastFilename) return;
		lastFilename = filename;
		try {
			const metadata = await getFileMetadata(filename);
			const weight = metadata.filament_weight_total ?? 0; // g
			const length = metadata.filament_total ?? 0; // mm
			totalKg = weight > 0 ? weight / 1000 : maxPelletKg;
			// Il rapporto peso/lunghezza del file stesso vale qualunque diametro e
			// densità abbia impostato lo slicer.
			gramsPerMm = weight > 0 && length > 0 ? weight / length : defaultGramsPerMm;
		} catch {
			totalKg = maxPelletKg;
			gramsPerMm = defaultGramsPerMm;
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
			totalKg = maxPelletKg;
			gramsPerMm = defaultGramsPerMm;
		}

		const filamentUsed = printStats.filament_used ?? 0; // mm
		if (filamentUsed > lastFilamentUsed) lastExtrusionAt = Date.now();
		lastFilamentUsed = filamentUsed;
		printing = printState === 'printing';
		updateExtruding();
		usedKg = (filamentUsed * gramsPerMm) / 1000;
	};

	const setFeeder = async (enable: boolean): Promise<void> => {
		feederBusy = true;
		const ok = await sendGcode(
			enable ? 'FEEDER_ENABLE' : 'FEEDER_DISABLE',
			enable ? 'Could not switch the feeder on' : 'Could not switch the feeder off'
		);
		// The status pin follows within a second; show the new state now.
		if (ok) feederOn = enable;
		feederBusy = false;
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
	<div class="pellet-visual">
		{#if !isIdle}
			<div class="pellet-fill" style="height: {percentage}%">
				<svg
					width="100%"
					height="48px"
					style="position: absolute; top: -24px; left: 0;"
					class:still={!extruding}
				>
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
				<span class="pellet-value idle">Waiting for<br />your material!</span>
			{:else}
				<span class="pellet-value"
					><Fraction value={remainingKg.toFixed(1)} total={totalKg.toFixed(1)} unit="KG" /></span
				>
			{/if}
		</div>
	</div>
	<DashboardCardBar
		label="FEEDER"
		active={feederOn}
		role="switch"
		ariaLabel="Feeder"
		ariaChecked={feederOn}
		hint={feederOn
			? 'Feeder on: pellet is loaded automatically. Tap to switch off'
			: 'Feeder off: no pellet is loaded. Tap to switch on'}
		disabled={feederBusy}
		onclick={toggleFeeder}
	>
		<span class="status-dot" class:on={feederOn}></span>
		{feederBusy ? '…' : feederOn ? 'ON' : 'OFF'}
	</DashboardCardBar>
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

	/* Il pallino accanto a ON/OFF nella barra del feeder (DashboardCardBar). */
	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-gray-light);
	}

	.status-dot.on {
		background: var(--color-red);
		animation: status-pulse 1.6s ease-in-out infinite;
	}

	@keyframes status-pulse {
		0%,
		100% {
			box-shadow: 0 0 0 0 rgba(215, 46, 40, 0.45);
		}
		50% {
			box-shadow: 0 0 0 5px rgba(215, 46, 40, 0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.status-dot.on {
			animation: none;
		}
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

	.still circle {
		/* Lo stile inline imposta l'animazione: qui serve !important per fermarla. */
		animation-play-state: paused !important;
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
		/* In fondo c'è la barra del feeder (52px + 12px di margine): il testo si
		   centra nello spazio che resta sopra. */
		padding: 16px 16px 76px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		z-index: 2;
		color: var(--color-black-pure);
		text-align: center;
	}

	/* Stessi font di FLOW e "Let me extrude!". */
	.pellet-label {
		font-size: min(2rem, 18cqw);
		font-weight: 700;
		color: var(--color-black);
		line-height: 1.1;
		letter-spacing: 0.02em;
	}

	.pellet-value {
		font-size: min(1.7rem, 13cqw);
		color: var(--color-black-pure);
		font-weight: 500;
		line-height: 1.3;
	}

	/* A riposo non c'è il riempimento rosso sotto: grigio come "Let me extrude!". */
	.pellet-value.idle {
		color: var(--color-text-soft);
	}
</style>
