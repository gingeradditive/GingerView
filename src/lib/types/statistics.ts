/**
 * Types for the `/settings/statistics` page, sourced from three independent
 * Moonraker endpoints. Every field is optional to read defensively: Moonraker
 * versions and platforms (e.g. non-Raspberry Pi hosts) omit whole sections
 * rather than sending nulls, so a missing key means "not reported here", not
 * an error.
 */

/** `GET /server/history/totals` (and the `POST .../reset` echo). */
export interface JobTotals {
	total_jobs: number;
	total_time: number;
	total_print_time: number;
	total_filament_used: number;
	longest_job: number;
	longest_print: number;
}

export interface HistoryTotalsResult {
	job_totals: JobTotals;
}

/** `GET /machine/proc_stats` → `result`, refreshed periodically while the page is open. */
export interface MoonrakerProcStat {
	time: number;
	cpu_usage: number;
	memory: number;
	mem_units: string;
}

export interface ThrottledState {
	bits: number;
	flags: string[];
}

export interface ProcNetworkInterface {
	rx_bytes: number;
	tx_bytes: number;
	bandwidth?: number;
}

export interface SystemCpuUsage {
	cpu?: number;
	[core: string]: number | undefined;
}

export interface SystemMemory {
	total: number;
	available: number;
	used: number;
}

export interface ProcStatsResult {
	moonraker_stats?: MoonrakerProcStat[];
	throttled_state?: ThrottledState;
	cpu_temp?: number;
	network?: Record<string, ProcNetworkInterface>;
	system_cpu_usage?: SystemCpuUsage;
	system_memory?: SystemMemory;
	websocket_connections?: number;
}

/** `GET /server/files/directory?path=gcodes` → `result.disk_usage`, in bytes. */
export interface DiskUsage {
	total: number;
	used: number;
	free: number;
}
