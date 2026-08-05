import { configService } from './config';
import { toastActions } from '$lib/stores/toastStore';
import { getThumbnailUrl } from './moonraker-files';
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
