/**
 * `fetch` e `WebSocket` del browser, catturati prima che la demo li sostituisca.
 *
 * Servono per tutto ciò che non è la stampante: le miniature (asset statici
 * della build) e il WebSocket di Vite in sviluppo.
 */

export const nativeFetch: typeof fetch = globalThis.fetch.bind(globalThis);
export const NativeWebSocket: typeof WebSocket = globalThis.WebSocket;
