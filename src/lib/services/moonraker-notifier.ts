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
				`Failed to fetch server info: ${res.status} ${res.statusText}`
			);
			return null;
		}
		const json = await res.json();
		return json.result as MoonrakerServerInfo;
	} catch (e) {
		console.warn('Failed to fetch Moonraker server info:', e);
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
			'Failed component',
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
			toastActions.error('klipper', 'Kalico shutdown', firstLine, 0, details);
		}
	} else if (!info.klippy_connected) {
		setKlippyState('disconnected');
		toastActions.warning(
			'klipper',
			'Kalico disconnected',
			'Kalico host process is not connected to Moonraker.',
			0
		);
	} else {
		setKlippyState(info.klippy_state as KlippyState);
	}
}

let notifierWs: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const shownWarnings = new Set<string>();

function handleNotification(data: any): void {
	// Moonraker notify_proc_stat_update can contain warnings
	if (data.method === 'notify_proc_stat_update') {
		const params = data.params?.[0];
		if (params?.moonraker_stats?.warnings) {
			for (const w of params.moonraker_stats.warnings) {
				if (!shownWarnings.has(w)) {
					shownWarnings.add(w);
					toastActions.warning('moonraker', 'Moonraker warning', w, 0);
				}
			}
		}
	}

	// Klipper state change notifications
	if (data.method === 'notify_klippy_ready') {
		setKlippyState('ready');
		toastActions.success('klipper', 'Kalico ready', 'Kalico firmware is ready');
	}

	if (data.method === 'notify_klippy_shutdown') {
		setKlippyState('shutdown');
		// Fetch full details asynchronously
		fetchPrinterInfo().then((printerInfo) => {
			const stateMsg = printerInfo?.state_message || '';
			const firstLine = stateMsg.split('\n')[0] || 'Kalico firmware has entered shutdown state';
			klippyMessage.set(stateMsg);
			toastActions.error('klipper', 'Kalico shutdown', firstLine, 0, stateMsg || undefined);
		});
	}

	if (data.method === 'notify_klippy_disconnected') {
		setKlippyState('disconnected');
		toastActions.error('klipper', 'Kalico disconnected', 'Kalico host process has disconnected', 0);
	}
}

export function startNotifierWebSocket(): () => void {
	function connect() {
		const wsUrl = getWsUrl();
		try {
			notifierWs = new WebSocket(wsUrl);

			notifierWs.onopen = () => {
				console.log('[MoonrakerNotifier] WebSocket connected');
				// Resync: a shutdown that happened while the socket was down was
				// announced to nobody.
				refreshKlippyState();
				// Subscribe to notifications
				notifierWs?.send(
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

			notifierWs.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					handleNotification(data);
				} catch {
					// ignore parse errors
				}
			};

			notifierWs.onclose = () => {
				console.log('[MoonrakerNotifier] WebSocket disconnected, will reconnect...');
				scheduleReconnect();
			};

			notifierWs.onerror = () => {
				// onclose will fire after this
			};
		} catch {
			scheduleReconnect();
		}
	}

	function scheduleReconnect() {
		if (reconnectTimer) clearTimeout(reconnectTimer);
		reconnectTimer = setTimeout(connect, 10000);
	}

	function disconnect() {
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
		if (notifierWs) {
			notifierWs.close(1000);
			notifierWs = null;
		}
	}

	connect();
	return disconnect;
}
