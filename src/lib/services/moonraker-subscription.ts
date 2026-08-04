import { derived, writable } from 'svelte/store';
import { configService } from './config';
import { klippyState } from './moonraker-notifier';

/**
 * Lo stato della stampante in **push**, su una sola connessione WebSocket.
 *
 * Prima ogni pannello interrogava `GET /printer/objects/query` per conto proprio
 * ogni 1–3 secondi: con la dashboard aperta erano sei richieste HTTP indipendenti
 * al secondo per gli stessi tre o quattro oggetti, e i numeri erano comunque
 * vecchi di mezzo intervallo. Moonraker offre `printer.objects.subscribe` sul
 * WebSocket: si dichiara una volta cosa interessa e da lì in poi arriva un
 * `notify_status_update` **solo quando qualcosa cambia**, con dentro i soli campi
 * cambiati. Meno traffico quando la macchina è ferma, e reazione immediata quando
 * si muove.
 *
 * La sottoscrizione è una proprietà della connessione, non della singola
 * richiesta: Moonraker ne tiene una per WebSocket e ogni `subscribe` **sostituisce**
 * la precedente. Questo modulo è quindi il registro unico dei pannelli interessati:
 * tiene l'unione di quello che chiedono, la rimanda a ogni cambio di scena
 * (pannelli che montano, che escono dalla viewport del carosello, che smontano) e
 * ridistribuisce a ciascuno la sua fetta.
 */

/** Lo `status` di un oggetto, quando al chiamante non serve dichiararne la forma. */
export type PrinterStatus = Record<string, unknown>;

/** Cosa un pannello vuole di un oggetto: campi elencati, o `null` per tutti. */
type ObjectFields = Map<string, string[] | null>;

type Subscriber = {
	objects: ObjectFields;
	onStatus: (status: PrinterStatus) => void;
};

/**
 * Quanto la connessione può restare giù prima di dichiarare vecchi i dati. Non
 * zero: una riconnessione riuscita al primo tentativo è un singhiozzo, e l'avviso
 * non deve lampeggiare a ogni riavvio di Moonraker.
 */
const staleAfterMs = 4000;

/** Attese di riconnessione, in ordine; l'ultima vale per tutti i tentativi dopo. */
const reconnectDelaysMs = [1000, 2000, 5000, 10000];

/** Riprova la sottoscrizione quando Klippy la rifiuta perché non è pronto. */
const resubscribeDelayMs = 5000;

/** Un pannello per nome: il nome è anche la chiave per sostituirsi da solo. */
const subscribers = new Map<string, Subscriber>();

/**
 * L'ultimo valore noto di ogni oggetto, campo per campo.
 *
 * Serve perché le notifiche sono **differenziali**: `notify_status_update` porta
 * solo ciò che è cambiato, mentre un pannello che monta adesso vuole lo stato
 * intero. La cache è ciò che rende le due cose compatibili — e ciò che permette a
 * un pannello che rientra nella viewport di disegnarsi subito, senza aspettare il
 * prossimo movimento della macchina.
 */
const statusCache: Record<string, Record<string, unknown>> = {};

let socket: WebSocket | null = null;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let resubscribeTimer: ReturnType<typeof setTimeout> | null = null;
let staleTimer: ReturnType<typeof setTimeout> | null = null;
let applyQueued = false;
let nextRequestId = 1;
let subscribeRequestId: number | null = null;

/**
 * Da quando i dati sono fermi, o `null` se la sottoscrizione è viva. È l'istante
 * in cui la connessione è caduta, non quello in cui l'abbiamo dichiarata persa:
 * il contatore dell'avviso conta da quando i numeri hanno smesso di aggiornarsi.
 */
export const staleSince = writable<number | null>(null);

/** Copia leggibile di `staleSince`: serve per non ridichiarare ciò che è già fermo. */
let staleAt: number | null = null;

/** `true` quando lo stato a schermo non è più quello della macchina. */
export const dataStale = derived(staleSince, (since) => since !== null);

function isJsonObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * `'toolhead=position,axis_maximum&gcode_move'` → `{toolhead: [...], gcode_move: null}`.
 *
 * È la stessa sintassi della query HTTP che i pannelli scrivevano prima, tenuta
 * apposta: dice le stesse cose ed è già quella documentata.
 */
function parseQuery(query: string): ObjectFields {
	const objects: ObjectFields = new Map();
	for (const part of query.split('&')) {
		const trimmed = part.trim();
		if (!trimmed) continue;

		const separator = trimmed.indexOf('=');
		if (separator === -1) {
			objects.set(trimmed, null);
			continue;
		}

		const name = trimmed.slice(0, separator).trim();
		const fields = trimmed
			.slice(separator + 1)
			.split(',')
			.map((field) => field.trim())
			.filter(Boolean);
		if (name) objects.set(name, fields.length > 0 ? fields : null);
	}
	return objects;
}

/**
 * Quello che si chiede a Moonraker: l'unione di tutti i pannelli attivi. Un
 * oggetto che qualcuno vuole per intero (`null`) resta per intero anche se un
 * altro ne chiedeva due campi — chiedere di più costa una manciata di byte,
 * sbagliare per difetto costa un pannello che non si aggiorna.
 */
function unionObjects(): Record<string, string[] | null> {
	const union = new Map<string, Set<string> | null>();

	for (const subscriber of subscribers.values()) {
		for (const [name, fields] of subscriber.objects) {
			if (!union.has(name)) {
				union.set(name, fields === null ? null : new Set(fields));
				continue;
			}
			const current = union.get(name);
			if (current === null) continue;
			if (fields === null) {
				union.set(name, null);
				continue;
			}
			for (const field of fields) current?.add(field);
		}
	}

	const objects: Record<string, string[] | null> = {};
	for (const [name, fields] of union) {
		objects[name] = fields === null ? null : [...fields];
	}
	return objects;
}

/** Fonde una risposta o una notifica nella cache; torna gli oggetti toccati. */
function mergeStatus(status: unknown): string[] {
	if (!isJsonObject(status)) return [];

	const changed: string[] = [];
	for (const [name, fields] of Object.entries(status)) {
		if (!isJsonObject(fields)) continue;
		// Un oggetto nuovo a ogni fusione: chi ha ricevuto lo stato di prima non se
		// lo vede cambiare sotto i piedi.
		statusCache[name] = { ...statusCache[name], ...fields };
		changed.push(name);
	}
	return changed;
}

/**
 * Consegna a ogni pannello toccato la sua fetta di cache.
 *
 * La fetta è per oggetto e non per campo: un pannello che aveva chiesto due campi
 * di `toolhead` si vede passare tutto `toolhead`, che è ciò che la cache ha. I
 * pannelli leggono per nome i campi che li interessano, quindi il di più è
 * invisibile, e filtrare costerebbe una copia a ogni notifica.
 */
function dispatch(changed: string[]): void {
	if (changed.length === 0) return;
	const touched = new Set(changed);

	for (const subscriber of subscribers.values()) {
		let relevant = false;
		const snapshot: PrinterStatus = {};

		for (const name of subscriber.objects.keys()) {
			if (touched.has(name)) relevant = true;
			const cached = statusCache[name];
			if (cached) snapshot[name] = cached;
		}

		if (relevant) subscriber.onStatus(snapshot);
	}
}

/** Lo stato già noto degli oggetti di un pannello, o `null` se non ne abbiamo. */
function cachedSnapshot(objects: ObjectFields): PrinterStatus | null {
	const snapshot: PrinterStatus = {};
	let hasSomething = false;

	for (const name of objects.keys()) {
		const cached = statusCache[name];
		if (cached) {
			snapshot[name] = cached;
			hasSomething = true;
		}
	}
	return hasSomething ? snapshot : null;
}

function markFresh(): void {
	if (staleTimer !== null) {
		clearTimeout(staleTimer);
		staleTimer = null;
	}
	if (staleAt === null) return;
	staleAt = null;
	staleSince.set(null);
}

/**
 * La connessione è giù: dopo la grazia i dati a schermo diventano "vecchi".
 *
 * Chi è già dichiarato fermo resta fermo dall'istante in cui lo era: ogni
 * tentativo di riconnessione fallito chiude un'altra socket, e riscrivere
 * `staleSince` a ogni chiusura azzererebbe il contatore dell'avviso proprio
 * mentre il guasto dura.
 */
function markStaleSoon(since: number): void {
	if (staleTimer !== null || staleAt !== null) return;
	staleTimer = setTimeout(() => {
		staleTimer = null;
		// Senza pannelli in ascolto non c'è niente di fermo da segnalare: la pagina
		// che si guarda non mostra stato della macchina.
		if (subscribers.size === 0) return;
		staleAt = since;
		staleSince.set(since);
	}, staleAfterMs);
}

function send(message: Record<string, unknown>): void {
	if (socket?.readyState !== WebSocket.OPEN) return;
	socket.send(JSON.stringify(message));
}

/** Manda la sottoscrizione corrente, che sostituisce quella precedente. */
function sendSubscription(): void {
	if (resubscribeTimer !== null) {
		clearTimeout(resubscribeTimer);
		resubscribeTimer = null;
	}
	if (socket?.readyState !== WebSocket.OPEN) return;

	subscribeRequestId = nextRequestId++;
	send({
		jsonrpc: '2.0',
		method: 'printer.objects.subscribe',
		params: { objects: unionObjects() },
		id: subscribeRequestId
	});
}

/**
 * Rimanda la sottoscrizione una volta sola per tick.
 *
 * Montare una pagina o far scorrere il carosello cambia più pannelli nello stesso
 * istante: senza questo partirebbe un `subscribe` per ognuno, e i primi sarebbero
 * già superati all'arrivo.
 */
function scheduleApply(): void {
	if (applyQueued) return;
	applyQueued = true;
	queueMicrotask(() => {
		applyQueued = false;
		if (subscribers.size === 0) {
			// Nessuno guarda: si disdice tutto (un `objects` vuoto è la disdetta) ma
			// la connessione resta aperta, pronta per la pagina successiva.
			markFresh();
			sendSubscription();
			return;
		}
		if (!socket) connect();
		else sendSubscription();
	});
}

function handleMessage(raw: string): void {
	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch {
		return;
	}
	if (!isJsonObject(data)) return;

	// La risposta al `subscribe` porta lo stato completo di tutto ciò che abbiamo
	// chiesto: è il primo riempimento della cache, e la conferma che il canale
	// funziona davvero — non basta che il socket sia aperto.
	if (typeof data.id === 'number' && data.id === subscribeRequestId) {
		subscribeRequestId = null;

		const result = isJsonObject(data.result) ? data.result : null;
		if (!result) {
			// Klippy non pronto (riavvio, shutdown, errore di configurazione): il
			// socket è vivo ma non c'è stato da sottoscrivere. Si riprova, e in ogni
			// caso `klippyState` ci risveglia appena torna pronto.
			markStaleSoon(Date.now());
			if (resubscribeTimer === null) {
				resubscribeTimer = setTimeout(() => {
					resubscribeTimer = null;
					if (subscribers.size > 0) sendSubscription();
				}, resubscribeDelayMs);
			}
			return;
		}

		markFresh();
		dispatch(mergeStatus(result.status));
		return;
	}

	if (data.method === 'notify_status_update' && Array.isArray(data.params)) {
		markFresh();
		dispatch(mergeStatus(data.params[0]));
	}
}

function scheduleReconnect(): void {
	if (reconnectTimer !== null) return;
	const delay = reconnectDelaysMs[Math.min(reconnectAttempts, reconnectDelaysMs.length - 1)];
	reconnectAttempts++;
	reconnectTimer = setTimeout(() => {
		reconnectTimer = null;
		if (subscribers.size > 0) connect();
	}, delay);
}

function connect(): void {
	if (socket) return;

	const url = configService.getKlipperConfig().moonrakerWsUrl;
	if (!url) return;

	let ws: WebSocket;
	try {
		ws = new WebSocket(url);
	} catch {
		markStaleSoon(Date.now());
		scheduleReconnect();
		return;
	}
	socket = ws;

	ws.onopen = () => {
		reconnectAttempts = 0;
		// Moonraker vuole sapere chi ha aperto la connessione prima di servirla.
		send({
			jsonrpc: '2.0',
			method: 'server.connection.identify',
			params: {
				client_name: 'GingerView',
				version: '0.0.1',
				type: 'web',
				url: window.location.href
			},
			id: nextRequestId++
		});
		sendSubscription();
	};

	ws.onmessage = (event) => handleMessage(event.data);

	ws.onclose = () => {
		if (socket !== ws) return;
		socket = null;
		subscribeRequestId = null;
		markStaleSoon(Date.now());
		scheduleReconnect();
	};

	// `onerror` è sempre seguito da `onclose`: la riconnessione si decide lì.
	ws.onerror = () => {};
}

/**
 * Iscrive un pannello allo stato che gli serve; il ritorno lo disiscrive.
 *
 * `query` ha la sintassi di `printer/objects/query` (`'toolhead=position&fan'`).
 * `onStatus` riceve **lo stato intero** degli oggetti chiesti, non solo il pezzo
 * cambiato: la cache ci pensa, così il pannello scrive i suoi valori senza dover
 * distinguere il primo aggiornamento dai successivi. Viene chiamato subito con
 * quello che già sappiamo — se sappiamo qualcosa — e poi a ogni cambiamento.
 *
 * `source` è il nome del pannello: iscriversi due volte con lo stesso nome
 * sostituisce l'iscrizione, che è quello che serve quando un pannello cambia la
 * query che gli interessa.
 */
export function subscribePrinterObjects<T = PrinterStatus>(
	source: string,
	query: string,
	onStatus: (status: T) => void
): () => void {
	const objects = parseQuery(query);
	subscribers.set(source, {
		objects,
		onStatus: onStatus as (status: PrinterStatus) => void
	});
	scheduleApply();

	const known = cachedSnapshot(objects);
	if (known) onStatus(known as T);

	return () => {
		if (subscribers.get(source)?.onStatus !== onStatus) return;
		subscribers.delete(source);
		scheduleApply();
	};
}

/**
 * Klippy che torna pronto è il momento in cui c'è di nuovo qualcosa da
 * sottoscrivere: il `subscribe` rifiutato durante un riavvio va rifatto, e
 * aspettare il timer di ripiego significherebbe secondi di pannelli fermi.
 */
klippyState.subscribe((state) => {
	if (state === 'ready' && subscribers.size > 0) sendSubscription();
});
