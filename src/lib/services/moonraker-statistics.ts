import { configService } from './config';
import { toastActions } from '$lib/stores/toastStore';
import type {
	HistoryTotalsResult,
	SystemInfoResult,
	ProcStatsResult,
	ServerInfoResult
} from '$lib/types/statistics';

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

export function fetchSystemInfo(): Promise<SystemInfoResult | null> {
	return getResult<SystemInfoResult>('/machine/system_info');
}

export function fetchProcStats(): Promise<ProcStatsResult | null> {
	return getResult<ProcStatsResult>('/machine/proc_stats');
}

export function fetchServerInfo(): Promise<ServerInfoResult | null> {
	return getResult<ServerInfoResult>('/server/info');
}

/** `POST /server/history/totals/reset` — same "start over" Mainsail offers. */
export async function resetHistoryTotals(): Promise<void> {
	const apiUrl = getApiUrl();
	const res = await fetch(`${apiUrl}/server/history/totals/reset`, { method: 'POST' });
	if (!res.ok) {
		const msg = `Failed to reset statistics: ${res.status} ${res.statusText}`;
		toastActions.error('moonraker', 'Reset error', msg);
		throw new Error(msg);
	}
}

/** Job totals durations arrive in seconds, same convention as history entries. */
export function formatDuration(seconds?: number): string {
	if (seconds == null || seconds <= 0) return '--';
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	if (h > 0) return `${h}h ${m.toString().padStart(2, '0')} min`;
	if (m > 0) return `${m} min`;
	return `${Math.round(seconds)} s`;
}

/** `total_memory`/`system_memory` figures from Moonraker are in KiB. */
export function formatKib(kib?: number): string {
	if (kib == null || kib < 0) return '--';
	if (kib >= 1024 * 1024) return `${(kib / (1024 * 1024)).toFixed(1)} GB`;
	if (kib >= 1024) return `${(kib / 1024).toFixed(1)} MB`;
	return `${Math.round(kib)} KB`;
}

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
