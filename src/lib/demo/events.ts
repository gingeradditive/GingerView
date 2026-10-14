/**
 * Eventi osservabili della stampante simulata.
 *
 * Servono oggi al livello demo (etichetta "tempo accelerato", avvisi a fine
 * stampa) e domani alle missioni di orientamento della fase 2: "avvia la tua
 * prima stampa" è un `print:start`, senza dover rileggere lo stato.
 */

export type DemoEvents = {
	'print:start': { filename: string };
	'print:phase': { filename: string; phase: 'heating' | 'printing' };
	'print:pause': { filename: string };
	'print:resume': { filename: string };
	'print:complete': { filename: string };
	'print:cancel': { filename: string };
	gcode: { script: string };
	'klippy:shutdown': Record<string, never>;
	'klippy:ready': Record<string, never>;
};

type Listener<K extends keyof DemoEvents> = (payload: DemoEvents[K]) => void;

const listeners = new Map<keyof DemoEvents, Set<Listener<never>>>();

/** Si iscrive a un evento; il ritorno disiscrive. */
export function on<K extends keyof DemoEvents>(event: K, listener: Listener<K>): () => void {
	let set = listeners.get(event);
	if (!set) {
		set = new Set();
		listeners.set(event, set);
	}
	set.add(listener as Listener<never>);
	return () => set.delete(listener as Listener<never>);
}

export function emit<K extends keyof DemoEvents>(event: K, payload: DemoEvents[K]): void {
	for (const listener of listeners.get(event) ?? []) {
		try {
			(listener as Listener<K>)(payload);
		} catch (error) {
			console.error(`[demo] listener of ${event} failed`, error);
		}
	}
}
