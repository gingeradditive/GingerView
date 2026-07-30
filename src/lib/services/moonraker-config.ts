import { configService } from './config';
import { toastActions } from '$lib/stores/toastStore';
import { fetchDirectory } from './moonraker-files';

/**
 * Client for the config editor (`/settings/config-editor`).
 *
 * Moonraker exposes the printer's configuration folder as the `config` file root,
 * so browsing and editing it is the same file API used for G-code — there is no
 * dedicated "config" endpoint. Reading a file is a plain download, writing it is
 * an upload that overwrites the existing one.
 *
 * The `config` root is the only writable root besides `gcodes`, and it can be
 * configured read-only in `moonraker.conf`; `fetchConfigDirectory()` reports what
 * `root_info.permissions` says so the page can lock itself down instead of
 * failing on save.
 *
 * This is a development page, meant to be switched off once machines ship with a
 * finished configuration — see `CONFIG_EDITOR_ENABLED`.
 */

export const CONFIG_ROOT = 'config';

/**
 * Master switch for the whole feature. Set to `false` to hide the Settings entry
 * and turn the page into a notice: editing `printer.cfg` from the touchscreen is
 * a development convenience, not something an operator should reach.
 */
export const CONFIG_EDITOR_ENABLED = true;

export interface ConfigEntry {
	name: string;
	/** Full Moonraker path, root included — `config/macros/park.cfg`. */
	path: string;
	isDirectory: boolean;
	modified: number;
	size: number;
}

export interface ConfigDirectory {
	entries: ConfigEntry[];
	/** `false` when Moonraker serves the config root read-only. */
	writable: boolean;
}

/**
 * One row of the tree. `children` is `null` until the folder is expanded for the
 * first time, which is what makes the listing lazy: an unopened folder costs
 * nothing.
 */
export interface ConfigTreeNode {
	entry: ConfigEntry;
	children: ConfigTreeNode[] | null;
	expanded: boolean;
}

export function toTreeNodes(entries: ConfigEntry[]): ConfigTreeNode[] {
	return entries.map((entry) => ({ entry, children: null, expanded: false }));
}

/** Depth-first search by full path, for re-reading a folder after a change. */
export function findTreeNode(nodes: ConfigTreeNode[], path: string): ConfigTreeNode | null {
	for (const node of nodes) {
		if (node.entry.path === path) return node;
		if (node.children) {
			const found = findTreeNode(node.children, path);
			if (found) return found;
		}
	}
	return null;
}

function getApiUrl(): string {
	return configService.getKlipperConfig().moonrakerApiUrl;
}

/**
 * Encodes each segment on its own, so slashes keep separating directories
 * instead of turning into `%2F` (same reasoning as `moonraker-files.ts`).
 */
function encodePath(path: string): string {
	return path.split('/').map(encodeURIComponent).join('/');
}

function byName(a: ConfigEntry, b: ConfigEntry): number {
	return a.name.localeCompare(b.name);
}

/**
 * Lists one directory of the config root — not the whole tree. The page expands
 * folders on demand, which keeps a nested config layout (`macros/`, `hardware/`,
 * the `.moonraker_backup` copies) to one request per folder actually opened.
 */
export async function fetchConfigDirectory(path: string = CONFIG_ROOT): Promise<ConfigDirectory> {
	const result = await fetchDirectory(path);

	// Dot-entries are Moonraker's own bookkeeping (`.klipper_backup`, `.git`),
	// never something to edit by hand.
	const dirs: ConfigEntry[] = result.dirs
		.filter((d) => !d.dirname.startsWith('.'))
		.map((d) => ({
			name: d.dirname,
			path: `${path}/${d.dirname}`,
			isDirectory: true,
			modified: d.modified,
			size: d.size
		}));

	const files: ConfigEntry[] = result.files
		.filter((f) => !f.filename.startsWith('.'))
		.map((f) => ({
			name: f.filename,
			path: `${path}/${f.filename}`,
			isDirectory: false,
			modified: f.modified,
			size: f.size
		}));

	return {
		entries: [...dirs.sort(byName), ...files.sort(byName)],
		writable: (result.root_info?.permissions ?? '').includes('w')
	};
}

/** `GET /server/files/config/<path>` — the file's raw text. */
export async function readConfigFile(path: string): Promise<string> {
	// Cache-buster: this is a static file download as far as the browser is
	// concerned, so without it a reload right after a save can legitimately be
	// answered from cache with the version we just replaced.
	const res = await fetch(`${getApiUrl()}/server/files/${encodePath(path)}?t=${Date.now()}`);
	if (!res.ok) {
		const msg = `Failed to open ${path}: ${res.status} ${res.statusText}`;
		toastActions.error('moonraker', 'Open error', msg);
		throw new Error(msg);
	}
	return res.text();
}

/**
 * `POST /server/files/upload` — writes the file, overwriting it if it exists.
 *
 * `root` and `path` are sent as separate form fields, `path` being the
 * subdirectory *relative to the root*: `config/macros/park.cfg` is uploaded as
 * `root=config`, `path=macros`, filename `park.cfg`. Moonraker creates missing
 * subdirectories on the way.
 */
export async function writeConfigFile(path: string, content: string): Promise<void> {
	const slash = path.lastIndexOf('/');
	const filename = path.slice(slash + 1);
	const subdir = path.slice(0, slash).replace(/^config\/?/, '');

	const form = new FormData();
	form.append('file', new File([content], filename, { type: 'text/plain' }));
	form.append('root', CONFIG_ROOT);
	if (subdir) form.append('path', subdir);

	const res = await fetch(`${getApiUrl()}/server/files/upload`, { method: 'POST', body: form });
	if (!res.ok) {
		const msg = `Failed to save ${filename}: ${res.status} ${res.statusText}`;
		toastActions.error('moonraker', 'Save error', msg);
		throw new Error(msg);
	}
}

/**
 * Downloads a config file to the browser. Goes through `fetch` + `Blob` like the
 * log downloads, so a missing file becomes a toast instead of navigating the
 * screen away to an error page.
 */
export async function downloadConfigFile(path: string): Promise<void> {
	const res = await fetch(`${getApiUrl()}/server/files/${encodePath(path)}`);
	if (!res.ok) {
		const msg = `Failed to download ${path}: ${res.status} ${res.statusText}`;
		toastActions.error('moonraker', 'Download error', msg);
		throw new Error(msg);
	}

	const blob = await res.blob();
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = path.slice(path.lastIndexOf('/') + 1);
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
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

// --- naming ------------------------------------------------------------------

/** Klipper reads `.cfg`; `moonraker.conf` is the one `.conf` that matters. */
export function isEditableConfigFile(name: string): boolean {
	return /\.(cfg|conf|json|md|txt|log)$/i.test(name);
}

/**
 * Which restart a file needs to take effect. `moonraker.conf` is read by
 * Moonraker itself, so restarting Klipper would change nothing.
 */
export function suggestedRestartFor(path: string): RestartTarget | null {
	const name = path.slice(path.lastIndexOf('/') + 1).toLowerCase();
	if (name === 'moonraker.conf') return 'moonraker';
	if (name.endsWith('.cfg')) return 'firmware';
	return null;
}

/**
 * Rejects names that would confuse the path handling (separators, traversal) or
 * collide with Moonraker's hidden bookkeeping. Returns an error message, or an
 * empty string when the name is usable.
 */
export function validateEntryName(name: string): string {
	const trimmed = name.trim();
	if (!trimmed) return 'Name cannot be empty';
	if (trimmed.startsWith('.')) return 'Name cannot start with a dot';
	if (/[/\\]/.test(trimmed)) return 'Name cannot contain slashes';
	if (trimmed === '..') return 'Invalid name';
	return '';
}
