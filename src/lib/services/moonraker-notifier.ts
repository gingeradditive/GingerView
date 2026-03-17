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
	const config = configService.getKlipperConfig();
	return config.moonrakerApiUrl ?? `http://${config.moonrakerHost}:${config.moonrakerPort}`;
}

function getWsUrl(): string {
	const config = configService.getKlipperConfig();
	return config.moonrakerWsUrl ?? `ws://${config.moonrakerHost}:${config.moonrakerPort}/websocket`;
}

export interface PrinterInfo {
	state: string;
	state_message: string;
	hostname: string;
	klipper_path: string;
	config_file: string;
	software_version: string;
}

export async function fetchServerInfo(): Promise<MoonrakerServerInfo | null> {
	try {
		const apiUrl = getApiUrl();
		const res = await fetch(`${apiUrl}/server/info`);
		if (!res.ok) {
			toastActions.error('moonraker', 'Server info error', `Failed to fetch server info: ${res.status} ${res.statusText}`);
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
		toastActions.error('moonraker', 'Failed component', `Moonraker component failed to load: ${component}`, 0);
	}

	// Show Klipper state issues — fetch full details from /printer/info
	if (info.klippy_state === 'error' || info.klippy_state === 'shutdown') {
		const printerInfo = await fetchPrinterInfo();
		const stateMsg = printerInfo?.state_message || '';
		const firstLine = stateMsg.split('\n')[0] || `Kalico is in ${info.klippy_state} state`;
		const details = stateMsg || undefined;

		if (info.klippy_state === 'error') {
			toastActions.error('klipper', 'Kalico error', firstLine, 0, details);
		} else {
			toastActions.error('klipper', 'Kalico shutdown', firstLine, 0, details);
		}
	} else if (!info.klippy_connected) {
		toastActions.warning('klipper', 'Kalico disconnected', 'Kalico host process is not connected to Moonraker.', 0);
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
		toastActions.success('klipper', 'Kalico ready', 'Kalico firmware is ready');
	}

	if (data.method === 'notify_klippy_shutdown') {
		// Fetch full details asynchronously
		fetchPrinterInfo().then((printerInfo) => {
			const stateMsg = printerInfo?.state_message || '';
			const firstLine = stateMsg.split('\n')[0] || 'Kalico firmware has entered shutdown state';
			toastActions.error('klipper', 'Kalico shutdown', firstLine, 0, stateMsg || undefined);
		});
	}

	if (data.method === 'notify_klippy_disconnected') {
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
				// Subscribe to notifications
				notifierWs?.send(JSON.stringify({
					jsonrpc: '2.0',
					method: 'server.connection.identify',
					params: {
						client_name: 'GingerView',
						version: '0.0.1',
						type: 'web',
						url: window.location.href
					},
					id: Date.now()
				}));
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
