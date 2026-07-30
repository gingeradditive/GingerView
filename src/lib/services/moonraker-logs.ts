import { configService } from './config';
import { toastActions } from '$lib/stores/toastStore';

export interface LogFile {
	id: string;
	label: string;
	filename: string;
	// Path appended to `/server/files/`. Klipper (and Moonraker) use Moonraker's legacy,
	// un-rooted alias (`klippy.log`/`moonraker.log`) because it resolves to the real
	// configured log file regardless of its on-disk name — on this fleet Kalico actually
	// writes `kalico.log`, so the rooted path `logs/klippy.log` 404s. Crowsnest has no such
	// alias (Moonraker doesn't manage it), so it must be read from the `logs` root directly.
	path: string;
}

export const LOG_FILES: LogFile[] = [
	{ id: 'klippy', label: 'Klipper', filename: 'klippy.log', path: 'klippy.log' },
	{ id: 'moonraker', label: 'Moonraker', filename: 'moonraker.log', path: 'moonraker.log' },
	{ id: 'crowsnest', label: 'Crowsnest', filename: 'crowsnest.log', path: 'logs/crowsnest.log' }
];

function getApiUrl(): string {
	return configService.getKlipperConfig().moonrakerApiUrl;
}

export async function downloadLog(file: LogFile): Promise<void> {
	const apiUrl = getApiUrl();
	const res = await fetch(`${apiUrl}/server/files/${file.path}`);
	if (!res.ok) {
		const msg = `Failed to download ${file.filename}: ${res.status} ${res.statusText}`;
		toastActions.error('moonraker', 'Download error', msg);
		throw new Error(msg);
	}

	const blob = await res.blob();
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = file.filename;
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
}

// Rolls over every log Moonraker manages (Klipper + Moonraker itself). Crowsnest
// has no rollover mechanism of its own, so its log file is left untouched.
//
// The `application` field is omitted rather than set to "all": on Moonraker v0.10.x
// that literal value is rejected with `400 Unknown application all`. Leaving the key
// out entirely is what actually triggers the "roll over everything" default.
export async function clearLogs(): Promise<void> {
	const apiUrl = getApiUrl();
	const res = await fetch(`${apiUrl}/server/logs/rollover`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({})
	});
	if (!res.ok) {
		const msg = `Failed to clear logs: ${res.status} ${res.statusText}`;
		toastActions.error('moonraker', 'Clear logs error', msg);
		throw new Error(msg);
	}

	const json = await res.json();
	const failed: Record<string, string> = json.result?.failed ?? {};
	const failedNames = Object.keys(failed);
	if (failedNames.length > 0) {
		toastActions.error('moonraker', 'Clear logs', `Failed to clear: ${failedNames.join(', ')}`);
		return;
	}
	toastActions.success(
		'moonraker',
		'Logs cleared',
		'Klipper and Moonraker logs have been rolled over'
	);
}
