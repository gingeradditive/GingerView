/**
 * Tipi della pagina `/settings/timezone`.
 *
 * Il fuso orario è l'unica impostazione di sistema che GingerView tocca: non
 * lingua, non locale, non formato di data. Serve perché tutti gli orari mostrati
 * (ETA, tempo residuo, cronologia) sono calcolati sull'orologio della macchina,
 * e un Raspberry Pi appena installato è su `Etc/UTC`.
 */

/** Risposta attesa da `GET /api/timezone`. Rispecchia `timedatectl show`. */
export interface TimezoneStatus {
	/** Identificatore IANA attivo sull'host, es. `Europe/Rome`. */
	timezone: string;
	/** `true` se l'orologio è sincronizzato via NTP: se no gli orari non sono affidabili. */
	ntpSynchronized: boolean;
}

/** Corpo di `POST /api/timezone`. */
export interface TimezoneUpdateRequest {
	timezone: string;
}
