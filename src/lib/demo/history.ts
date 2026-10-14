import catalog from './files/catalog.json';
import { broadcast } from './notify';
import { getMetadata, updateMetadata } from './storage';

/**
 * Lo storico delle stampe: precompilato con qualche settimana di lavoro della
 * macchina, poi arricchito dalle stampe del visitatore.
 *
 * I tempi delle stampe precompilate sono quelli **reali** dei file (14 h, non
 * 3 minuti): lo storico è un'informazione commerciale. Le stampe fatte nella
 * demo registrano invece il tempo accelerato che l'interfaccia ha mostrato.
 */

type HistoryJob = {
	job_id: string;
	exists: boolean;
	filename: string;
	status: string;
	start_time: number;
	end_time: number | null;
	print_duration: number;
	total_duration: number;
	filament_used: number;
	metadata: Record<string, unknown>;
};

const jobs: HistoryJob[] = [];
let nextId = 0x2a10;

const totals = {
	total_jobs: 0,
	total_time: 0,
	total_print_time: 0,
	total_filament_used: 0,
	longest_job: 0,
	longest_print: 0
};

function addToTotals(job: HistoryJob): void {
	totals.total_jobs += 1;
	totals.total_time += job.total_duration;
	totals.total_print_time += job.print_duration;
	totals.total_filament_used += job.filament_used;
	totals.longest_job = Math.max(totals.longest_job, job.total_duration);
	totals.longest_print = Math.max(totals.longest_print, job.print_duration);
}

const newId = (): string => (nextId++).toString(16).padStart(6, '0').toUpperCase();

/**
 * Le stampe passate: per ogni file del catalogo una o due, distribuite sulle
 * ultime tre settimane, quasi tutte riuscite e una annullata — come una
 * macchina vera.
 */
function seed(): void {
	const files = (catalog as { path: string }[]).map((entry) => entry.path);
	if (files.length === 0) return;

	const now = Date.now() / 1000;
	let cursor = now - 21 * 86400;
	const plan = [...files, ...files].slice(0, 10);

	plan.forEach((filename, index) => {
		const metadata = getMetadata(filename) ?? {};
		const estimated = Number(metadata.estimated_time ?? 3600);
		const cancelled = index === 6;
		const ratio = cancelled ? 0.35 : 0.97 + ((index * 7) % 9) / 100;
		const printDuration = Math.round(estimated * ratio);
		const totalDuration = printDuration + 600 + ((index * 131) % 900);

		const start = cursor;
		cursor += totalDuration + 3600 * (4 + ((index * 5) % 20));
		if (cursor > now - 86400) cursor = now - 86400;

		const job: HistoryJob = {
			job_id: newId(),
			exists: true,
			filename,
			status: cancelled ? 'cancelled' : 'completed',
			start_time: start,
			end_time: start + totalDuration,
			print_duration: printDuration,
			total_duration: totalDuration,
			filament_used: Math.round(Number(metadata.filament_total ?? 0) * ratio),
			metadata
		};
		jobs.push(job);
		addToTotals(job);
		updateMetadata(filename, {
			job_id: job.job_id,
			print_start_time: start,
			last_print_duration: printDuration
		});
	});

	// Qualche centinaio di ore prima dello storico visibile: la macchina non è nuova.
	totals.total_jobs += 37;
	totals.total_time += 412 * 3600;
	totals.total_print_time += 388 * 3600;
	totals.total_filament_used += 96_000_000;
}

seed();

/** `GET /server/history/list`, dal più recente. */
export function listJobs(start: number, limit: number): { count: number; jobs: HistoryJob[] } {
	const sorted = [...jobs].sort((a, b) => b.start_time - a.start_time);
	return { count: sorted.length, jobs: sorted.slice(start, start + limit) };
}

export function getJob(id: string): HistoryJob | undefined {
	return jobs.find((job) => job.job_id === id);
}

/** Una stampa appena partita: compare subito come `in_progress`. */
export function startJob(filename: string): string {
	const job: HistoryJob = {
		job_id: newId(),
		exists: true,
		filename,
		status: 'in_progress',
		start_time: Date.now() / 1000,
		end_time: null,
		print_duration: 0,
		total_duration: 0,
		filament_used: 0,
		metadata: getMetadata(filename) ?? {}
	};
	jobs.push(job);
	updateMetadata(filename, { job_id: job.job_id, print_start_time: job.start_time });
	broadcast('notify_history_changed', [{ action: 'added', job }]);
	return job.job_id;
}

export function finishJob(
	id: string,
	status: string,
	values: { print_duration: number; total_duration: number; filament_used: number }
): void {
	const job = getJob(id);
	if (!job) return;
	Object.assign(job, values, { status, end_time: Date.now() / 1000 });
	addToTotals(job);
	updateMetadata(job.filename, { last_print_duration: job.print_duration });
	broadcast('notify_history_changed', [{ action: 'finished', job }]);
}

export function deleteJob(id: string): string[] {
	const index = jobs.findIndex((job) => job.job_id === id);
	if (index === -1) return [];
	jobs.splice(index, 1);
	return [id];
}

export function deleteAll(): string[] {
	// Una stampa in corso resta: Moonraker non cancella il job attivo.
	const removed = jobs.filter((job) => job.status !== 'in_progress').map((job) => job.job_id);
	for (let i = jobs.length - 1; i >= 0; i--) {
		if (jobs[i].status !== 'in_progress') jobs.splice(i, 1);
	}
	return removed;
}

export function getTotals(): { job_totals: typeof totals } {
	return { job_totals: { ...totals } };
}

export function resetTotals(): { last_totals: typeof totals } {
	const last = { ...totals };
	for (const key of Object.keys(totals) as (keyof typeof totals)[]) totals[key] = 0;
	return { last_totals: last };
}
