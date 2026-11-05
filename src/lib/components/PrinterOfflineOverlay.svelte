<script lang="ts">
	import { mdiLanDisconnect } from '@mdi/js';
	import {
		nextRetryAt,
		printerOnline,
		retryPrinterConnection
	} from '$lib/services/moonraker-notifier';

	/**
	 * Schermata **bloccante** per la stampante irraggiungibile: spenta, in riavvio
	 * o fuori dalla rete.
	 *
	 * A differenza di `KlipperDownOverlay` copre tutto, dock e Settings compresi:
	 * lì una via d'uscita c'è (il riavvio del firmware, i log), qui no — ogni
	 * pagina e ogni pulsante parlano con Moonraker, e Moonraker non c'è. Lasciare
	 * scoperto qualcosa vorrebbe dire lasciare un comando che non fa niente.
	 *
	 * Non serve fare niente per toglierla: il notifier ritenta da solo e la
	 * schermata sparisce appena la stampante risponde. Il pulsante "Try now" è
	 * solo per non aspettare il prossimo tentativo, quando si sa di averla appena
	 * riaccesa.
	 */

	let visible = $derived(!$printerOnline);

	/** `true` mentre un tentativo è già in corso: premere di nuovo non aggiunge niente. */
	let checking = $derived($nextRetryAt === null);
</script>

{#if visible}
	<div
		class="printer-offline"
		role="alertdialog"
		aria-modal="true"
		aria-labelledby="printer-offline-title"
		aria-describedby="printer-offline-message"
	>
		<div class="card">
			<svg class="icon" viewBox="0 0 24 24" width="48" height="48" aria-hidden="true">
				<path d={mdiLanDisconnect} fill="currentColor" />
			</svg>
			<h2 id="printer-offline-title">Printer offline</h2>
			<p id="printer-offline-message" class="message">
				We can't reach the printer. It may be switched off, still starting up, or not on this
				network.
			</p>
			<p class="hint">This page reconnects by itself as soon as the printer is back.</p>

			<button
				type="button"
				class="btn-primary"
				onclick={retryPrinterConnection}
				disabled={checking}
			>
				Try now
			</button>
		</div>
	</div>
{/if}

<style>
	.printer-offline {
		position: fixed;
		inset: 0;
		/* Sopra tutto, toast compresi (10000): con la stampante assente nessun
		   avviso a schermo è più vero di questo. */
		z-index: 10100;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px 16px;
		box-sizing: border-box;
		background: linear-gradient(
			135deg,
			rgba(var(--rgb-gray-mid), 0.45),
			rgba(var(--rgb-gray-mid), 0.35)
		);
		backdrop-filter: blur(14px) saturate(120%);
		-webkit-backdrop-filter: blur(14px) saturate(120%);
	}

	.card {
		background: var(--color-white);
		border-radius: 16px;
		padding: 24px;
		width: 100%;
		max-width: 420px;
		max-height: 100%;
		overflow-y: auto;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		box-shadow: var(--shadow-panel);
	}

	.icon {
		margin-bottom: 8px;
		color: var(--color-text-muted);
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

	.hint {
		margin: 0 0 16px;
		font-size: 0.85rem;
		line-height: 1.5;
		color: var(--color-text-soft);
		text-align: center;
	}

	.btn-primary {
		min-width: 140px;
	}
</style>
