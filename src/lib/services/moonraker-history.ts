import { configService } from './config';
import { toastActions } from '$lib/stores/toastStore';
import { getFilamentType, getThumbnailUrl } from './moonraker-files';
import type { MoonrakerHistoryJob, MoonrakerHistoryListResult } from '$lib/types/history';

function getApiUrl(): string {
	return configService.getKlipperConfig().moonrakerApiUrl;
}

export async function fetchHistoryList(
	limit: number,
	start: number = 0
): Promise<MoonrakerHistoryListResult> {
	const apiUrl = getApiUrl();
	const params = new URLSearchParams({
		limit: String(limit),
		start: String(start),
		order: 'desc'
	});
	const res = await fetch(`${apiUrl}/server/history/list?${params}`);
	if (!res.ok) {
		const msg = `Failed to fetch print history: ${res.status} ${res.statusText}`;
		toastActions.error('moonraker', 'History error', msg);
		throw new Error(msg);
	}
	const json = await res.json();
	return json.result;
}

export async function deleteHistoryJob(jobId: string): Promise<void> {
	const apiUrl = getApiUrl();
	const res = await fetch(`${apiUrl}/server/history/job?uid=${encodeURIComponent(jobId)}`, {
		method: 'DELETE'
	});
	if (!res.ok) {
		const msg = `Failed to delete history entry: ${res.status} ${res.statusText}`;
		toastActions.error('moonraker', 'Delete error', msg);
		throw new Error(msg);
	}
}

export async function deleteAllHistory(): Promise<void> {
	const apiUrl = getApiUrl();
	const res = await fetch(`${apiUrl}/server/history/job?all=true`, { method: 'DELETE' });
	if (!res.ok) {
		const msg = `Failed to clear print history: ${res.status} ${res.statusText}`;
		toastActions.error('moonraker', 'Delete error', msg);
		throw new Error(msg);
	}
}

/**
 * Job thumbnails point at a path relative to the gcode file's own directory,
 * same as file-list metadata — reuses `getThumbnailUrl` with the job's
 * directory instead of the currently browsed one.
 */
export function getHistoryThumbnailUrl(job: MoonrakerHistoryJob): string | undefined {
	if (!job.metadata?.thumbnails?.length) return undefined;
	const slash = job.filename.lastIndexOf('/');
	const dirPath = slash === -1 ? 'gcodes' : `gcodes/${job.filename.slice(0, slash)}`;
	return getThumbnailUrl(
		{ filename: job.filename, modified: 0, size: 0, thumbnails: job.metadata.thumbnails },
		dirPath
	);
}

/** `filament_used` from Moonraker is in millimeters. */
export function formatFilamentUsed(mm: number): string {
	if (!mm || mm <= 0) return '--';
	if (mm >= 1000) return `${(mm / 1000).toFixed(2)} m`;
	return `${Math.round(mm)} mm`;
}

/**
 * Densità in g/cm³ dei materiali più comuni. Il materiale arriva dai metadati dello slicer;
 * se manca o non è in elenco vale quella del PLA.
 */
const MATERIAL_DENSITY: Record<string, number> = {
	PLA: 1.24,
	PETG: 1.27,
	PET: 1.38,
	ABS: 1.04,
	ASA: 1.07,
	HIPS: 1.04,
	TPU: 1.21,
	PP: 0.9,
	PE: 0.95,
	PA: 1.14,
	PC: 1.2
};
const DEFAULT_DENSITY = MATERIAL_DENSITY.PLA;

/**
 * Il materiale usato da un lavoro, in kg. La G2 va a pellet: `filament_diameter` è 1.1284,
 * cioè 1 mm² di sezione, quindi ogni mm di "filamento" è 1 mm³ di materiale.
 * kg = mm³ × g/cm³ / 1 000 000.
 */
export function formatMaterialKg(job: MoonrakerHistoryJob): string {
	return formatMaterialKgFromMm(
		job.filament_used,
		job.metadata ? getFilamentType(job.metadata) : undefined
	);
}

/** Come `formatMaterialKg`, partendo dai mm. Senza materiale vale la densità del PLA. */
export function formatMaterialKgFromMm(mm: number, material?: string): string {
	if (!mm || mm <= 0) return '--';
	const kg = materialKgFromMm(mm, material);
	return `${kg < 0.01 ? kg.toFixed(3) : kg.toFixed(2)} kg`;
}

/** I kg di materiale da una lunghezza in mm (1 mm = 1 mm³ sulla G2). */
export function materialKgFromMm(mm: number, material?: string): number {
	const density = (material && MATERIAL_DENSITY[material]) || DEFAULT_DENSITY;
	return (mm * density) / 1_000_000;
}

/** La data di inizio divisa in due righe: giorno sopra, ora sotto. */
export function formatHistoryDateParts(
	epochSeconds: number,
	tzId: string | null
): { day: string; time: string } {
	if (!epochSeconds) return { day: '--', time: '' };
	try {
		const date = new Date(epochSeconds * 1000);
		const timeZone = tzId ?? undefined;
		return {
			day: new Intl.DateTimeFormat('en-GB', {
				timeZone,
				day: '2-digit',
				month: 'short',
				year: 'numeric'
			}).format(date),
			time: new Intl.DateTimeFormat('en-GB', {
				timeZone,
				hour: '2-digit',
				minute: '2-digit',
				hourCycle: 'h23'
			}).format(date)
		};
	} catch {
		return { day: '--', time: '' };
	}
}

/**
 * `tzId` null falls back to the browser's own timezone — same convention as
 * `formatZoneTime`/`formatZoneDate` in `services/timezone.ts`.
 */
export function formatHistoryDate(epochSeconds: number, tzId: string | null): string {
	if (!epochSeconds) return '--';
	try {
		return new Intl.DateTimeFormat('en-GB', {
			timeZone: tzId ?? undefined,
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			hourCycle: 'h23'
		}).format(new Date(epochSeconds * 1000));
	} catch {
		return '--';
	}
}
