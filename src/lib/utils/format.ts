/**
 * Formati delle durate, in un posto solo.
 *
 * Due forme, per due domande diverse:
 * - `formatClock` — "01:23:45", il cronometro della stampa in corso: cambia ogni
 *   secondo e le cifre non devono ballare; `formatClockHM` — "01:23", il tempo che
 *   manca, senza secondi;
 * - `formatDuration` — "1h 05 min", "12 min", "40 s": quanto dura (o è durato)
 *   un lavoro, nella lista file, nella cronologia e nelle statistiche;
 * - `formatElapsed` — "12s", "3m", "1h 04m": da quanto dura un guasto (dati fermi,
 *   stampante irraggiungibile). Abbastanza per capire se è un blip o un guasto.
 *
 * Prima c'erano tre copie con piccole differenze (una mostrava "0 min" per un
 * lavoro di 40 secondi, l'altra "40 s").
 */

const pad2 = (value: number): string => value.toString().padStart(2, '0');

export function formatClock(seconds?: number | null): string {
	// 0 è "nessuna stampa" (print_stats a riposo), non un cronometro appena partito.
	if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '--:--:--';
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);
	return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

/**
 * "01:23", ore e minuti, per i tempi della stampa in corso: i secondi lì sono solo
 * rumore. `up` per il tempo che manca (l'ultimo minuto si legge "00:01", non "00:00"
 * con la stampa ancora in corso), `down` per quello trascorso.
 */
export function formatClockHM(seconds?: number | null, round: 'up' | 'down' = 'up'): string {
	if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '--:--';
	const minutes = round === 'up' ? Math.ceil(seconds / 60) : Math.floor(seconds / 60);
	return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;
}

export function formatDuration(seconds?: number | null): string {
	if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '--';
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	if (h > 0) return `${h}h ${pad2(m)}min`;
	if (m > 0) return `${m}min`;
	return `${Math.round(seconds)}s`;
}

export function formatElapsed(ms: number): string {
	const seconds = Math.max(0, Math.floor(ms / 1000));
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	return `${hours}h ${pad2(minutes % 60)}m`;
}
