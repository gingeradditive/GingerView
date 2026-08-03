<script lang="ts">
	import { page } from '$app/stores';
	import { mdiAlertOctagon } from '@mdi/js';
	import {
		isKlippyDown,
		klippyMessage,
		klippyState,
		type KlippyState
	} from '$lib/services/moonraker-notifier';

	/**
	 * Full-screen warning shown on the operating pages while Kalico is down.
	 *
	 * It is deliberately **not dismissible**: on the dashboard, the file list and
	 * the movement page every control is a lie while the firmware is halted —
	 * readings are frozen, buttons do nothing. Covering them is the honest state.
	 *
	 * What it must not cover is the way out. Two things stay reachable:
	 *
	 * - **the dock**, geometrically — the overlay stops above it, so the emergency
	 *   stop button (which turns into the firmware restart) and the navigation
	 *   never sit under it, whatever the stacking order ends up being;
	 * - **Settings and its subpages**, by route — Log, Update and Console are
	 *   exactly where somebody goes to find out why Kalico stopped, so the overlay
	 *   never appears there.
	 */

	interface Copy {
		title: string;
		message: string;
		hint: string;
	}

	function copyFor(state: KlippyState): Copy {
		if (state === 'disconnected') {
			return {
				title: 'Kalico is not running',
				message:
					'Moonraker cannot reach the Kalico host process, so the printer cannot be controlled from here.',
				hint: 'Settings stays available — Log and Update still work. If the machine was just powered on, give it a few seconds.'
			};
		}
		if (state === 'error') {
			return {
				title: 'Kalico stopped with an error',
				message:
					'The printer firmware is halted. Nothing moves, nothing heats and no job can start until it is restarted.',
				hint: 'Press the red button in the dock to run a firmware restart, or open Settings → Log for the full error.'
			};
		}
		return {
			title: 'Kalico is shut down',
			message:
				'The printer firmware has stopped. Nothing moves, nothing heats and no job can start until it is restarted.',
			hint: 'Press the red button in the dock to run a firmware restart, once the machine is safe.'
		};
	}

	/** Settings and every subpage under it are exempt. */
	let onOperatingPage = $derived(!$page.url.pathname.startsWith('/settings'));
	let visible = $derived(onOperatingPage && isKlippyDown($klippyState));
	let copy = $derived(copyFor($klippyState));
</script>

{#if visible}
	<div class="klippy-down" role="alert" aria-live="assertive">
		<div class="card">
			<svg class="icon" viewBox="0 0 24 24" width="48" height="48" aria-hidden="true">
				<path d={mdiAlertOctagon} fill="#D72E28" />
			</svg>
			<h2>{copy.title}</h2>
			<p class="message">{copy.message}</p>
			{#if $klippyMessage}
				<pre class="reason">{$klippyMessage}</pre>
			{/if}
			<p class="hint">{copy.hint}</p>
		</div>
	</div>
{/if}

<style>
	.klippy-down {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		/* Clears the dock (88px tall from the bottom edge) instead of relying on
		   z-index alone: the navigation and the emergency stop stay clickable. */
		bottom: 96px;
		z-index: 2900;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
		box-sizing: border-box;
		background: linear-gradient(
			135deg,
			rgba(var(--rgb-gray-mid), 0.3),
			rgba(var(--rgb-gray-mid), 0.22)
		);
		backdrop-filter: blur(12px) saturate(130%);
		-webkit-backdrop-filter: blur(12px) saturate(130%);
	}

	.card {
		background: var(--color-white);
		border-radius: 16px;
		padding: 24px;
		min-width: 300px;
		max-width: 420px;
		max-height: 100%;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		box-shadow: var(--shadow-panel);
	}

	.icon {
		margin-bottom: 8px;
	}

	h2 {
		margin: 0 0 12px;
		font-size: 1.15rem;
		font-weight: 700;
		color: var(--color-black);
		text-align: center;
	}

	.message {
		margin: 0 0 12px;
		font-size: 0.95rem;
		color: var(--color-text-muted);
		text-align: center;
	}

	/* Klipper's own shutdown reason: the one line that explains what happened. */
	.reason {
		margin: 0 0 12px;
		width: 100%;
		max-height: 140px;
		overflow: auto;
		box-sizing: border-box;
		padding: 10px 14px;
		border-radius: 8px;
		background: var(--color-background);
		color: var(--color-text-soft);
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.78rem;
		line-height: 1.4;
		text-align: left;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.hint {
		margin: 0;
		font-size: 0.85rem;
		color: var(--color-text-soft);
		text-align: center;
	}
</style>
