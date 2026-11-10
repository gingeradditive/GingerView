/**
 * Le connessioni WebSocket simulate aperte in questo momento.
 *
 * GingerView apre più WebSocket (sottoscrizione allo stato, notifiche, console,
 * aggiornamenti) e Moonraker manda le notifiche a tutte. Questo modulo è il
 * registro condiviso: lo riempie `socket.ts` e lo usano stampante e file per
 * annunciare i cambiamenti, senza dipendere dal socket.
 */

export interface DemoConnection {
	/** Manda un messaggio JSON-RPC già pronto al client. */
	push(message: Record<string, unknown>): void;
	/** Chiamato a ogni passo del simulatore, per le notifiche di stato. */
	onTick(): void;
}

export const connections = new Set<DemoConnection>();

/** `notify_*` a tutte le connessioni aperte. */
export function broadcast(method: string, params: unknown[] = []): void {
	for (const connection of connections) {
		connection.push({ jsonrpc: '2.0', method, params });
	}
}
