<script lang="ts">
	import { RefreshCw, WifiOff } from 'lucide-svelte';
	import { fade, scale } from 'svelte/transition';
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
	 * schermata sparisce appena la stampante risponde. L'onda attorno all'icona
	 * dice proprio questo — si sta cercando — senza numeri da leggere. Il pulsante
	 * "Try now" è solo per non aspettare il prossimo tentativo, quando si sa di
	 * averla appena riaccesa.
	 */

	let visible = $derived(!$printerOnline);

	/** `true` mentre un tentativo è già in corso: premere di nuovo non aggiunge niente. */
	let checking = $derived($nextRetryAt === null);

	function retry() {
		if (!checking) retryPrinterConnection();
	}
</script>

{#if visible}
	<div
		class="printer-offline"
		role="alertdialog"
		aria-modal="true"
		aria-labelledby="printer-offline-title"
		aria-describedby="printer-offline-message"
		transition:fade={{ duration: 200 }}
	>
		<div class="card" in:scale={{ start: 0.96, duration: 220 }}>
			<span class="badge" aria-hidden="true">
				<span class="wave"></span>
				<span class="wave late"></span>
				<WifiOff size={30} strokeWidth={2.2} />
			</span>

			<h2 id="printer-offline-title" class="sheet-title">Printer offline</h2>
			<p id="printer-offline-message" class="message">
				We can't reach the printer. It may be switched off, still starting up, or not on this
				network.
			</p>
			<p class="hint">This page reconnects by itself as soon as the printer is back.</p>

			<!-- Mai `disabled` durante un tentativo: i tentativi partono ogni pochi
			     secondi e il pulsante lampeggerebbe. Per lo stesso motivo il testo resta
			     fisso: gira solo l'icona, e il clic non fa niente. -->
			<button type="button" class="btn btn-primary" aria-busy={checking} onclick={retry}>
				<span class="spin" class:active={checking}><RefreshCw size={18} strokeWidth={2.4} /></span>
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
		background: rgba(var(--rgb-gray-dark), 0.35);
		backdrop-filter: blur(16px) saturate(110%);
		-webkit-backdrop-filter: blur(16px) saturate(110%);
	}

	.card {
		width: 100%;
		max-width: 380px;
		max-height: 100%;
		overflow-y: auto;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 32px 24px 24px;
		border-radius: 20px;
		background: var(--color-white);
		box-shadow:
			0 24px 48px rgba(var(--rgb-black), 0.18),
			0 2px 6px rgba(var(--rgb-black), 0.08);
	}

	/* Il badge dei dialoghi (ConfirmModal), in grigio: non è un errore da
	   correggere, è un'assenza da aspettare. */
	.badge {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 72px;
		height: 72px;
		margin-bottom: 20px;
		border-radius: 50%;
		background: var(--color-surface-sunken);
		color: var(--color-text-muted);
	}

	/* Due onde sfasate che si allargano e svaniscono: "sto cercando". */
	.wave {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		border: 2px solid var(--color-gray);
		animation: wave 2.4s ease-out infinite;
		pointer-events: none;
	}

	.wave.late {
		animation-delay: 1.2s;
	}

	@keyframes wave {
		from {
			transform: scale(1);
			opacity: 0.9;
		}
		to {
			transform: scale(1.7);
			opacity: 0;
		}
	}

	.message {
		margin: 8px 0 0;
		font-size: 0.95rem;
		line-height: 1.45;
		color: var(--color-text-muted);
	}

	.hint {
		margin: 12px 0 0;
		font-size: 0.85rem;
		line-height: 1.45;
		color: var(--color-text-soft);
	}

	.btn {
		width: 100%;
		margin-top: 24px;
	}

	.btn[aria-busy='true'] {
		cursor: default;
	}

	.spin {
		display: inline-flex;
	}

	.spin.active {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.wave,
		.spin.active {
			animation: none;
		}

		.wave {
			opacity: 0;
		}
	}
</style>
