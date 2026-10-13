/**
 * Formati delle durate, in un posto solo.
 *
 * Due forme, per due domande diverse:
 * - `formatClock` — "01:23:45", il cronometro della stampa in corso: cambia ogni
 *   secondo e le cifre non devono ballare;
 * - `formatDuration` — "1h 05 min", "12 min", "40 s": quanto dura (o è durato)
 *   un lavoro, nella lista file, nella cronologia e nelle statistiche.
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

export function formatDuration(seconds?: number | null): string {
	if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '--';
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	if (h > 0) return `${h}h ${pad2(m)} min`;
	if (m > 0) return `${m} min`;
	return `${Math.round(seconds)} s`;
}
