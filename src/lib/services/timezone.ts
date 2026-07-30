import { TIMEZONES, type TimezoneEntry } from '$lib/data/timezones';
import { toastActions } from '$lib/stores/toastStore';
import type { TimezoneStatus } from '$lib/types/timezone';

/**
 * Fuso orario di sistema.
 *
 * **Il backend non esiste ancora.** Moonraker non espone niente per il fuso
 * orario (non è una funzione della stampante, è una funzione dell'host), quindi
 * l'endpoint andrà nel servizio di rete già presente sulla porta 8000 — lo
 * stesso di `network-api.ts` — che gira come root e può chiamare `timedatectl`:
 *
 *     GET  /api/timezone   → { timezone, ntpSynchronized }
 *     POST /api/timezone   ← { timezone }
 *
 * Finché non c'è, `fetchTimezoneStatus()` e `setSystemTimezone()` sono **mock**:
 * la lettura ricava il fuso dal browser e la scrittura lo ricorda in
 * `localStorage` senza toccare l'orologio della macchina. Vedi `SET-9` in
 * docs/TODO.md. Quando l'endpoint arriverà va sostituito solo il corpo di quelle
 * due funzioni: tutto il resto di questo file è calcolo locale e resta valido.
 */

/** Chiave di `localStorage` usata dal mock. Sparisce insieme al mock. */
const MOCK_STORAGE_KEY = 'gingerview.mock.timezone';
/** Latenza finta, così l'interfaccia mostra davvero i suoi stati di attesa. */
const MOCK_LATENCY_MS = 500;

/**
 * `zone.tab` non contiene UTC, ma `timedatectl set-timezone UTC` lo accetta ed è
 * il valore predefinito di Raspberry Pi OS: va offerto in cima all'elenco.
 */
export const UTC_ZONE: TimezoneEntry = {
	id: 'UTC',
	country: 'Coordinated Universal Time',
	countryCode: '',
	lat: 0,
	lon: 0
};

export const ALL_TIMEZONES: TimezoneEntry[] = [UTC_ZONE, ...TIMEZONES];

// --- lettura e scrittura (mock) ----------------------------------------------

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * MOCK di `GET /api/timezone`.
 *
 * Legge il valore salvato dal mock; in mancanza usa quello del browser. Sul
 * kiosk della stampante il browser gira sull'host, quindi il fuso che riporta è
 * davvero quello di sistema — ma da telefono è il fuso del telefono, ed è
 * esattamente il motivo per cui questo dato deve arrivare dall'host.
 */
export async function fetchTimezoneStatus(): Promise<TimezoneStatus> {
	await delay(MOCK_LATENCY_MS);

	const stored =
		typeof localStorage !== 'undefined' ? localStorage.getItem(MOCK_STORAGE_KEY) : null;
	return {
		timezone: stored ?? getBrowserTimezone(),
		ntpSynchronized: true
	};
}

/**
 * MOCK di `POST /api/timezone`.
 *
 * Non cambia l'orologio di nessuno: memorizza la scelta perché la pagina la
 * ritrovi al ricaricamento. Rifiuta un identificatore che `Intl` non riconosce,
 * come farà il backend vero con uno che `timedatectl` non accetta.
 */
export async function setSystemTimezone(id: string): Promise<void> {
	await delay(MOCK_LATENCY_MS);

	if (!isValidTimezone(id)) {
		const msg = `Unknown timezone: ${id}`;
		toastActions.error('network', 'Timezone not applied', msg);
		throw new Error(msg);
	}

	if (typeof localStorage !== 'undefined') localStorage.setItem(MOCK_STORAGE_KEY, id);
}

export function getBrowserTimezone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
	} catch {
		return 'UTC';
	}
}

function isValidTimezone(id: string): boolean {
	try {
		new Intl.DateTimeFormat('en-GB', { timeZone: id });
		return true;
	} catch {
		return false;
	}
}

// --- elenco ------------------------------------------------------------------

export function findZone(id: string): TimezoneEntry | undefined {
	return ALL_TIMEZONES.find((zone) => zone.id === id);
}

/** Ultimo segmento dell'identificatore: `America/New_York` → `New York`. */
export function getCityLabel(id: string): string {
	const last = id.split('/').pop() ?? id;
	return last.replace(/_/g, ' ');
}

/**
 * Riga di dettaglio sotto il nome della città. Per le zone che hanno un segmento
 * intermedio (`America/Argentina/Buenos_Aires`) il paese da solo non basta a
 * capire dove si è, quindi si mostra anche l'area.
 */
export function getZoneDetail(zone: TimezoneEntry): string {
	const segments = zone.id.split('/');
	const region = segments[0].replace(/_/g, ' ');
	if (zone.id === 'UTC') return zone.country;
	return `${zone.country} · ${region}`;
}

function normalize(text: string): string {
	return text
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[_/]/g, ' ')
		.toLowerCase();
}

/**
 * Ricerca su città, paese e identificatore completo. I risultati che *iniziano*
 * con quanto digitato vengono prima: cercando "rom" si vuole Roma, non
 * Montenegro. A parità di rilevanza resta l'ordine alfabetico dell'elenco.
 */
export function searchTimezones(query: string): TimezoneEntry[] {
	const needle = normalize(query).trim();
	if (!needle) return ALL_TIMEZONES;

	const matches: { zone: TimezoneEntry; rank: number }[] = [];
	for (const zone of ALL_TIMEZONES) {
		const city = normalize(getCityLabel(zone.id));
		const haystack = `${normalize(zone.id)} ${normalize(zone.country)}`;

		if (city.startsWith(needle)) matches.push({ zone, rank: 0 });
		else if (city.includes(needle)) matches.push({ zone, rank: 1 });
		else if (haystack.includes(needle)) matches.push({ zone, rank: 2 });
	}

	return matches.sort((a, b) => a.rank - b.rank).map((match) => match.zone);
}

// --- ora e offset ------------------------------------------------------------

/**
 * Scarto da UTC in minuti, ora legale compresa.
 *
 * Ricavato confrontando la data formattata nella zona con l'istante di partenza,
 * invece che leggendo `timeZoneName: 'longOffset'`: il risultato è numerico e non
 * dipende da come il browser scrive "GMT+02:00".
 */
export function getOffsetMinutes(id: string, at: Date = new Date()): number {
	try {
		const parts = new Intl.DateTimeFormat('en-GB', {
			timeZone: id,
			hourCycle: 'h23',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		}).formatToParts(at);

		const field = (type: Intl.DateTimeFormatPartTypes) =>
			Number(parts.find((part) => part.type === type)?.value);

		const asUtc = Date.UTC(
			field('year'),
			field('month') - 1,
			field('day'),
			field('hour'),
			field('minute'),
			field('second')
		);
		// I millisecondi non compaiono fra le parti formattate: si troncano da
		// entrambi i lati, altrimenti l'offset oscilla di un minuto.
		return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
	} catch {
		return 0;
	}
}

/** `120` → `UTC+02:00`, `-210` → `UTC−03:30`, `0` → `UTC`. */
export function formatOffset(minutes: number): string {
	if (minutes === 0) return 'UTC';
	const sign = minutes < 0 ? '−' : '+';
	const absolute = Math.abs(minutes);
	const hours = String(Math.floor(absolute / 60)).padStart(2, '0');
	const rest = String(absolute % 60).padStart(2, '0');
	return `UTC${sign}${hours}:${rest}`;
}

/** Ora corrente nella zona, in formato 24 ore. */
export function formatZoneTime(id: string, at: Date = new Date()): string {
	try {
		return new Intl.DateTimeFormat('en-GB', {
			timeZone: id,
			hourCycle: 'h23',
			hour: '2-digit',
			minute: '2-digit'
		}).format(at);
	} catch {
		return '--:--';
	}
}

/** Data corrente nella zona, es. `Thu 30 Jul 2026`. */
export function formatZoneDate(id: string, at: Date = new Date()): string {
	try {
		return new Intl.DateTimeFormat('en-GB', {
			timeZone: id,
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		}).format(at);
	} catch {
		return '';
	}
}
