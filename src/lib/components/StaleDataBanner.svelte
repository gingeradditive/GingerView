<script lang="ts">
	import { mdiCloudOffOutline } from '@mdi/js';
	import { dataStale, staleSince } from '$lib/services/moonraker-subscription';
	import { isKlippyDown, klippyState } from '$lib/services/moonraker-notifier';

	/**
	 * Avviso di **dati non aggiornati**: la stampante ha smesso di rispondere al
	 * polling e quello che resta a schermo è l'ultima lettura riuscita.
	 *
	 * Non copre niente e non si chiude. I numeri restano visibili — spesso sono
	 * ancora l'informazione più utile che c'è — ma smettono di spacciarsi per
	 * attuali, ed è tutto quello che serve dire: nessun pulsante di ritentativo,
	 * perché il polling ritenta già da solo e riparte appena la macchina risponde.
	 *
	 * Non compare quando Kalico è fermo: lì le query falliscono per un motivo che
	 * `KlipperDownOverlay` spiega già, per esteso e con la via d'uscita. Due avvisi
	 * per lo stesso guasto sono uno di troppo.
	 */

	let now = $state(Date.now());
	let visible = $derived($dataStale && !isKlippyDown($klippyState));

	// Il contatore gira solo mentre l'avviso è a schermo: fuori non c'è niente da
	// aggiornare, e in un'applicazione che resta aperta per ore un tick al secondo
	// sempre attivo è spreco puro.
	$effect(() => {
		if (!visible) return;
		now = Date.now();
		const ticker = window.setInterval(() => (now = Date.now()), 1000);
		return () => window.clearInterval(ticker);
	});

	/** "12s", "3m", "1h 04m": abbastanza per capire se è un blip o un guasto. */
	function formatElapsed(ms: number): string {
		const seconds = Math.max(0, Math.floor(ms / 1000));
		if (seconds < 60) return `${seconds}s`;
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes}m`;
		const hours = Math.floor(minutes / 60);
		return `${hours}h ${(minutes % 60).toString().padStart(2, '0')}m`;
	}

	let elapsed = $derived($staleSince === null ? '' : formatElapsed(now - $staleSince));
</script>

{#if visible}
	<div class="stale-banner" role="status" aria-live="polite">
		<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
			<path d={mdiCloudOffOutline} fill="currentColor" />
		</svg>
		<span class="text">
			<strong>Data not updating</strong>
			<span class="detail"
				>the printer stopped answering — showing the last reading ({elapsed})</span
			>
		</span>
	</div>
{/if}

<style>
	.stale-banner {
		position: fixed;
		top: 12px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 2800;
		max-width: calc(100vw - 24px);
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 16px;
		border-radius: 999px;
		background: var(--color-warning-bg);
		border: 1px solid var(--color-warning-border);
		color: var(--color-warning);
		box-shadow: var(--shadow-float);
		pointer-events: none;
	}

	.text {
		display: flex;
		align-items: baseline;
		gap: 8px;
		min-width: 0;
	}

	strong {
		font-size: 0.9rem;
		font-weight: 700;
		white-space: nowrap;
	}

	.detail {
		font-size: 0.82rem;
		color: var(--color-text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Sul telefono la riga di dettaglio non ci sta accanto al titolo: va sotto,
	   e la pillola diventa un rettangolo arrotondato. */
	@media (max-width: 767.98px) {
		.stale-banner {
			border-radius: 14px;
			padding: 8px 14px;
		}

		.text {
			flex-direction: column;
			align-items: flex-start;
			gap: 2px;
		}

		.detail {
			white-space: normal;
		}
	}
</style>
