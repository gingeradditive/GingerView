import { writable } from 'svelte/store';
import { fetchTimezoneStatus } from '$lib/services/timezone';

/**
 * Fuso orario della **stampante**, condiviso da tutto quello che mostra un orario.
 *
 * Gli orari che GingerView scrive (ETA, ora di reset del rate limit, timestamp
 * della console) sono istanti assoluti: l'unica scelta è in quale fuso scriverli.
 * Vanno scritti in quello della macchina, non in quello del browser — l'ETA
 * risponde a "a che ora la trovo finita", e chi guarda da un telefono in un
 * altro fuso vuole comunque l'ora dell'orologio della stampante, quello che vede
 * il pezzo uscire. Così `/settings/timezone` diventa l'unico posto che decide
 * come si leggono gli orari, invece di essere una pagina senza effetti.
 *
 * `null` significa "non ancora noto": chi formatta ripiega sul fuso del browser,
 * che sul kiosk della macchina è lo stesso e altrove è comunque meglio di niente.
 * Le durate (tempo trascorso, tempo residuo) non passano di qui: sono differenze,
 * e un fuso non le cambia.
 */
export const printerTimezone = writable<string | null>(null);

/** La prima chiamata in volo, per non fare una GET per componente montato. */
let inFlight: Promise<void> | null = null;
let loaded = false;

/**
 * Carica il fuso della stampante una volta sola per sessione.
 *
 * Chiamabile da ogni componente che mostra un orario, senza coordinamento: le
 * chiamate concorrenti condividono la stessa promise, e quelle successive al
 * primo successo non fanno nulla. Un fallimento non viene propagato — l'orario
 * resta quello del browser e nessuna pagina deve gestire l'errore — ma non viene
 * memorizzato, così il prossimo montaggio riprova.
 */
export function ensurePrinterTimezone(): Promise<void> {
	if (loaded) return Promise.resolve();
	if (!inFlight) {
		inFlight = fetchTimezoneStatus()
			.then((status) => {
				printerTimezone.set(status.timezone);
				loaded = true;
			})
			.catch(() => {
				// Il fuso resta null: si formatta nel fuso del browser.
			})
			.finally(() => {
				inFlight = null;
			});
	}
	return inFlight;
}

/**
 * Il fuso appena letto o salvato da `/settings/timezone`.
 *
 * Serve perché il cambio si veda subito sugli orari già a schermo, senza
 * aspettare un ricaricamento della pagina.
 */
export function setPrinterTimezone(id: string): void {
	printerTimezone.set(id);
	loaded = true;
}
