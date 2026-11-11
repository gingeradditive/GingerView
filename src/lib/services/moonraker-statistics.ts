import { configService } from './config';
import type { DiskUsage, HistoryTotalsResult, ProcStatsResult } from '$lib/types/statistics';

function getApiUrl(): string {
	return configService.getKlipperConfig().moonrakerApiUrl;
}

async function getResult<T>(path: string): Promise<T | null> {
	try {
		const res = await fetch(`${getApiUrl()}${path}`);
		if (!res.ok) return null;
		const json = await res.json();
		return json.result ?? null;
	} catch {
		return null;
	}
}

export function fetchHistoryTotals(): Promise<HistoryTotalsResult | null> {
	return getResult<HistoryTotalsResult>('/server/history/totals');
}

/** Lo spazio del disco dove stanno i file di stampa, in byte. */
export async function fetchDiskUsage(): Promise<DiskUsage | null> {
	const result = await getResult<{ disk_usage?: DiskUsage }>('/server/files/directory?path=gcodes');
	return result?.disk_usage ?? null;
}

export function fetchProcStats(): Promise<ProcStatsResult | null> {
	return getResult<ProcStatsResult>('/machine/proc_stats');
}

/** Job totals durations arrive in seconds, same convention as history entries. */
export { formatDuration } from '$lib/utils/format';

export function formatBytes(bytes?: number): string {
	if (bytes == null || bytes < 0) return '--';
	if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
	if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
	if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${bytes} B`;
}

export function formatPercent(value?: number): string {
	if (value == null) return '--';
	return `${value.toFixed(1)}%`;
}

export function formatTemp(celsius?: number): string {
	if (celsius == null) return '--';
	return `${celsius.toFixed(1)} °C`;
}
