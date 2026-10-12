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

/** `GET /machine/system_info` → `result.system_info`. */
export interface CpuInfo {
	cpu_count?: number;
	bits?: string;
	processor?: string;
	cpu_desc?: string;
	hardware_desc?: string;
	model?: string;
	total_memory?: number;
	memory_units?: string;
}

export interface SdInfo {
	manufacturer?: string;
	product_name?: string;
	capacity?: string;
	total_bytes?: number;
}

export interface DistributionInfo {
	name?: string;
	id?: string;
	version?: string;
	codename?: string;
}

export interface NetworkIpAddress {
	family: string;
	address: string;
	is_link_local: boolean;
}

export interface SystemNetworkInterface {
	mac_address?: string;
	ip_addresses?: NetworkIpAddress[];
}

export interface SystemInfo {
	cpu_info?: CpuInfo;
	sd_info?: SdInfo;
	distribution?: DistributionInfo;
	available_services?: string[];
	network?: Record<string, SystemNetworkInterface>;
}

export interface SystemInfoResult {
	system_info: SystemInfo;
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

/** `GET /server/info` → `result`. */
export interface ServerInfoResult {
	klippy_connected: boolean;
	klippy_state: string;
	components?: string[];
	failed_components?: string[];
	warnings?: string[];
	websocket_count?: number;
	moonraker_version?: string;
	api_version_string?: string;
}

export interface StatisticsSnapshot {
	historyTotals: HistoryTotalsResult | null;
	systemInfo: SystemInfoResult | null;
	procStats: ProcStatsResult | null;
	serverInfo: ServerInfoResult | null;
}
