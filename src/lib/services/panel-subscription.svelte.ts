import { untrack } from 'svelte';
import { subscribePrinterObjects, type PrinterStatus } from './moonraker-subscription';

/**
 * L'iscrizione allo stato di un pannello, attiva solo quando il pannello si vede.
 *
 * I pannelli dei caroselli restano montati anche quando sono fuori dalla viewport:
 * Embla tiene tutte le slide nel DOM e si limita a traslarle. Senza questo modulo
 * ogni pannello resterebbe iscritto anche mentre nessuno lo guarda, e siccome la
 * sottoscrizione è l'unione di tutti i pannelli attivi (vedi
 * `moonraker-subscription.ts`) la macchina continuerebbe a mandare oggetti che
 * nessuno disegna.
 *
 * La visibilità la decide chi rende il pannello (il carosello, tramite
 * `slidesInView()`); i pannelli usati fuori da un carosello non passano niente e
 * restano sempre iscritti.
 */

/**
 * Iscrive il pannello finché `isVisible()` è vero, e lo disiscrive quando esce.
 *
 * Da invocare nell'inizializzazione del componente: internamente è un `$effect`,
 * quindi l'iscrizione parte al montaggio e riparte quando il pannello rientra —
 * con lo stato già in cache consegnato subito, così i numeri non restano vecchi.
 *
 * `query` è una funzione e non una stringa perché non tutti i pannelli sanno da
 * subito cosa chiedere: il pannello temperature scopre le zone dell'ugello dalla
 * macchina, e quando arriva la risposta la sua query cambia. Rileggerla dentro
 * l'effetto significa che l'iscrizione si rifà da sola.
 */
export function subscribeWhileVisible<T = PrinterStatus>(
	source: string,
	query: () => string,
	onStatus: (status: T) => void,
	isVisible: () => boolean = () => true
): void {
	$effect(() => {
		if (!isVisible()) return;
		const currentQuery = query();

		// L'iscrizione consegna subito lo stato noto, e `onStatus` scrive lo stato
		// del pannello: senza `untrack` l'effetto prenderebbe come dipendenze i
		// valori che scrive lui stesso e si riavvierebbe in tondo. Qui le uniche
		// dipendenze volute sono la visibilità e la query.
		return untrack(() => subscribePrinterObjects<T>(source, currentQuery, onStatus));
	});
}
