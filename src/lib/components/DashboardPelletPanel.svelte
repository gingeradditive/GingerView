<script lang="ts">
	import { Power } from 'lucide-svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import { tooltip } from '$lib/actions/tooltip';
	import { sendGcode } from '$lib/services/moonraker-gcode';
	import { subscribeWhileVisible } from '$lib/services/panel-subscription.svelte';

	/** Falso quando la slide è fuori dalla viewport del carosello: l'iscrizione si ferma. */
	let { visible = true }: { visible?: boolean } = $props();

	type PelletStatus = {
		print_stats?: { state?: string };
		'output_pin _FEEDER_STATUS'?: { value?: number };
	};

	const dataSource = 'dashboard-pellet';
	const dataQuery = 'print_stats&output_pin _FEEDER_STATUS';

	let isIdle = $state(true);
	// The feeder's on/off, as the machine reports it (`_FEEDER_STATUS` in
	// 50_feeder.cfg). START_PRINT switches it on and END_PRINT off: this switch is
	// for doing it by hand in between.
	let feederOn = $state(false);
	let feederBusy = $state(false);
	let showFeederOffConfirm = $state(false);
	let feederHint = $derived(
		feederOn
			? 'Feeding enabled: pellet is loaded automatically. Tap to disable it.'
			: "Feeding is disabled and there's no pellet loaded. Tap to enable it."
	);

	const updatePellet = (status: PelletStatus): void => {
		const feederStatus = status['output_pin _FEEDER_STATUS'];
		if (feederStatus && typeof feederStatus.value === 'number') {
			feederOn = feederStatus.value > 0;
		}

		const printState = status.print_stats?.state;
		if (printState) isIdle = printState !== 'printing' && printState !== 'paused';
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

<section class="pellet-panel" aria-label="Pellet feeder">
	<!-- Tutta la card è l'interruttore del feeder, come il disegno dell'estrusore apre le
	     temperature. Il disegno è il simbolo d'accensione, non un gauge: cerchio aperto in
	     alto con la barra nel varco. Rosso se acceso, grigio se spento. -->
	<button
		type="button"
		class="pellet-switch"
		class:on={feederOn}
		class:busy={feederBusy}
		role="switch"
		aria-checked={feederOn}
		aria-label="Feeding"
		aria-busy={feederBusy}
		use:tooltip={feederHint}
		onclick={toggleFeeder}
	>
		<span class="pellet-content">
			<span class="pellet-label">FEEDING</span>
			<span class="feeder-value">
				{feederBusy ? '…' : feederOn ? 'Enabled' : 'Disabled'}
			</span>
			<!-- Sotto il testo il simbolo d'accensione: cerchio aperto in alto con la barra nel
			     varco. Arco di 310° centrato in basso, il varco di 50° in alto ospita la barra. -->
			<span class="power-button" aria-hidden="true">
				<svg viewBox="-16 -16 252 252" class="power-symbol" aria-hidden="true">
					<path class="power-arc" d="M 147.19 30.24 A 88 88 0 1 1 72.81 30.24" />
					<line class="power-bar" x1="110" y1="2" x2="110" y2="62" />
				</svg>
			</span>
		</span>
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
		width: 100%;
		height: 100%;
		border-radius: 19.2px;
		box-shadow: var(--shadow-panel);
		overflow: hidden;
	}

	.pellet-switch {
		width: 100%;
		height: 100%;
		padding: 16px;
		box-sizing: border-box;
		border: none;
		border-radius: 19.2px;
		background: var(--color-white);
		font: inherit;
		color: inherit;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		/* Il simbolo si misura sulla card, non sullo schermo. */
		container-type: size;
		transition: background-color 0.15s;
		-webkit-tap-highlight-color: transparent;
	}

	.pellet-switch:hover {
		background: var(--color-background);
	}

	.pellet-switch:focus-visible {
		outline: 2px solid var(--color-red);
		outline-offset: -4px;
	}

	.pellet-switch.busy {
		cursor: progress;
	}

	/* Titolo e stato sopra, il simbolo d'accensione più piccolo sotto. */
	.pellet-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: calc(var(--dashboard-title-size) * 0.25);
		max-width: 100%;
		max-height: 100%;
		text-align: center;
		transition:
			transform 0.1s,
			opacity 0.15s;
	}

	.pellet-switch:active .pellet-content {
		transform: scale(0.97);
	}

	.pellet-switch.busy .pellet-content {
		opacity: 0.5;
	}

	/* Misurato sulla card, come il resto: il lato corto per metà. */
	/* Il simbolo dentro un anello, come un pulsante. Anello e simbolo cambiano colore insieme. */
	.power-button {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: calc(min(100cqw, 100cqh) * 0.42);
		height: calc(min(100cqw, 100cqh) * 0.42);
		margin-top: calc(var(--dashboard-title-size) * 0.35);
		border: 3px solid var(--color-text-subtle);
		border-radius: 50%;
		box-sizing: border-box;
		transition:
			border-color 0.3s,
			background-color 0.3s;
	}

	/* Acceso: fondo rosso velato, lo stesso delle strisce della barra in riscaldamento. */
	.on .power-button {
		border-color: var(--color-red);
		background: rgba(var(--rgb-red), 0.18);
	}

	.power-symbol {
		width: 58%;
		height: 58%;
	}

	/* Spento: grigio e sottile. Accensione e spegnimento hanno la stessa transizione:
	   colore e spessore sfumano, senza animazioni diverse nei due versi. */
	.power-arc,
	.power-bar {
		fill: none;
		stroke: var(--color-text-subtle);
		stroke-width: 24;
		stroke-linecap: round;
		transition:
			stroke 0.3s,
			stroke-width 0.3s;
	}

	/* Acceso: rosso e spesso. */
	.on .power-arc,
	.on .power-bar {
		stroke: var(--color-red);
		stroke-width: 30;
	}

	/* Dimensioni comuni a tutte le card, calcolate in DashboardCarousel. */
	.pellet-label {
		font-size: var(--dashboard-title-size);
		font-weight: 700;
		color: var(--color-black);
		line-height: 1.1;
		letter-spacing: 0.02em;
	}

	.feeder-value {
		font-size: var(--dashboard-subtitle-size);
		font-weight: 500;
		color: var(--color-text-soft);
		line-height: 1.3;
	}

	@media (prefers-reduced-motion: reduce) {
		.pellet-switch,
		.pellet-content,
		.power-button,
		.power-arc,
		.power-bar {
			transition: none;
		}
	}
</style>
