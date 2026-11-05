<script lang="ts">
	import { mdiLanDisconnect } from '@mdi/js';
	import {
		nextRetryAt,
		offlineSince,
		printerOnline,
		retryPrinterConnection
	} from '$lib/services/moonraker-notifier';
	import { formatElapsed } from '$lib/utils/format';

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

	let now = $state(Date.now());
	let visible = $derived(!$printerOnline);

	// Il contatore gira solo mentre la schermata è su: per ore di sessione normale
	// non c'è niente da aggiornare.
	$effect(() => {
		if (!visible) return;
		now = Date.now();
		const ticker = window.setInterval(() => (now = Date.now()), 1000);
		return () => window.clearInterval(ticker);
	});

	// Un nuovo tentativo pianificato riallinea l'orologio: senza, il conto alla
	// rovescia partirebbe da un `now` vecchio fino a un secondo.
	$effect(() => {
		if ($nextRetryAt !== null) now = Date.now();
	});

	let elapsed = $derived($offlineSince === null ? '' : formatElapsed(now - $offlineSince));

	/** Secondi al prossimo tentativo, `null` mentre un tentativo è in corso. */
	let retryIn = $derived(
		$nextRetryAt === null ? null : Math.max(0, Math.ceil(($nextRetryAt - now) / 1000))
	);
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
			<p class="hint">
				This page reconnects by itself as soon as the printer is back. If a print was running and
				only the network dropped, it carries on — the printer doesn't need this page.
			</p>

			<div class="status" aria-live="polite">
				<span class="dot" class:checking={retryIn === null || retryIn === 0} aria-hidden="true"
				></span>
				{#if retryIn === null || retryIn === 0}
					Checking…
				{:else}
					Trying again in {retryIn}s
				{/if}
				{#if elapsed}
					<span class="elapsed">· offline for {elapsed}</span>
				{/if}
			</div>

			<button
				type="button"
				class="btn-primary"
				onclick={retryPrinterConnection}
				disabled={retryIn === null}
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

	.status {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		justify-content: center;
		gap: 6px;
		margin-bottom: 16px;
		font-size: 0.85rem;
		color: var(--color-text-muted);
		font-variant-numeric: tabular-nums;
	}

	.elapsed {
		color: var(--color-text-soft);
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-text-soft);
	}

	.dot.checking {
		animation: pulse 1s ease-in-out infinite;
	}

	@keyframes pulse {
		50% {
			opacity: 0.25;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.dot.checking {
			animation: none;
		}
	}

	.btn-primary {
		min-width: 140px;
	}
</style>
