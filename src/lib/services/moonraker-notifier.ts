import { writable } from 'svelte/store';
import { configService } from './config';
import { toastActions } from '$lib/stores/toastStore';

export interface MoonrakerServerInfo {
	klippy_connected: boolean;
	klippy_state: string;
	components: string[];
	failed_components: string[];
	registered_directories: string[];
	warnings: string[];
	websocket_count: number;
	moonraker_version?: string;
	api_version?: number[];
	api_version_string?: string;
}

function getApiUrl(): string {
	return configService.getKlipperConfig().moonrakerApiUrl;
}

function getWsUrl(): string {
	return configService.getKlipperConfig().moonrakerWsUrl;
}

export interface PrinterInfo {
	state: string;
	state_message: string;
	hostname: string;
	klipper_path: string;
	config_file: string;
	software_version: string;
}

/**
 * What Klippy is doing, as Moonraker reports it, plus `disconnected` for "the
 * host process is not talking to Moonraker at all" and `''` for "not known yet".
 */
export type KlippyState = '' | 'ready' | 'startup' | 'shutdown' | 'error' | 'disconnected';

/**
 * Shared Klippy state, fed by the notifications this module already listens to.
 *
 * It exists so the dock's emergency stop can tell "running" from "shut down"
 * without opening a second WebSocket or adding another poll: the notifier is
 * mounted in the layout, so it is always the first to know.
 */
export const klippyState = writable<KlippyState>('');

/**
 * Klippy's `state_message` while it is not ready — the shutdown reason, or the
 * config error that stopped it. Empty when there is nothing to say.
 */
export const klippyMessage = writable<string>('');

/**
 * A change under `gcodes`, as `notify_filelist_changed` reports it: the folders
 * (relative to `gcodes`, `''` for the root) whose listing is now different, or
 * `null` when Moonraker re-read the whole root.
 */
export type GcodesChange = { dirs: string[] | null };

/**
 * Set every time a G-code file or folder changes, whoever changed it — mostly
 * GingerSlicer uploading, which the file list would otherwise only notice on the
 * next visit. A fresh object each time, so equal changes still notify.
 */
export const gcodesChanged = writable<GcodesChange | null>(null);

/** Keeps the two stores in step: a healthy Klippy has no message. */
function setKlippyState(state: KlippyState, message = ''): void {
	klippyState.set(state);
	klippyMessage.set(message);
}

/** `true` for the states in which the machine cannot move or heat. */
export function isKlippyDown(state: KlippyState): boolean {
	return state === 'shutdown' || state === 'error' || state === 'disconnected';
}

/**
 * Re-reads the state from `/server/info`, silently. Used at startup and every
 * time the WebSocket (re)connects, since anything that happened while it was
 * down arrived nowhere.
 */
export async function refreshKlippyState(): Promise<void> {
	try {
		const res = await fetch(`${getApiUrl()}/server/info`);
		if (!res.ok) return;
		const json = await res.json();
		const info = json.result as MoonrakerServerInfo;
		const state: KlippyState = info.klippy_connected
			? (info.klippy_state as KlippyState)
			: 'disconnected';

		// The reason lives in `/printer/info`, and only Klippy itself can tell it:
		// with the host process gone there is nobody to ask.
		if (state === 'shutdown' || state === 'error') {
			const printerInfo = await fetchPrinterInfo();
			setKlippyState(state, printerInfo?.state_message ?? '');
		} else {
			setKlippyState(state);
		}
	} catch {
		// Unreachable: keep the last known state rather than claiming ignorance.
	}
}

export async function fetchServerInfo(): Promise<MoonrakerServerInfo | null> {
	try {
		const apiUrl = getApiUrl();
		const res = await fetch(`${apiUrl}/server/info`);
		if (!res.ok) {
			toastActions.error(
				'moonraker',
				'Server info error',
				`Couldn't get info from Moonraker: ${res.status} ${res.statusText}`
			);
			return null;
		}
		const json = await res.json();
		return json.result as MoonrakerServerInfo;
	} catch (e) {
		console.warn("Couldn't get info from Moonraker:", e);
		return null;
	}
}

export async function fetchPrinterInfo(): Promise<PrinterInfo | null> {
	try {
		const apiUrl = getApiUrl();
		const res = await fetch(`${apiUrl}/printer/info`);
		if (!res.ok) return null;
		const json = await res.json();
		return json.result as PrinterInfo;
	} catch {
		return null;
	}
}

export async function fetchAndDisplayWarnings(): Promise<void> {
	const info = await fetchServerInfo();
	if (!info) return;

	// Show Moonraker warnings
	for (const warning of info.warnings) {
		toastActions.warning('moonraker', 'Moonraker warning', warning, 0);
	}

	// Show failed components as errors
	for (const component of info.failed_components) {
		toastActions.error(
			'moonraker',
			"Something didn't load",
			`Moonraker component failed to load: ${component}`,
			0
		);
	}

	// Show Klipper state issues — fetch full details from /printer/info
	if (info.klippy_state === 'error' || info.klippy_state === 'shutdown') {
		const printerInfo = await fetchPrinterInfo();
		const stateMsg = printerInfo?.state_message || '';
		const firstLine = stateMsg.split('\n')[0] || `Kalico is in ${info.klippy_state} state`;
		const details = stateMsg || undefined;

		setKlippyState(info.klippy_state as KlippyState, stateMsg);

		if (info.klippy_state === 'error') {
			toastActions.error('klipper', 'Kalico error', firstLine, 0, details);
		} else {
			toastActions.error('klipper', 'Kalico shut down', firstLine, 0, details);
		}
	} else if (!info.klippy_connected) {
		setKlippyState('disconnected');
		toastActions.warning(
			'klipper',
			'Kalico disconnected',
			"Kalico isn't connected to Moonraker",
			0
		);
	} else {
		setKlippyState(info.klippy_state as KlippyState);
	}
}

const shownWarnings = new Set<string>();

/** A JSON object, as far as the JSON-RPC boundary lets us claim. */
type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The shape we actually rely on: a notification carries a method name and,
 * optionally, positional parameters. Everything past that is checked where it
 * is read, because Moonraker's payloads are not ours to declare.
 */
function isNotification(data: unknown): data is { method: string; params?: unknown[] } {
	if (!isJsonObject(data)) return false;
	if (typeof data.method !== 'string') return false;
	return data.params === undefined || Array.isArray(data.params);
}

/** The warning strings inside `notify_proc_stat_update`, or none if absent. */
function readProcStatWarnings(params: unknown[] | undefined): string[] {
	const first = params?.[0];
	if (!isJsonObject(first)) return [];
	const stats = first.moonraker_stats;
	if (!isJsonObject(stats)) return [];
	const warnings = stats.warnings;
	if (!Array.isArray(warnings)) return [];
	return warnings.filter((w): w is string => typeof w === 'string');
}

/** The folder holding `path`, `''` when it sits at the root. */
function parentDir(path: string): string {
	const slash = path.lastIndexOf('/');
	return slash === -1 ? '' : path.slice(0, slash);
}

/**
 * The `gcodes` folders a `notify_filelist_changed` touches: where the item is
 * now and, for a move, where it was. `undefined` when the change is elsewhere.
 */
function readGcodesChange(params: unknown[] | undefined): GcodesChange | undefined {
	const first = params?.[0];
	if (!isJsonObject(first) || !isJsonObject(first.item)) return undefined;
	if (first.item.root !== 'gcodes') return undefined;
	if (first.action === 'root_update') return { dirs: null };

	const dirs = new Set<string>();
	for (const entry of [first.item, first.source_item]) {
		if (isJsonObject(entry) && entry.root === 'gcodes' && typeof entry.path === 'string') {
			dirs.add(parentDir(entry.path));
		}
	}
	return { dirs: [...dirs] };
}

function handleNotification(data: unknown): void {
	if (!isNotification(data)) return;

	if (data.method === 'notify_filelist_changed') {
		const change = readGcodesChange(data.params);
		if (change) gcodesChanged.set(change);
	}

	// Moonraker notify_proc_stat_update can contain warnings
	if (data.method === 'notify_proc_stat_update') {
		for (const w of readProcStatWarnings(data.params)) {
			if (!shownWarnings.has(w)) {
				shownWarnings.add(w);
				toastActions.warning('moonraker', 'Moonraker warning', w, 0);
			}
		}
	}

	// Klipper state change notifications
	if (data.method === 'notify_klippy_ready') {
		setKlippyState('ready');
		toastActions.success('klipper', 'Kalico is ready', 'The firmware is ready');
	}

	if (data.method === 'notify_klippy_shutdown') {
		setKlippyState('shutdown');
		// Fetch full details asynchronously
		fetchPrinterInfo().then((printerInfo) => {
			const stateMsg = printerInfo?.state_message || '';
			const firstLine = stateMsg.split('\n')[0] || 'The firmware has shut down';
			klippyMessage.set(stateMsg);
			toastActions.error('klipper', 'Kalico shut down', firstLine, 0, stateMsg || undefined);
		});
	}

	if (data.method === 'notify_klippy_disconnected') {
		setKlippyState('disconnected');
		toastActions.error('klipper', 'Kalico disconnected', 'Lost connection to Kalico', 0);
	}
}

/**
 * Se la stampante risponde del tutto — il Raspberry, non Kalico.
 *
 * Kalico fermo è affare di `klippyState` e ha il suo overlay, con una via
 * d'uscita. Questo è il caso prima: la macchina è spenta, in riavvio o fuori
 * rete, quindi manca Moonraker stesso e niente nella pagina può funzionare — né
 * i comandi, né Settings, né il riavvio del firmware.
 *
 * La sentinella è il WebSocket del notifier: è aperto su ogni pagina per tutta
 * la sessione, quindi la sua sorte è quella della stampante.
 */
export const printerOnline = writable<boolean>(true);

/**
 * A che punto è la riconnessione mentre la stampante è offline: quando parte il
 * prossimo tentativo, o `null` mentre ce n'è uno in corso.
 */
export const nextRetryAt = writable<number | null>(null);

/**
 * Quanto la connessione può restare giù prima di dichiarare la stampante offline.
 * Non zero: un riavvio di Moonraker (un aggiornamento, un cambio di config) fa
 * cadere il socket per un secondo o due, e lo schermo intero non deve lampeggiare
 * per così poco.
 */
const offlineAfterMs = 5000;

/**
 * Attese tra un tentativo e l'altro; l'ultima vale per tutti i successivi. Brevi
 * apposta: la schermata offline deve sparire appena la stampante torna, e un
 * handshake su `/websocket` ogni pochi secondi non costa niente.
 */
const retryDelaysMs = [1000, 2000, 3000, 5000];

/**
 * Un host spento non risponde niente — né rifiuto né reset — e un WebSocket verso
 * di lui può restare in CONNECTING per più di un minuto prima che il browser
 * rinunci. Oltre questo limite il tentativo conta come fallito.
 */
const connectTimeoutMs = 5000;

/**
 * Staccare la spina non chiude un socket aperto: il browser ci crede finché TCP
 * non si arrende, e possono passare minuti. Quindi la connessione si sonda: una
 * richiesta leggera ogni `heartbeatEveryMs`, e un silenzio più lungo di
 * `silenceLimitMs` (nessuna risposta, nessuna notifica) vuol dire stampante sparita.
 */
const heartbeatEveryMs = 5000;
const silenceLimitMs = 12000;

let notifierWs: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let offlineTimer: ReturnType<typeof setTimeout> | null = null;
let connectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let failedAttempts = 0;
let lastMessageAt = 0;
let isOffline = false;
/** Inizio del guasto in corso: la prima chiusura, non il momento in cui l'abbiamo dichiarato. */
let downSince: number | null = null;
let connectNow: (() => void) | null = null;

/**
 * Guasto finto, solo in sviluppo (vedi `installOfflineSimulator`):
 * - `'off'`: stampante spenta — il socket si chiude e ogni tentativo fallisce;
 * - `'unplug'`: spina staccata — il socket resta aperto ma non arriva più niente,
 *   finché se ne accorge il battito; poi i tentativi falliscono come sopra.
 */
type SimulatedFault = 'off' | 'unplug' | null;
let simulatedFault: SimulatedFault = null;
let simulateNow: ((fault: SimulatedFault) => void) | null = null;

function clearTimer(timer: ReturnType<typeof setTimeout> | null): null {
	if (timer !== null) clearTimeout(timer);
	return null;
}

function goOffline(): void {
	offlineTimer = null;
	if (isOffline) return;
	isOffline = true;
	printerOnline.set(false);
	// Quello che sapevamo di Kalico valeva per una macchina che non c'è più: al
	// ritorno `refreshKlippyState` racconterà lo stato attuale. Idem per i toast di
	// Kalico ("disconnected", annunciato da una stampante che si stava spegnendo):
	// lasciati a schermo sopravviverebbero al guasto e confonderebbero.
	setKlippyState('');
	toastActions.clearSource('klipper');
}

function goOnline(): void {
	offlineTimer = clearTimer(offlineTimer);
	downSince = null;
	failedAttempts = 0;
	nextRetryAt.set(null);
	if (!isOffline) return;
	isOffline = false;
	printerOnline.set(true);
}

/**
 * Prova subito a raggiungere la stampante, senza aspettare il prossimo tentativo.
 * Per il pulsante della schermata offline.
 */
export function retryPrinterConnection(): void {
	connectNow?.();
}

export function startNotifierWebSocket(): () => void {
	let stopped = false;

	/** Molla un socket senza aspettare un handshake di chiusura a cui nessuno risponderà. */
	function abandon(ws: WebSocket): void {
		ws.onopen = null;
		ws.onmessage = null;
		ws.onclose = null;
		ws.onerror = null;
		try {
			ws.close();
		} catch {
			// already closed
		}
	}

	function stopHeartbeat(): void {
		if (heartbeatTimer !== null) clearInterval(heartbeatTimer);
		heartbeatTimer = null;
	}

	function startHeartbeat(ws: WebSocket): void {
		stopHeartbeat();
		lastMessageAt = Date.now();
		heartbeatTimer = setInterval(() => {
			if (Date.now() - lastMessageAt > silenceLimitMs) {
				lost(ws, lastMessageAt);
				return;
			}
			if (ws.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify({ jsonrpc: '2.0', method: 'server.info', id: Date.now() }));
			}
		}, heartbeatEveryMs);
	}

	/**
	 * Il socket è perso, comunque sia andata: si pianifica il prossimo tentativo.
	 * `since` è quando ha smesso davvero di rispondere: per un silenzio scoperto
	 * dal battito è l'ultimo messaggio, e la tolleranza è già passata.
	 */
	function lost(ws: WebSocket, since = Date.now()): void {
		if (notifierWs !== ws) return;
		notifierWs = null;
		connectTimer = clearTimer(connectTimer);
		stopHeartbeat();
		abandon(ws);
		if (stopped) return;

		if (downSince === null) downSince = since;
		if (!isOffline && offlineTimer === null) {
			const wait = Math.max(0, offlineAfterMs - (Date.now() - downSince));
			offlineTimer = setTimeout(goOffline, wait);
		}
		scheduleReconnect();
	}

	function connect() {
		if (stopped || notifierWs) return;
		reconnectTimer = clearTimer(reconnectTimer);
		nextRetryAt.set(null);

		let ws: WebSocket;
		try {
			if (simulatedFault) throw new Error('printer offline (simulated)');
			ws = new WebSocket(getWsUrl());
		} catch {
			failedAttempts++;
			if (downSince === null) downSince = Date.now();
			if (!isOffline && offlineTimer === null) {
				offlineTimer = setTimeout(goOffline, offlineAfterMs);
			}
			scheduleReconnect();
			return;
		}
		notifierWs = ws;

		connectTimer = setTimeout(() => {
			connectTimer = null;
			failedAttempts++;
			lost(ws);
		}, connectTimeoutMs);

		ws.onopen = () => {
			connectTimer = clearTimer(connectTimer);
			console.log('[MoonrakerNotifier] WebSocket connected');
			goOnline();
			startHeartbeat(ws);
			// Resync: a shutdown that happened while the socket was down was
			// announced to nobody.
			refreshKlippyState();
			ws.send(
				JSON.stringify({
					jsonrpc: '2.0',
					method: 'server.connection.identify',
					params: {
						client_name: 'GingerView',
						version: '0.0.1',
						type: 'web',
						url: window.location.href
					},
					id: Date.now()
				})
			);
		};

		ws.onmessage = (event) => {
			// Spina staccata per finta: i messaggi arrivano ma è come se non ci fossero.
			if (simulatedFault === 'unplug') return;
			lastMessageAt = Date.now();
			try {
				const data = JSON.parse(event.data);
				handleNotification(data);
			} catch {
				// ignore parse errors
			}
		};

		ws.onclose = () => {
			console.log('[MoonrakerNotifier] WebSocket disconnected, will reconnect...');
			if (notifierWs === ws && connectTimer !== null) failedAttempts++;
			lost(ws);
		};

		ws.onerror = () => {
			// onclose will fire after this
		};
	}

	function scheduleReconnect() {
		reconnectTimer = clearTimer(reconnectTimer);
		const delay = retryDelaysMs[Math.min(failedAttempts, retryDelaysMs.length - 1)];
		nextRetryAt.set(Date.now() + delay);
		reconnectTimer = setTimeout(connect, delay);
	}

	/**
	 * Un telefono che blocca lo schermo congela i timer della pagina: al ritorno il
	 * socket può essere morto da un pezzo. Si guarda subito, non al prossimo battito.
	 */
	function onVisible() {
		if (document.visibilityState !== 'visible') return;
		if (notifierWs) {
			if (Date.now() - lastMessageAt > silenceLimitMs) lost(notifierWs, lastMessageAt);
			return;
		}
		connect();
	}

	connectNow = connect;
	simulateNow = (fault) => {
		simulatedFault = fault;
		if (fault === 'off' && notifierWs) lost(notifierWs);
		if (fault === null && !notifierWs) connect();
	};
	document.addEventListener('visibilitychange', onVisible);

	function disconnect() {
		stopped = true;
		connectNow = null;
		simulateNow = null;
		document.removeEventListener('visibilitychange', onVisible);
		reconnectTimer = clearTimer(reconnectTimer);
		offlineTimer = clearTimer(offlineTimer);
		connectTimer = clearTimer(connectTimer);
		stopHeartbeat();
		if (notifierWs) {
			abandon(notifierWs);
			notifierWs = null;
		}
	}

	connect();
	return disconnect;
}

/**
 * Comandi da console per provare la schermata offline senza toccare la stampante.
 * Solo in sviluppo: la build di produzione non li contiene.
 *
 * - `gingerview.offline()` — stampante spenta: schermata dopo ~5 s;
 * - `gingerview.offline('unplug')` — spina staccata: schermata dopo 12–17 s;
 * - `gingerview.online()` — la stampante "torna": sparisce al tentativo successivo.
 */
export function installOfflineSimulator(): () => void {
	const api = {
		offline(fault: 'off' | 'unplug' = 'off') {
			simulateNow?.(fault);
			return `GingerView: printer ${fault === 'off' ? 'switched off' : 'unplugged'} (simulated)`;
		},
		online() {
			simulateNow?.(null);
			return 'GingerView: printer back (simulated)';
		}
	};
	(window as unknown as { gingerview?: typeof api }).gingerview = api;
	console.info(
		"[GingerView] simulate a printer outage: gingerview.offline() · gingerview.offline('unplug') · gingerview.online()"
	);
	return () => {
		delete (window as unknown as { gingerview?: typeof api }).gingerview;
	};
}
