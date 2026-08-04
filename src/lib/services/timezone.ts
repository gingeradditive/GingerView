import { TIMEZONES, type TimezoneEntry } from '$lib/data/timezones';
import { ServiceError, serviceRequest } from '$lib/services/g2-service';
import { toastActions } from '$lib/stores/toastStore';
import type { TimezoneStatus } from '$lib/types/timezone';

/**
 * Fuso orario di sistema.
 *
 * Moonraker non espone niente per il fuso orario — non è una funzione della
 * stampante, è una funzione dell'host — quindi le due chiamate sono di
 * G2-Service, che gira come root e può chiamare `timedatectl`:
 *
 *     GET  /service/timezone   → { timezone, ntpSynchronized }
 *     POST /service/timezone   ← { timezone }   → stesso shape, dopo l'impostazione
 *
 * Tutto il resto di questo file è calcolo locale: l'elenco delle zone lo genera
 * il client da `zone.tab` di tzdata (`data/timezones.ts`), e il servizio non lo
 * espone apposta.
 */

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

// --- lettura e scrittura ------------------------------------------------------

/**
 * I codici che questi due endpoint possono produrre, tradotti.
 *
 * I messaggi di G2-Service sono in italiano e l'interfaccia è in inglese: il
 * `code` è la parte stabile del contratto, il messaggio no, quindi si passa da
 * lì. Quello del servizio resta come ultima risorsa per i codici imprevisti —
 * meglio una frase nella lingua sbagliata che nessuna informazione.
 */
const TIMEZONE_MESSAGES: Record<string, string> = {
	INVALID_INPUT: 'The printer does not know that timezone.',
	VALIDATION_ERROR: 'That is not a valid timezone identifier.',
	SYSTEM_TOOL_UNAVAILABLE: 'The printer cannot read its clock settings (timedatectl).',
	SERVICE_UNREACHABLE: 'The printer service is not answering.'
};

/** Perché una chiamata sul fuso orario non è andata, in inglese. */
export function describeTimezoneError(error: unknown, fallback: string): string {
	if (error instanceof ServiceError) {
		return TIMEZONE_MESSAGES[error.code] ?? error.message ?? fallback;
	}
	return fallback;
}

/**
 * `GET /service/timezone`.
 *
 * Il dato deve arrivare dall'host e non dal browser: sul kiosk della stampante
 * il browser gira sulla macchina e i due coinciderebbero, ma da telefono
 * `Intl` riporta il fuso del telefono — che è il motivo per cui questa pagina
 * esiste. Se `timedatectl` non risponde arriva un errore
 * (`SYSTEM_TOOL_UNAVAILABLE`) e non un ripiego: un "UTC" inventato sarebbe un
 * dato su cui l'utente potrebbe agire.
 */
export function fetchTimezoneStatus(): Promise<TimezoneStatus> {
	return serviceRequest<TimezoneStatus>('/timezone');
}

/**
 * `POST /service/timezone`, che risponde con lo stato aggiornato.
 *
 * Un fuso che la macchina non conosce è `400 INVALID_INPUT`, uno malformato un
 * `422`. Il toast lo emette questa funzione e non la pagina: il fallimento è lo
 * stesso ovunque si salvi, e chi chiama deve solo sapere che non è andata.
 */
export async function setSystemTimezone(id: string): Promise<TimezoneStatus> {
	try {
		return await serviceRequest<TimezoneStatus>('/timezone', {
			method: 'POST',
			body: JSON.stringify({ timezone: id })
		});
	} catch (error) {
		toastActions.error(
			'network',
			'Timezone not applied',
			describeTimezoneError(error, `The printer did not accept ${id}.`)
		);
		throw error;
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

/**
 * Ora nella zona indicata, in formato 24 ore.
 *
 * `id` nullo significa fuso del browser: è il ripiego di chi mostra un orario
 * prima che il fuso della stampante sia arrivato, o quando non è leggibile —
 * vedi `stores/timezoneStore.ts`. Un identificatore che `Intl` rifiuta dà
 * `--:--` e non l'ora sbagliata.
 */
export function formatZoneTime(
	id: string | null,
	at: Date = new Date(),
	withSeconds = false
): string {
	try {
		return new Intl.DateTimeFormat('en-GB', {
			timeZone: id ?? undefined,
			hourCycle: 'h23',
			hour: '2-digit',
			minute: '2-digit',
			...(withSeconds ? { second: '2-digit' } : {})
		}).format(at);
	} catch {
		return withSeconds ? '--:--:--' : '--:--';
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
