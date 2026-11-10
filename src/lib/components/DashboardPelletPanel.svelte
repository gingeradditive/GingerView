<script lang="ts">
	import { Power } from 'lucide-svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import { tooltip } from '$lib/actions/tooltip';
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
	let feederHint = $derived(
		feederOn
			? 'Feeder on: pellet is loaded automatically. Tap to switch off'
			: "The feeder's off and there's no pellet loaded. Tap to turn it on."
	);
	let remainingKg = $derived(Math.max(0, totalKg - usedKg));
	// Solo nel dev server: card sempre mezza piena, per vedere il bordo tra pieno e vuoto
	// anche a stampa ferma. Nella build per la stampante `DEV` è falso e sparisce.
	const debugHalfFull = import.meta.env.DEV;
	let percentage = $derived(debugHalfFull ? 50 : totalKg > 0 ? (remainingKg / totalKg) * 100 : 0);

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
			enable ? "Couldn't turn the feeder on" : "Couldn't turn the feeder off"
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
	<!-- Tutta la card è l'interruttore del feeder, come il disegno dell'estrusore apre le
	     temperature. Lo stato sta nel tasto tondo d'accensione sotto il titolo: rosso pieno
	     se acceso. -->
	<button
		type="button"
		class="pellet-visual"
		role="switch"
		aria-checked={feederOn}
		aria-label="Feeder"
		aria-busy={feederBusy}
		use:tooltip={feederHint}
		onclick={toggleFeeder}
	>
		{#if !isIdle || debugHalfFull}
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
			<span class="feeder-state" class:on={feederOn} aria-hidden="true">
				<span class="feeder-power" class:on={feederOn} class:busy={feederBusy}>
					<Power size="45%" strokeWidth={2.5} />
				</span>
				<span class="feeder-word">{feederBusy ? '…' : feederOn ? 'FEEDER ON' : 'FEEDER OFF'}</span>
			</span>
		</div>
	</button>
</section>

<ConfirmModal
	tone="warning"
	icon={Power}
	isOpen={showFeederOffConfirm}
	title="Turn the feeder off?"
	message="Heads up! A print is running. With the feeder off, the print won't pause if you run out of pellets!"
	confirmLabel="Turn it off"
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

	/* Lo stato del feeder sotto il titolo: tasto tondo d'accensione e la parola ON/OFF.
	   Non è un pulsante a sé: tutta la card è l'interruttore, questo ne mostra lo stato.
	   Acceso e spento devono distinguersi a colpo d'occhio, anche sopra il riempimento:
	   acceso è rosso pieno, più grande, con onde che si allargano; spento è grigio, piccolo
	   e fermo. Al cambio il tasto fa un piccolo scatto. */
	.feeder-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		margin-top: 16px;
	}

	.feeder-power {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: min(84px, 27cqw);
		aspect-ratio: 1;
		border-radius: 50%;
		background: var(--color-surface-sunken);
		color: var(--color-gray);
		box-shadow:
			inset 0 0 0 2px var(--color-gray-light),
			0 0 0 3px var(--color-white);
		transform: scale(0.88);
		animation: power-off 0.3s ease-out;
		transition:
			background-color 0.2s,
			color 0.2s,
			opacity 0.15s;
	}

	.feeder-power.on {
		background: var(--color-red);
		color: var(--color-white);
		box-shadow:
			0 0 0 3px var(--color-white),
			0 4px 16px rgba(var(--rgb-red), 0.5);
		transform: scale(1);
		animation: power-on 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.4);
	}

	/* Onde rosse con il bordo bianco: si vedono sul fondo bianco e sul riempimento rosso. */
	.feeder-power.on::before,
	.feeder-power.on::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 50%;
		border: 2px solid var(--color-red);
		box-shadow: 0 0 0 2px rgba(var(--rgb-white), 0.8);
		animation: power-wave 2s ease-out infinite;
		pointer-events: none;
	}

	.feeder-power.on::after {
		animation-delay: 1s;
	}

	.feeder-power.busy {
		opacity: 0.5;
	}

	.feeder-word {
		padding: 2px 8px;
		border-radius: 999px;
		background: var(--color-white);
		color: var(--color-text-subtle);
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		transition:
			background-color 0.2s,
			color 0.2s;
	}

	.feeder-state.on .feeder-word {
		background: var(--color-red);
		color: var(--color-white);
		box-shadow: 0 0 0 2px var(--color-white);
	}

	@keyframes power-on {
		0% {
			transform: scale(0.88);
		}
		50% {
			transform: scale(1.15);
		}
		100% {
			transform: scale(1);
		}
	}

	@keyframes power-off {
		0% {
			transform: scale(1);
		}
		40% {
			transform: scale(0.8);
		}
		100% {
			transform: scale(0.88);
		}
	}

	@keyframes power-wave {
		0% {
			transform: scale(1);
			opacity: 0.9;
		}
		100% {
			transform: scale(1.8);
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.feeder-power,
		.feeder-power.on,
		.feeder-power.on::before,
		.feeder-power.on::after {
			animation: none;
			transition: none;
		}
	}

	.pellet-visual {
		width: 100%;
		height: 100%;
		padding: 0;
		border: none;
		font: inherit;
		color: inherit;
		background: var(--color-white);
		border-radius: 19.2px;
		overflow: hidden;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: filter 0.15s;
		-webkit-tap-highlight-color: transparent;
	}

	.pellet-visual:hover {
		filter: brightness(0.98);
	}

	.pellet-visual:active {
		filter: brightness(0.94);
	}

	.pellet-visual:focus-visible {
		outline: 2px solid var(--color-red);
		outline-offset: -4px;
	}

	.pellet-visual[aria-busy='true'] {
		cursor: progress;
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
		/* Centrato sulla card intera, come i testi di Z HEIGHT e FLOW. */
		padding: 16px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: calc(var(--dashboard-title-size) * 0.25);
		z-index: 2;
		color: var(--color-black-pure);
		text-align: center;
	}

	/* Stesso font del titolo FLOW. */
	.pellet-label {
		font-size: min(var(--dashboard-title-size), 18cqw);
		font-weight: 700;
		color: var(--color-black);
		line-height: 1.1;
		letter-spacing: 0.02em;
	}
</style>
