import { writable } from 'svelte/store';
import { getMoonrakerApiUrl } from '$lib/services/config';
import { toastActions } from '$lib/stores/toastStore';

/**
 * Modalità dell'interfaccia: semplice o avanzata, scelta da `/settings`.
 *
 * Vive nel database di Moonraker (namespace `gingerview`), non nel browser: è
 * un'impostazione della **macchina**, quindi telefoni, tablet e computer che si
 * collegano devono vedere la stessa. Per ora nessuna pagina la legge — il
 * selettore esiste e la scelta viene salvata, il comportamento arriverà dopo.
 *
 * L'interfaccia com'è oggi **è** la modalità semplice, ed è il default: la
 * modalità avanzata aggiungerà funzioni, non ne toglierà a chi non la sceglie.
 */
export type UiMode = 'simple' | 'advanced';

const DEFAULT_MODE: UiMode = 'simple';
const DB_NAMESPACE = 'gingerview';
const DB_KEY = 'ui_mode';

export const uiMode = writable<UiMode>(DEFAULT_MODE);

const isUiMode = (value: unknown): value is UiMode => value === 'simple' || value === 'advanced';

const itemUrl = (): string =>
	`${getMoonrakerApiUrl()}/server/database/item?namespace=${DB_NAMESPACE}&key=${DB_KEY}`;

let inFlight: Promise<void> | null = null;
let loaded = false;

/**
 * Legge la modalità salvata, una volta sola per sessione (stesso schema di
 * `ensurePrinterTimezone`). Una chiave mancante — 404, mai salvata — lascia il
 * default; un errore non viene memorizzato, così il prossimo montaggio riprova.
 */
export function ensureUiMode(): Promise<void> {
	if (loaded) return Promise.resolve();
	if (!inFlight) {
		inFlight = fetch(itemUrl())
			.then(async (response) => {
				if (response.status === 404) {
					loaded = true;
					return;
				}
				if (!response.ok) return;
				const payload = await response.json();
				const value = payload?.result?.value;
				if (isUiMode(value)) uiMode.set(value);
				loaded = true;
			})
			.catch(() => {
				// Moonraker non risponde: resta il default.
			})
			.finally(() => {
				inFlight = null;
			});
	}
	return inFlight;
}

/**
 * Cambia modalità subito a schermo e la salva sulla stampante. Se il
 * salvataggio fallisce torna alla precedente e lo dice: un selettore che
 * mostra una scelta che la macchina non ha registrato mentirebbe.
 */
export async function setUiMode(mode: UiMode, previous: UiMode): Promise<void> {
	uiMode.set(mode);
	loaded = true;
	try {
		const response = await fetch(`${getMoonrakerApiUrl()}/server/database/item`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ namespace: DB_NAMESPACE, key: DB_KEY, value: mode })
		});
		if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
	} catch (error) {
		uiMode.set(previous);
		toastActions.error(
			'klipper',
			'Could not save the interface mode',
			error instanceof Error ? error.message : 'Moonraker is unreachable'
		);
	}
}
