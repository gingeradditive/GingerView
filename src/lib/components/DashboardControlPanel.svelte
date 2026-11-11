<script lang="ts">
	import { formatClockHM } from '$lib/utils/format';
	import { loadNozzleZones } from '$lib/services/moonraker-zones';
	import SoftValue from '$lib/components/ui/SoftValue.svelte';
	import { tooltip } from '$lib/actions/tooltip';
	import { onMount } from 'svelte';
	import { mdiLightbulb, mdiLightbulbOff, mdiFan, mdiStop } from '@mdi/js';
	import { sendGcode } from '$lib/services/moonraker-gcode';
	import { formatZoneTime } from '$lib/services/timezone';
	import { ensurePrinterTimezone, printerTimezone } from '$lib/stores/timezoneStore';
	import { subscribeWhileVisible } from '$lib/services/panel-subscription.svelte';
	import QuickActionSliderPopup from '$lib/components/QuickActionSliderPopup.svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';

	type Heater = { temperature?: number; target?: number };
	type ControlStatus = {
		print_stats?: {
			state?: string;
			filename?: string;
			print_duration?: number;
			filament_used?: number;
		};
		virtual_sdcard?: { progress?: number };
		fan?: { speed?: number };
		'led LED_CAMERA'?: { color_data?: number[][] };
	};

	const dataSource = 'dashboard-control';
	// Le zone dell'ugello e il piano servono solo per dire cosa sta scaldando prima della
	// prima estrusione; finché le zone non si sanno c'è solo il piano.
	let zoneKeys = $state<string[]>([]);
	const dataQuery = $derived(
		['print_stats&virtual_sdcard&fan&led LED_CAMERA', 'heater_bed', ...zoneKeys].join('&')
	);
	const circumference = 2 * Math.PI * 16;

	let elapsed = $state('--:--');
	/*
	 * Stampa avviata ma non ancora partita davvero: riscaldamento, homing, spurgo. Kalico
	 * conta print_duration solo dalla prima estrusione, quindi fin lì tempi e percentuale
	 * restano fermi e sembrava tutto bloccato. La barra si anima e dice cosa succede.
	 */
	let preparing = $state(false);
	let prepText = $state('Getting ready…');
	/*
	 * Tempo che manca e ora di fine sono stime ricalcolate a ogni aggiornamento, e ballano.
	 * Si calcolano sempre (`raw*`), ma a schermo arrivano solo ogni ETA_REFRESH_MS, in
	 * dissolvenza. Subito solo quando compaiono o spariscono (inizio e fine stampa).
	 * L'istante di fine, non la stringa: vedi `DashboardPrintJobPanel`.
	 */
	const ETA_REFRESH_MS = 5000;
	let rawRemaining: number | null = null;
	let rawEtaAt: Date | null = null;
	let remainingSeconds = $state<number | null>(null);
	let etaAt = $state<Date | null>(null);
	let remaining = $derived(formatClockHM(remainingSeconds));
	let eta = $derived(etaAt ? formatZoneTime($printerTimezone, etaAt) : '--:--');

	const publishEstimates = (): void => {
		remainingSeconds = rawRemaining;
		etaAt = rawEtaAt;
	};

	$effect(() => {
		const timer = setInterval(publishEstimates, ETA_REFRESH_MS);
		return () => clearInterval(timer);
	});
	let progress = $state(0);
	let isPrinting = $state(false);
	let isPaused = $state(false);
	/* Stop e pausa hanno senso solo con un job attivo: fuori sono spenti, non
	   premibili a vuoto. Finché lo stato non arriva valgono come "fermo". */
	let hasActiveJob = $derived(isPrinting || isPaused);

	let fanSpeed = $state(0);
	let lightValue = $state(0);
	let fanOn = $state(false);
	let lightOn = $state(false);
	let fanPopupOpen = $state(false);
	let lightPopupOpen = $state(false);

	let fanDash = $derived(`${fanSpeed * circumference} ${circumference}`);
	let lightDash = $derived(`${lightValue * circumference} ${circumference}`);

	let estimatedTotalSeconds: number | null = null;
	let lastFilename: string | null = null;

	const loadEstimatedTime = async (filename: string): Promise<void> => {
		if (!filename || filename === lastFilename) return;
		lastFilename = filename;
		try {
			const { getFileMetadata } = await import('$lib/services/moonraker-files');
			const metadata = await getFileMetadata(filename);
			estimatedTotalSeconds = metadata.estimated_time ?? null;
		} catch {
			estimatedTotalSeconds = null;
		}
	};

	/** Il riscaldatore più indietro (in proporzione) tra zone dell'ugello e piano. */
	const describePreparation = (status: ControlStatus): string => {
		const record = status as Record<string, Heater | undefined>;
		let worst: { label: string; temp: number; target: number } | null = null;
		for (const [key, label] of [
			...zoneKeys.map((zone) => [zone, 'nozzle'] as const),
			['heater_bed', 'bed'] as const
		]) {
			const temp = record[key]?.temperature;
			const target = record[key]?.target;
			if (temp == null || target == null || target <= 0 || temp >= target - 3) continue;
			if (!worst || temp / target < worst.temp / worst.target) worst = { label, temp, target };
		}
		return worst ? `Heating the ${worst.label}…` : 'Getting ready…';
	};

	const updateStatus = (status: ControlStatus): void => {
		const printStats = status.print_stats;
		const vsd = status.virtual_sdcard;

		const printState = printStats?.state ?? 'standby';
		isPrinting = printState === 'printing';
		isPaused = printState === 'paused';

		const filename = printStats?.filename ?? '';
		if (filename) {
			loadEstimatedTime(filename);
		} else {
			lastFilename = null;
			estimatedTotalSeconds = null;
		}

		const printDuration = printStats?.print_duration ?? 0;
		elapsed = formatClockHM(printDuration, 'down');

		preparing = isPrinting && (printDuration <= 0 || (printStats?.filament_used ?? 0) <= 0);
		if (preparing) prepText = describePreparation(status);

		const prog = vsd?.progress ?? 0;
		progress = Math.round(prog * 100);

		let left: number | null = null;
		if (prog > 0.001 && printDuration > 0) {
			left = printDuration / prog - printDuration;
		} else if (estimatedTotalSeconds && estimatedTotalSeconds > 0) {
			left = Math.max(0, estimatedTotalSeconds - printDuration);
		}
		rawRemaining = left;
		rawEtaAt = left != null ? new Date(Date.now() + left * 1000) : null;
		// Comparsa e scomparsa non aspettano il prossimo giro.
		if ((left == null) !== (remainingSeconds == null)) publishEstimates();

		const fan = status.fan;
		if (fan) {
			fanSpeed = typeof fan.speed === 'number' ? fan.speed : 0;
			fanOn = fanSpeed > 0;
		}

		const led = status['led LED_CAMERA'];
		if (led && Array.isArray(led.color_data) && led.color_data.length > 0) {
			const white = led.color_data[0][3] ?? 0;
			lightValue = typeof white === 'number' ? white : 0;
			lightOn = lightValue > 0;
		}
	};

	// Pausa e stop restano disabilitati finché Kalico non risponde: un secondo
	// tocco durante l'attesa manderebbe PAUSE e poi RESUME.
	let pauseBusy = $state(false);
	let cancelBusy = $state(false);
	let showCancelConfirm = $state(false);

	const handlePauseResume = async (): Promise<void> => {
		if (pauseBusy || !hasActiveJob) return;
		pauseBusy = true;
		try {
			if (isPaused) await sendGcode('RESUME', "Couldn't resume the print");
			else await sendGcode('PAUSE', "Couldn't pause the print");
		} finally {
			pauseBusy = false;
		}
	};

	// Stop annulla una stampa che può durare ore, e il telefono è in mano accanto
	// alla macchina: chiede sempre conferma (l'emergency stop del dock no, apposta).
	const handleCancel = (): void => {
		if (cancelBusy || !hasActiveJob) return;
		showCancelConfirm = true;
	};

	const confirmCancel = async (): Promise<void> => {
		showCancelConfirm = false;
		cancelBusy = true;
		try {
			await sendGcode('CANCEL_PRINT', "Couldn't cancel the print");
		} finally {
			cancelBusy = false;
		}
	};

	const openFanPopup = (): void => {
		fanPopupOpen = true;
	};

	const closeFanPopup = (): void => {
		fanPopupOpen = false;
	};

	const setFanByPercent = (percent: number): void => {
		const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
		const speed01 = safePercent / 100;
		const speed255 = Math.round(speed01 * 255);

		fanSpeed = speed01;
		fanOn = speed01 > 0;
		sendGcode(`M106 S${speed255}`, "Couldn't change the fan speed");
	};

	const openLightPopup = (): void => {
		lightPopupOpen = true;
	};

	const closeLightPopup = (): void => {
		lightPopupOpen = false;
	};

	const setLightByPercent = (percent: number): void => {
		const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
		const white01 = safePercent / 100;

		lightValue = white01;
		lightOn = white01 > 0;
		sendGcode(`SET_LED LED=LED_CAMERA WHITE=${white01.toFixed(2)}`, "Couldn't change the light");
	};

	onMount(() => {
		ensurePrinterTimezone();
		loadNozzleZones().then((zones) => (zoneKeys = zones));
	});

	subscribeWhileVisible<ControlStatus>(dataSource, () => dataQuery, updateStatus);
</script>

<section class="control-panel" aria-label="Print Control">
	<div class="time-row">
		<span class="time-elapsed">Elapsed: {elapsed}</span>
		<span class="time-eta">Done at: <SoftValue value={eta} /></span>
		<span class="time-remaining">Left: <SoftValue value={remaining} /></span>
	</div>
	<div class="progress-bar">
		<div class="progress-track" class:preparing>
			{#if preparing}
				<span class="progress-status" role="status">{prepText}</span>
			{:else}
				<div class="progress-fill" class:started={progress > 0} style="width: {progress}%">
					<span class="progress-percentage">{progress}%</span>
				</div>
			{/if}
		</div>
	</div>
	<div class="controls-row">
		<button class="round-btn" aria-label="Fan" use:tooltip onclick={openFanPopup}>
			<svg viewBox="0 0 36 36" class="circular-progress">
				<circle class="circle-bg" cx="18" cy="18" r="16" />
				<circle class="circle" cx="18" cy="18" r="16" stroke-dasharray={fanDash} />
			</svg>
			<svg viewBox="0 0 24 24" class="round-icon" class:fan-spinning={fanOn} aria-hidden="true"
				><path d={mdiFan} fill="#d72e28" /></svg
			>
		</button>
		<button
			class="square-btn"
			aria-label="Stop print"
			use:tooltip
			onclick={handleCancel}
			disabled={!hasActiveJob || cancelBusy}
		>
			<svg width="26" height="26" viewBox="0 0 18 18" fill="none">
				<rect x="2" y="2" width="14" height="14" rx="2" fill="#d72e28" />
			</svg>
		</button>
		<button
			class="square-btn"
			aria-label={isPaused ? 'Resume print' : 'Pause print'}
			use:tooltip
			onclick={handlePauseResume}
			disabled={!hasActiveJob || pauseBusy}
		>
			{#if isPaused}
				<svg width="26" height="26" viewBox="0 0 18 18" fill="none">
					<polygon points="4,1 17,9 4,17" fill="#d72e28" />
				</svg>
			{:else}
				<svg width="26" height="26" viewBox="0 0 18 18" fill="none">
					<rect x="3" y="1" width="4" height="16" rx="1.5" fill="#d72e28" />
					<rect x="11" y="1" width="4" height="16" rx="1.5" fill="#d72e28" />
				</svg>
			{/if}
		</button>
		<button class="round-btn" aria-label="Light" use:tooltip onclick={openLightPopup}>
			<svg viewBox="0 0 36 36" class="circular-progress">
				<circle class="circle-bg" cx="18" cy="18" r="16" />
				<circle class="circle" cx="18" cy="18" r="16" stroke-dasharray={lightDash} />
			</svg>
			<svg viewBox="0 0 24 24" class="round-icon" aria-hidden="true"
				><path d={lightOn ? mdiLightbulb : mdiLightbulbOff} fill="#d72e28" /></svg
			>
		</button>
	</div>
</section>

<ConfirmModal
	iconPath={mdiStop}
	isOpen={showCancelConfirm}
	title="Stop this print?"
	message="We'll cancel the current print, and there's no way to undo it"
	confirmLabel="Yes, stop it"
	onConfirm={confirmCancel}
	onCancel={() => (showCancelConfirm = false)}
/>

<QuickActionSliderPopup
	isOpen={fanPopupOpen}
	title="Fans"
	ariaLabel="Fan control"
	value={fanSpeed * 100}
	onClose={closeFanPopup}
	onChange={setFanByPercent}
	leftIconPath={mdiFan}
	rightIconPath={mdiFan}
	leftIconSize={18}
	rightIconSize={30}
/>

<QuickActionSliderPopup
	isOpen={lightPopupOpen}
	title="Light"
	ariaLabel="LED light control"
	value={lightValue * 100}
	onClose={closeLightPopup}
	onChange={setLightByPercent}
	leftIconPath={mdiLightbulbOff}
	rightIconPath={mdiLightbulb}
	leftIconSize={18}
	rightIconSize={30}
/>

<style>
	.control-panel {
		background: var(--color-white);
		border-radius: 19.2px;
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		width: 100%;
		box-sizing: border-box;
		box-shadow: var(--shadow-panel);
	}

	.progress-bar {
		width: 100%;
	}

	.progress-track {
		position: relative;
		width: 100%;
		height: 36px;
		border-radius: 18px;
		background: var(--color-divider);
		overflow: hidden;
	}

	/* In preparazione: strisce che scorrono, la scritta al centro. */
	.progress-track.preparing {
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: var(--color-divider);
		background-image: repeating-linear-gradient(
			-45deg,
			rgba(var(--rgb-red), 0.18) 0 12px,
			transparent 12px 24px
		);
		background-size: 34px 34px;
		animation: prep-stripes 1s linear infinite;
	}

	@keyframes prep-stripes {
		to {
			background-position: 34px 0;
		}
	}

	.progress-status {
		padding: 0 14px;
		color: var(--color-text-secondary);
		font-size: 0.9rem;
		font-weight: 700;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	@media (prefers-reduced-motion: reduce) {
		.progress-track.preparing {
			animation: none;
		}
	}

	.progress-fill {
		position: absolute;
		inset: 0 auto 0 0;
		background: var(--color-red);
		border-radius: 18px;
		transition: width 0.3s ease;
		display: flex;
		align-items: center;
		justify-content: flex-end;
	}

	/* Sotto il 3–4% la parte rossa era più stretta del numero, che veniva tagliato: da
	   quando la stampa avanza è larga almeno quanto "99%". */
	.progress-fill.started {
		min-width: 3.75rem;
	}

	.progress-percentage {
		padding-right: 12px;
		color: var(--color-white);
		font-size: 1.1rem;
		font-weight: 700;
		white-space: nowrap;
	}

	.time-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		color: var(--color-text-secondary);
		font-size: 0.95rem;
		font-weight: 600;
		white-space: nowrap;
	}

	/* Sul telefono le tre etichette non starebbero su una riga a 15px. */
	@media (max-width: 479.98px) {
		.time-row {
			gap: 4px;
			font-size: 0.8rem;
		}
	}

	.controls-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 2rem;
		padding: 0 16px;
	}

	.round-btn {
		position: relative;
		flex-shrink: 0;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		border: none;
		background: transparent;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
	}

	.circular-progress {
		width: 48px;
		height: 48px;
		transform: rotate(-90deg);
	}

	.circle-bg {
		stroke: var(--color-text-subtle);
		stroke-width: 4;
		fill: none;
	}

	.circle {
		stroke: var(--color-red);
		stroke-width: 4;
		fill: none;
		stroke-linecap: round;
		transition: stroke-dasharray 0.3s ease;
	}

	/* L'icona sta sopra l'anello, fuori dal suo SVG: prima era un foreignObject dentro
	   l'anello ruotato di -90°, con la lampadina ruotata di +90° per tornare dritta, e
	   Safari su iPhone la disegnava piccola e schiacciata. */
	.round-icon {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 24px;
		height: 24px;
		margin: -12px 0 0 -12px;
	}

	.fan-spinning {
		animation: spin 2s linear infinite;
	}

	.square-btn {
		flex-shrink: 0;
		width: 56px;
		height: 56px;
		border-radius: 12px;
		border: 3px solid var(--color-red);
		background: transparent;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
	}

	.square-btn:hover:not(:disabled) {
		background: var(--color-danger-bg);
	}

	.square-btn:disabled {
		cursor: default;
		opacity: 0.5;
	}

	/* Sotto i ~380px i quattro pulsanti con 2rem di spazio non ci stanno e si schiacciavano. */
	@media (max-width: 767.98px) {
		.controls-row {
			gap: clamp(12px, 6vw, 2rem);
			padding: 0;
		}
	}

	/* Da tablet in su c'è larghezza da vendere e poca altezza: tempi e barra a sinistra, pulsanti
	   a destra, su una riga sola. Restituisce ai pannelli sopra ~70px, che su un portatile sono
	   un quinto dell'altezza utile. In fondo: vince sulle regole base a parità di specificità. */
	@media (min-width: 768px) {
		.control-panel {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			grid-template-areas:
				'time controls'
				'bar controls';
			column-gap: 24px;
			row-gap: 10px;
			padding: 16px 20px;
		}

		.time-row {
			grid-area: time;
		}

		.progress-bar {
			grid-area: bar;
		}

		.controls-row {
			grid-area: controls;
			gap: 1.25rem;
			padding: 0;
		}
	}
</style>
