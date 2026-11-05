import { getMoonrakerApiUrl } from '$lib/services/config';

/**
 * Le impostazioni di GingerView nel database di Moonraker, namespace `gingerview`.
 *
 * È il posto delle impostazioni della **macchina**: telefoni, tablet e computer che si
 * collegano vedono le stesse. Mai in `printer.cfg`, che è la configurazione di Kalico.
 */
const NAMESPACE = 'gingerview';

/**
 * Il valore salvato sotto `key`, o `undefined` se non è mai stato salvato (Moonraker
 * risponde 404). Un errore di rete o di Moonraker viene lanciato: chi chiama decide se
 * riprovare, e una chiave assente non va confusa con una stampante che non risponde.
 */
export async function getDbItem<T = unknown>(key: string): Promise<T | undefined> {
	const url = `${getMoonrakerApiUrl()}/server/database/item?namespace=${NAMESPACE}&key=${encodeURIComponent(key)}`;
	const response = await fetch(url);
	if (response.status === 404) return undefined;
	if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
	const payload = await response.json();
	return payload?.result?.value as T | undefined;
}

/** Salva `value` sotto `key`, sostituendo quello che c'era. */
export async function setDbItem(key: string, value: unknown): Promise<void> {
	const response = await fetch(`${getMoonrakerApiUrl()}/server/database/item`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ namespace: NAMESPACE, key, value })
	});
	if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
}
