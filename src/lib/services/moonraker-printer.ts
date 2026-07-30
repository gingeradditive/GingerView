import { configService } from './config';
import { toastActions } from '$lib/stores/toastStore';

/**
 * Printer-level commands that belong to no single page: the emergency stop in
 * the dock and the three restarts the config editor offers.
 *
 * They live together because they are two halves of the same story — an
 * emergency stop leaves Klippy in `shutdown`, and the only way back is a
 * firmware restart, which is exactly what the dock button turns into.
 */

function getApiUrl(): string {
	return configService.getKlipperConfig().moonrakerApiUrl;
}

// --- emergency stop ----------------------------------------------------------

/**
 * `POST /printer/emergency_stop` — the same call Mainsail's red button makes.
 *
 * Klipper cuts the heaters and the steppers and drops into `shutdown`; it does
 * not come back on its own. Unlike a restart this does **not** kill Moonraker,
 * so the response is trustworthy and a failure is a real failure: the toast has
 * to say so loudly, because whoever pressed the button believes the machine is
 * stopping.
 *
 * The physical emergency stop on the machine remains the safety device — this
 * is a convenience for whoever is holding a phone instead.
 */
export async function emergencyStop(): Promise<void> {
	let res: Response;
	try {
		res = await fetch(`${getApiUrl()}/printer/emergency_stop`, { method: 'POST' });
	} catch {
		const msg = 'Could not reach Moonraker. Use the physical emergency stop on the machine.';
		toastActions.error('klipper', 'Emergency stop failed', msg, 0);
		throw new Error(msg);
	}

	if (!res.ok) {
		const msg = `Moonraker refused the stop (${res.status} ${res.statusText}). Use the physical emergency stop on the machine.`;
		toastActions.error('klipper', 'Emergency stop failed', msg, 0);
		throw new Error(msg);
	}
}

// --- restarts ----------------------------------------------------------------

export type RestartTarget = 'firmware' | 'host' | 'moonraker';

interface RestartInfo {
	label: string;
	endpoint: string;
	description: string;
}

/**
 * The three restarts Mainsail offers, with the same default: `FIRMWARE_RESTART`
 * is the one that also reloads the MCU configuration, so it is what actually
 * applies most edits to `printer.cfg`. A host restart only reloads Klippy.
 * Moonraker's own restart is a different service entirely, needed for
 * `moonraker.conf`.
 */
export const RESTART_TARGETS: Record<RestartTarget, RestartInfo> = {
	firmware: {
		label: 'Firmware restart',
		endpoint: '/printer/firmware_restart',
		description: 'Restarts Klipper and the MCUs, reloading the printer configuration'
	},
	host: {
		label: 'Host restart',
		endpoint: '/printer/restart',
		description: 'Reloads Klipper on the host only, without resetting the MCUs'
	},
	moonraker: {
		label: 'Moonraker restart',
		endpoint: '/server/restart',
		description: 'Restarts the Moonraker service, needed after editing moonraker.conf'
	}
};

/**
 * Asks for a restart and does not insist on a clean answer.
 *
 * All three endpoints kill the very connection that is serving the request: the
 * fetch can fail, or hang and then fail, even though the restart was accepted.
 * Treating that as an error would report a failure that did not happen, so the
 * caller instead confirms the outcome by watching `/printer/info` come back —
 * see `waitForKlipperReady()`.
 */
export async function requestRestart(target: RestartTarget): Promise<void> {
	const { endpoint } = RESTART_TARGETS[target];
	try {
		await fetch(`${getApiUrl()}${endpoint}`, { method: 'POST' });
	} catch {
		// Connection dropped as the service went down — expected.
	}
}

export interface PrinterInfo {
	state: string;
	stateMessage: string;
}

/**
 * `print_stats.state`, or `''` when it cannot be read. Used to refuse a restart
 * while a job is running: Klipper happily accepts `FIRMWARE_RESTART` mid-print
 * and loses the job, so the guard has to live in the interface.
 */
export async function fetchPrintState(): Promise<string> {
	try {
		const res = await fetch(`${getApiUrl()}/printer/objects/query?print_stats`);
		if (!res.ok) return '';
		const json = await res.json();
		return json.result?.status?.print_stats?.state ?? '';
	} catch {
		return '';
	}
}

/** `GET /printer/info`, or `null` when Moonraker/Klippy cannot be reached. */
export async function fetchPrinterInfo(): Promise<PrinterInfo | null> {
	try {
		const res = await fetch(`${getApiUrl()}/printer/info`);
		if (!res.ok) return null;
		const json = await res.json();
		return {
			state: json.result?.state ?? '',
			stateMessage: json.result?.state_message ?? ''
		};
	} catch {
		return null;
	}
}

/**
 * Polls `/printer/info` until Klippy reports something final.
 *
 * `startup` is transient, and while the service is down the request fails
 * outright, so both are treated as "keep waiting". Returns the last known info,
 * or `null` if nothing answered before the timeout — an `error` state with its
 * `state_message` is the useful case, since that is where a bad config surfaces.
 */
export async function waitForKlipperReady(timeoutMs = 90000): Promise<PrinterInfo | null> {
	const pollMs = 2000;
	const deadline = Date.now() + timeoutMs;
	let last: PrinterInfo | null = null;

	while (Date.now() < deadline) {
		await new Promise((resolve) => setTimeout(resolve, pollMs));
		const info = await fetchPrinterInfo();
		if (info) {
			last = info;
			if (info.state !== 'startup') return info;
		}
	}
	return last;
}
