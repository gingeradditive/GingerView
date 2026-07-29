<script lang="ts">
	import { onMount } from 'svelte';
	import { mdiLightbulb, mdiLightbulbOff, mdiFan } from '@mdi/js';
	import { getMoonrakerApiUrl } from '$lib/services/config';
	import QuickActionSliderPopup from '$lib/components/QuickActionSliderPopup.svelte';

	const pollIntervalMs = 2000;
	const circumference = 2 * Math.PI * 16;

	let fanSpeed = $state(0);
	let lightValue = $state(0);
	let fanOn = $state(false);
	let lightOn = $state(false);
	let fanPopupOpen = $state(false);
	let lightPopupOpen = $state(false);

	let fanDash = $derived(`${fanSpeed * circumference} ${circumference}`);
	let lightDash = $derived(`${lightValue * circumference} ${circumference}`);

	const sendGcode = async (gcode: string): Promise<void> => {
		try {
			await fetch(`${getMoonrakerApiUrl()}/printer/gcode/script?script=${encodeURIComponent(gcode)}`, { method: 'POST' });
		} catch {
			// ignore
		}
	};

	const updateStatus = async (): Promise<void> => {
		try {
			const response = await fetch(`${getMoonrakerApiUrl()}/printer/objects/query?fan&led LED_CAMERA`);
			if (!response.ok) return;

			const payload = await response.json();
			const status = payload?.result?.status;
			if (!status) return;

			const fan = status.fan;
			if (fan) {
				fanSpeed = typeof fan.speed === 'number' ? fan.speed : 0;
				fanOn = fanSpeed > 0;
			}

			const led = status['led LED_CAMERA'];
			if (led && Array.isArray(led.color_data) && led.color_data.length > 0) {
				// color_data is [[r, g, b, w]] — white channel is index 3
				const white = led.color_data[0][3] ?? 0;
				lightValue = typeof white === 'number' ? white : 0;
				lightOn = lightValue > 0;
			}
		} catch {
			return;
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

<section class="quick-actions-panel" aria-label="Quick Actions">
	<div class="action-subpanel">
		<button class="action-btn" aria-label="Fan" onclick={openFanPopup}>
			<svg viewBox="0 0 36 36" class="circular-progress">
				<circle class="circle-bg" cx="18" cy="18" r="16" />
				<circle class="circle" cx="18" cy="18" r="16" stroke-dasharray={fanDash} />
				<foreignObject x="6" y="6" width="24" height="24">
					<div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">
						<svg viewBox="0 0 24 24" width="20" height="20" class={fanOn ? 'fan-spinning' : ''}><path d={mdiFan} fill="#d72e28" /></svg>
					</div>
				</foreignObject>
			</svg>
		</button>
	</div>
	<div class="action-subpanel">
		<button class="action-btn" aria-label="Light" onclick={openLightPopup}>
			<svg viewBox="0 0 36 36" class="circular-progress">
				<circle class="circle-bg" cx="18" cy="18" r="16" />
				<circle class="circle" cx="18" cy="18" r="16" stroke-dasharray={lightDash} />
				<foreignObject x="6" y="6" width="24" height="24">
					<div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">
						<svg viewBox="0 0 24 24" width="20" height="20" style="transform: rotate(90deg);"><path d={lightOn ? mdiLightbulb : mdiLightbulbOff} fill="#d72e28" /></svg>
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
	.quick-actions-panel {
		background: transparent;
		border-radius: 16px;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 20px;
		align-items: stretch;
		justify-content: center;
		height: 100%;
		box-sizing: border-box;
	}

	.action-subpanel {
		background: #ffffff;
		border-radius: 12px;
		padding: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		box-sizing: border-box;
		box-shadow: 0px 4px 3px 0px #00000040;
	}

	.action-btn {
		width: 56px;
		height: 56px;
		border-radius: 12px;
		border: none;
		background: #ffffff;
		color: #d72e28;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.action-btn:focus-visible {
		outline: 2px solid #d72e28;
		outline-offset: 2px;
	}

	.action-btn svg {
		stroke: #d72e28;
	}

	.circular-progress {
		width: 48px;
		height: 48px;
		transform: rotate(-90deg);
	}

	.circle-bg {
		stroke: #828282;
		stroke-width: 4;
		fill: none;
	}

	.circle {
		stroke: #d72e28;
		stroke-width: 4;
		fill: none;
		stroke-linecap: round;
		transition: stroke-dasharray 0.3s ease;
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
</style>
