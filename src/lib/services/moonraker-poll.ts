import { derived, writable } from 'svelte/store';
import { getMoonrakerApiUrl } from './config';

/**
 * Il polling dei pannelli e la sua salute.
 *
 * Ogni pannello della dashboard e del movimento interroga `/printer/objects/query`
 * per conto proprio, ogni 1–3 secondi. Quando la richiesta fallisce il pannello non
 * ha niente di nuovo da scrivere e lascia a schermo l'ultimo valore letto: numeri
 * plausibili, aggiornati a chissà quando. È il caso che questo modulo rende visibile.
 *
 * Il conteggio è **per sorgente** (un nome per pannello) perché i pannelli vanno e
 * vengono — cambiano pagina, o escono dalla viewport del carosello e sospendono il
 * polling (vedi `panel-poll.svelte.ts`): una sorgente che sparisce non deve lasciare
 * acceso l'avviso, e una che fallisce da sola basta a spegnere la fiducia sui suoi dati.
 */

/** Lo `status` di una query, quando al chiamante non serve dichiararne la forma. */
export type PrinterStatus = Record<string, unknown>;

/**
 * Quanti fallimenti consecutivi prima di dichiarare i dati vecchi. Due e non uno:
 * una singola richiesta persa capita (riavvio di Moonraker, wifi che sfarfalla) e
 * l'avviso non deve lampeggiare a ogni singhiozzo.
 */
const failuresBeforeStale = 2;

/** Fallimenti consecutivi per sorgente; una sorgente sana non è nella mappa. */
const consecutiveFailures = new Map<string, number>();

/**
 * Da quando i dati sono fermi, o `null` se tutto risponde. È l'istante in cui la
 * soglia è stata superata, quindi in ritardo di un paio di poll sull'ultimo dato
 * buono: l'avviso dice "da almeno tanto", non "esattamente da".
 */
export const staleSince = writable<number | null>(null);

/** `true` quando almeno una sorgente ha smesso di rispondere. */
export const dataStale = derived(staleSince, (since) => since !== null);

/** Ricalcola lo stato globale dopo ogni esito. */
function publish(): void {
	let stale = false;
	for (const failures of consecutiveFailures.values()) {
		if (failures >= failuresBeforeStale) {
			stale = true;
			break;
		}
	}
	staleSince.update((since) => {
		if (!stale) return null;
		return since ?? Date.now();
	});
}

/** Una risposta buona: la sorgente riparte da zero. */
export function reportPollOk(source: string): void {
	if (consecutiveFailures.delete(source)) publish();
}

/** Una richiesta persa o rifiutata. */
export function reportPollFailed(source: string): void {
	consecutiveFailures.set(source, (consecutiveFailures.get(source) ?? 0) + 1);
	publish();
}

/**
 * Da chiamare quando un pannello smonta o sospende il polling: senza questo un
 * pannello uscito di scena mentre la macchina non rispondeva terrebbe acceso
 * l'avviso per sempre.
 */
export function forgetPollSource(source: string): void {
	if (consecutiveFailures.delete(source)) publish();
}

/**
 * `GET /printer/objects/query?<query>`, con l'esito registrato.
 *
 * Restituisce direttamente lo `status` — l'unica parte che i pannelli guardano — o
 * `null` se non c'è niente di utilizzabile. `null` significa sempre "non aggiornare
 * nulla": il chiamante esce e lascia a schermo l'ultimo valore buono, che è il
 * comportamento che l'avviso di dati fermi va poi a spiegare.
 *
 * Il parametro di tipo è la forma che il chiamante si aspetta, dichiarata accanto alla
 * query che la chiede: la risposta è JSON di Moonraker e non c'è modo di verificarla a
 * compile time, ma un tipo per pannello dice almeno **quali campi legge quel pannello**,
 * ed è più onesto di un `any` che non dice niente. I controlli di forma che i pannelli
 * già fanno (`typeof`, `Array.isArray`) restano dove sono: sono loro la vera difesa.
 */
export async function queryPrinterObjects<T = PrinterStatus>(
	source: string,
	query: string
): Promise<T | null> {
	try {
		const response = await fetch(`${getMoonrakerApiUrl()}/printer/objects/query?${query}`);
		if (!response.ok) {
			reportPollFailed(source);
			return null;
		}

		const payload = (await response.json()) as { result?: { status?: unknown } };
		const status = payload?.result?.status;
		if (!status) {
			reportPollFailed(source);
			return null;
		}

		reportPollOk(source);
		return status as T;
	} catch {
		reportPollFailed(source);
		return null;
	}
}
