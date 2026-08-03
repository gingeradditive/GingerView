<script lang="ts">
	import { mdiHandBackRight, mdiRestart } from '@mdi/js';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import { klippyState, type KlippyState } from '$lib/services/moonraker-notifier';
	import {
		emergencyStop,
		requestRestart,
		waitForKlipperReady
	} from '$lib/services/moonraker-printer';
	import { toastActions } from '$lib/stores/toastStore';

	/**
	 * The dock's red button, and the way back from what it does.
	 *
	 * One button, two jobs, because they are the two ends of the same action: an
	 * emergency stop leaves Kalico in `shutdown`, and the only thing that brings it
	 * back is a firmware restart. So while the printer is running the button stops
	 * it; once it is stopped, the same button offers the reset.
	 *
	 * The stop fires **without a confirmation** — it is what Mainsail does, and a
	 * dialog in front of an emergency stop defeats the button. The reset does ask,
	 * because it re-enables heaters and steppers on a machine somebody stopped on
	 * purpose.
	 */

	/**
	 * `shutdown` and `error` mean Klippy is alive but halted, which is exactly what
	 * `/printer/firmware_restart` recovers. `disconnected` is a different problem —
	 * the host process is gone and Moonraker would refuse the call — so the button
	 * stays a stop button there rather than offering a reset that cannot work.
	 */
	const haltedStates: KlippyState[] = ['shutdown', 'error'];

	let busy = $state(false);
	let confirmOpen = $state(false);

	let isHalted = $derived(haltedStates.includes($klippyState));
	let label = $derived(isHalted ? 'Firmware restart' : 'Emergency stop');

	async function handleClick() {
		if (busy) return;
		if (isHalted) {
			confirmOpen = true;
			return;
		}
		await stopNow();
	}

	async function stopNow() {
		busy = true;
		try {
			await emergencyStop();
			// The notifier will say the same thing over the WebSocket, but the button
			// has to flip now: whoever pressed it is looking at it.
			klippyState.set('shutdown');
			toastActions.warning(
				'klipper',
				'Emergency stop sent',
				'Kalico is shut down. Press the button again to run a firmware restart when the machine is safe.'
			);
		} catch {
			// The service already raised a persistent error toast.
		} finally {
			busy = false;
		}
	}

	/**
	 * No "is a print running?" guard here, unlike the config editor: this only
	 * shows up once Kalico is already halted, so there is no job left to abort.
	 */
	async function resetNow() {
		confirmOpen = false;
		busy = true;
		toastActions.info('klipper', 'Firmware restart', 'Restarting Kalico and the MCUs…');

		await requestRestart('firmware');
		const info = await waitForKlipperReady();

		if (!info) {
			toastActions.error(
				'klipper',
				'Firmware restart',
				'Kalico did not come back within 90 seconds. Check the machine.',
				0
			);
		} else if (info.state === 'ready') {
			klippyState.set('ready');
			toastActions.success('klipper', 'Kalico ready', 'Firmware restart complete.');
		} else {
			klippyState.set(info.state as KlippyState);
			const firstLine = info.stateMessage.split('\n')[0] || `Kalico is in ${info.state} state`;
			toastActions.error('klipper', `Kalico ${info.state}`, firstLine, 0, info.stateMessage);
		}

		busy = false;
	}
</script>

<button
	type="button"
	class="estop"
	class:halted={isHalted}
	class:busy
	disabled={busy}
	aria-label={label}
	aria-busy={busy}
	title={label}
	onclick={handleClick}
>
	<svg viewBox="0 0 24 24" aria-hidden="true">
		<path d={isHalted ? mdiRestart : mdiHandBackRight} />
	</svg>
</button>

<ConfirmModal
	isOpen={confirmOpen}
	title="Firmware restart?"
	message="This restarts Kalico and the MCUs to bring the printer out of shutdown."
	details="Make sure the machine is safe first: heaters and steppers go back under Kalico's control."
	confirmLabel="Restart"
	onConfirm={resetNow}
	onCancel={() => (confirmOpen = false)}
/>

<style>
	.estop {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 52.8px;
		height: 52.8px;
		/* Separated from Settings the same way Settings is separated from the
		   navigation group: this is not one more place to go. */
		margin-left: 19.2px;
		padding: 0;
		border: 3px solid transparent;
		border-radius: 14.4px;
		background: #d72e28;
		color: #ffffff;
		cursor: pointer;
	}

	.estop svg {
		width: 32px;
		height: 32px;
		fill: currentColor;
	}

	.estop:hover:not(:disabled) {
		background: #b82520;
	}

	.estop:focus-visible {
		outline: 2px solid #d72e28;
		outline-offset: 2px;
	}

	.estop:disabled {
		cursor: default;
		opacity: 0.6;
	}

	/* Recovery state: inverted, so a stopped machine does not look like a machine
	   you can still stop. */
	.estop.halted {
		background: #ffffff;
		border-color: #d72e28;
		color: #d72e28;
	}

	.estop.halted:not(.busy) {
		animation: estop-pulse 1.6s ease-in-out infinite;
	}

	.estop.halted:hover:not(:disabled) {
		background: #fdecec;
	}

	/* Only the restart icon spins — a restart is the one action that takes time. */
	.estop.halted.busy svg {
		animation: estop-spin 1s linear infinite;
	}

	@keyframes estop-pulse {
		0%,
		100% {
			box-shadow: 0 0 0 0 rgba(215, 46, 40, 0.45);
		}
		50% {
			box-shadow: 0 0 0 6px rgba(215, 46, 40, 0);
		}
	}

	@keyframes estop-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.estop.halted:not(.busy),
		.estop.halted.busy svg {
			animation: none;
		}
	}
</style>
