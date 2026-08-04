import { untrack } from 'svelte';
import { forgetPollSource } from './moonraker-poll';

/**
 * Il ciclo di polling di un pannello, acceso solo quando il pannello si vede.
 *
 * I pannelli dei caroselli restano montati anche quando sono fuori dalla viewport:
 * Embla tiene tutte le slide nel DOM e si limita a traslarle. Senza questo modulo
 * ogni pannello continuerebbe quindi a interrogare Moonraker anche mentre nessuno
 * lo guarda — sulla dashboard tutti e cinque, per vederne uno solo sul telefono.
 *
 * La visibilità la decide chi rende il pannello (il carosello, tramite
 * `slidesInView()`); i pannelli usati fuori da un carosello non passano niente e
 * restano sempre attivi.
 */

/**
 * Chiama `poll` subito e poi ogni `intervalMs`, finché `isVisible()` è vero.
 *
 * Da invocare nell'inizializzazione del componente: internamente è un `$effect`,
 * quindi il ciclo parte da solo al montaggio, si ferma quando il pannello esce di
 * scena e riparte — con una lettura immediata, così i numeri non restano vecchi —
 * quando rientra.
 *
 * Uscendo di scena la sorgente viene dimenticata: un pannello sospeso non deve
 * lasciare acceso l'avviso di dati fermi con i fallimenti che aveva accumulato
 * (vedi `moonraker-poll.ts`).
 */
export function pollWhileVisible(
	source: string,
	intervalMs: number,
	poll: () => void,
	isVisible: () => boolean = () => true
): void {
	$effect(() => {
		if (!isVisible()) return;

		// `poll` legge e scrive lo stato del pannello: senza `untrack` l'effetto si
		// riavvierebbe — buttando via l'intervallo appena creato — a ogni valore che
		// il poll stesso aggiorna. Qui l'unica dipendenza voluta è la visibilità.
		untrack(poll);
		const interval = window.setInterval(poll, intervalMs);

		return () => {
			window.clearInterval(interval);
			forgetPollSource(source);
		};
	});
}
