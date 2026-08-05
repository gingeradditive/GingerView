import type { MoonrakerFileMetadata } from '$lib/services/moonraker-files';

/**
 * Moonraker's own vocabulary for how a job ended. `in_progress` is the only
 * one still running; everything else is a finished row in the table.
 */
export type HistoryStatus =
	| 'in_progress'
	| 'completed'
	| 'cancelled'
	| 'error'
	| 'klippy_shutdown'
	| 'klippy_disconnect'
	| 'interrupted'
	| 'server_exit';

/** One row of `GET /server/history/list` — a past (or current) print job. */
export interface MoonrakerHistoryJob {
	job_id: string;
	exists: boolean;
	filename: string;
	status: HistoryStatus;
	start_time: number;
	end_time: number;
	print_duration: number;
	total_duration: number;
	filament_used: number;
	metadata?: MoonrakerFileMetadata;
}

export interface MoonrakerHistoryListResult {
	count: number;
	jobs: MoonrakerHistoryJob[];
}
