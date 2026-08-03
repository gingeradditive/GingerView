<script lang="ts">
	import { onMount } from 'svelte';
	import { mdiLightbulb, mdiLightbulbOff, mdiFan } from '@mdi/js';
	import { getMoonrakerApiUrl } from '$lib/services/config';
	import QuickActionSliderPopup from '$lib/components/QuickActionSliderPopup.svelte';

	const pollIntervalMs = 2000;
	const circumference = 2 * Math.PI * 16;

	let elapsed = $state('--:--:--');
	let remaining = $state('--:--:--');
	let eta = $state('--:--');
	let progress = $state(0);
	let isPrinting = $state(false);
	let isPaused = $state(false);

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

	const formatDuration = (seconds: number): string => {
		if (!seconds || seconds < 0) return '--:--:--';
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = Math.floor(seconds % 60);
		return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
	};

	const formatTime = (date: Date): string => {
		return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
	};

	const sendGcode = async (gcode: string): Promise<void> => {
		try {
			await fetch(
				`${getMoonrakerApiUrl()}/printer/gcode/script?script=${encodeURIComponent(gcode)}`,
				{ method: 'POST' }
			);
		} catch {
			// ignore
		}
	};

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

	const updateStatus = async (): Promise<void> => {
		try {
			const response = await fetch(
				`${getMoonrakerApiUrl()}/printer/objects/query?print_stats&virtual_sdcard&fan&led LED_CAMERA`
			);
			if (!response.ok) return;

			const payload = await response.json();
			const status = payload?.result?.status;
			if (!status) return;

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
			elapsed = formatDuration(printDuration);

			const prog = vsd?.progress ?? 0;
			progress = Math.round(prog * 100);

			if (prog > 0.001 && printDuration > 0) {
				const totalEstimated = printDuration / prog;
				const remainingSeconds = totalEstimated - printDuration;
				remaining = formatDuration(remainingSeconds);
				eta = formatTime(new Date(Date.now() + remainingSeconds * 1000));
			} else if (estimatedTotalSeconds && estimatedTotalSeconds > 0) {
				const remainingSeconds = Math.max(0, estimatedTotalSeconds - printDuration);
				remaining = formatDuration(remainingSeconds);
				eta = formatTime(new Date(Date.now() + remainingSeconds * 1000));
			} else {
				remaining = '--:--:--';
				eta = '--:--';
			}

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
		} catch {
			return;
		}
	};

	const handlePauseResume = (): void => {
		if (isPaused) {
			sendGcode('RESUME');
		} else if (isPrinting) {
			sendGcode('PAUSE');
		}
	};

	const handleCancel = (): void => {
		if (isPrinting || isPaused) {
			sendGcode('CANCEL_PRINT');
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
		sendGcode(`M106 S${speed255}`);
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
		sendGcode(`SET_LED LED=LED_CAMERA WHITE=${white01.toFixed(2)}`);
	};

	onMount(() => {
		updateStatus();
		const interval = window.setInterval(updateStatus, pollIntervalMs);
		return () => window.clearInterval(interval);
	});
</script>

<section class="control-panel" aria-label="Print Control">
	<div class="time-row">
		<span class="time-elapsed">{elapsed}</span>
		<span class="time-eta">ETA: {eta}</span>
		<span class="time-remaining">{remaining}</span>
	</div>
	<div class="progress-bar">
		<div class="progress-track">
			<div class="progress-fill" style="width: {progress}%">
				<span class="progress-percentage">{progress}%</span>
			</div>
		</div>
	</div>
	<div class="controls-row">
		<button class="round-btn" aria-label="Fan" onclick={openFanPopup}>
			<svg viewBox="0 0 36 36" class="circular-progress">
				<circle class="circle-bg" cx="18" cy="18" r="16" />
				<circle class="circle" cx="18" cy="18" r="16" stroke-dasharray={fanDash} />
				<foreignObject x="6" y="6" width="24" height="24">
					<div class="icon-center">
						<svg viewBox="0 0 24 24" width="18" height="18" class={fanOn ? 'fan-spinning' : ''}
							><path d={mdiFan} fill="#d72e28" /></svg
						>
					</div>
				</foreignObject>
			</svg>
		</button>
		<button class="square-btn" aria-label="Stop" onclick={handleCancel}>
			<svg width="26" height="26" viewBox="0 0 18 18" fill="none">
				<rect x="2" y="2" width="14" height="14" rx="2" fill="#d72e28" />
			</svg>
		</button>
		<button
			class="square-btn"
			aria-label={isPaused ? 'Resume' : 'Pause'}
			onclick={handlePauseResume}
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
		<button class="round-btn" aria-label="Light" onclick={openLightPopup}>
			<svg viewBox="0 0 36 36" class="circular-progress">
				<circle class="circle-bg" cx="18" cy="18" r="16" />
				<circle class="circle" cx="18" cy="18" r="16" stroke-dasharray={lightDash} />
				<foreignObject x="6" y="6" width="24" height="24">
					<div class="icon-center">
						<svg viewBox="0 0 24 24" width="18" height="18" style="transform: rotate(90deg);"
							><path d={lightOn ? mdiLightbulb : mdiLightbulbOff} fill="#d72e28" /></svg
						>
					</div>
				</foreignObject>
			</svg>
		</button>
	</div>
</section>

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
		color: var(--color-text-secondary);
		font-size: 0.95rem;
		font-weight: 600;
	}

	.controls-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 2rem;
		padding: 0 16px;
	}

	.round-btn {
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

	.icon-center {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
	}

	.fan-spinning {
		animation: spin 2s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.square-btn {
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

	.square-btn:hover {
		background: var(--color-danger-bg);
	}
</style>
