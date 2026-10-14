import { handleRequest } from './http';
import { nativeFetch, NativeWebSocket } from './native';
import { startSimulation } from './printer';
import { DemoWebSocket } from './socket';

/**
 * Accende la demo: da qui in poi `fetch` e `WebSocket` verso la stampante
 * rispondono dal simulatore, nel browser.
 *
 * Si chiama una volta sola, da `hooks.client.ts`, e solo con `VITE_DEMO=1`:
 * senza il flag questo modulo non entra nemmeno nella build. I service di
 * GingerView non sanno niente della demo — chiamano `fetch` e `new WebSocket`
 * come sempre.
 */

let installed = false;

export function installDemo(): void {
	if (installed) return;
	installed = true;

	globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		const request = new Request(input, init);
		const response = await handleRequest(request);
		return response ?? nativeFetch(input, init);
	};

	// Solo `/websocket` è la stampante: quello di Vite in sviluppo resta vero.
	const DemoOrNativeWebSocket = function (url: string | URL, protocols?: string | string[]) {
		if (new URL(String(url), window.location.href).pathname.endsWith('/websocket')) {
			return new DemoWebSocket(url);
		}
		return new NativeWebSocket(url, protocols);
	} as unknown as typeof WebSocket;
	Object.assign(DemoOrNativeWebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
	DemoOrNativeWebSocket.prototype = NativeWebSocket.prototype;
	globalThis.WebSocket = DemoOrNativeWebSocket;

	startSimulation();
	console.info('[demo] Virtual G2 attiva: nessuna stampante reale è collegata.');
}
