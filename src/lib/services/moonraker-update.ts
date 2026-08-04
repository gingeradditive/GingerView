import { configService } from './config';
import { toastActions } from '$lib/stores/toastStore';
import type { UpdateItem, UpdateItemState, UpdateResponse, UpdateStatus } from '$lib/types/update';

/**
 * Client for Moonraker's update manager.
 *
 * Everything the page needs lives under `/machine/update/`. The OS itself is not
 * a separate API: it is the `system` entry of `version_info`, an updater that
 * wraps apt, so "update the system" and "update a program" are the same call
 * with a different `name`.
 *
 * The mutating endpoints (`upgrade`, `recover`) are **long running**:
 * Moonraker only answers once the operation has finished, which for an OS upgrade
 * can be several minutes. Progress arrives meanwhile over the WebSocket as
 * `notify_update_response`. Callers must therefore not treat a failed request as
 * a failed update — see `fetchUpdateStatusQuietly()` and its `busy` flag.
 */

function getApiUrl(): string {
	return configService.getKlipperConfig().moonrakerApiUrl;
}

/**
 * Moonraker reports failures as `{"error": {"code": ..., "message": ...}}` with a
 * non-2xx status. That message is the useful one ("Print in progress", "Update
 * manager not initialized"), so prefer it over the bare HTTP status text.
 */
async function readError(res: Response, fallback: string): Promise<string> {
	try {
		const json = await res.json();
		const message = json?.error?.message;
		if (typeof message === 'string' && message.trim()) return message;
	} catch {
		// Body was not JSON — fall through to the generic message.
	}
	return `${fallback}: ${res.status} ${res.statusText}`;
}

async function post(
	path: string,
	body: Record<string, unknown>,
	failureTitle: string
): Promise<void> {
	const res = await fetch(`${getApiUrl()}${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	if (!res.ok) {
		throw new Error(await readError(res, failureTitle));
	}
}

/** `GET /machine/update/status` — cached state, does not hit GitHub. */
export async function fetchUpdateStatus(): Promise<UpdateStatus> {
	const res = await fetch(`${getApiUrl()}/machine/update/status`);
	if (!res.ok) {
		const msg = await readError(res, 'Failed to read update status');
		toastActions.error('moonraker', 'Update status error', msg);
		throw new Error(msg);
	}
	const json = await res.json();
	return json.result as UpdateStatus;
}

/**
 * `POST /machine/update/refresh` — asks Moonraker to re-check the remotes.
 * This one *does* hit GitHub and counts against the rate limit, so it is only
 * ever called from the "Check for updates" button. Returns 503 while an update
 * or a print is running.
 */
export async function refreshUpdateStatus(name?: string): Promise<UpdateStatus> {
	const res = await fetch(`${getApiUrl()}/machine/update/refresh`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(name ? { name } : {})
	});
	if (!res.ok) {
		const msg = await readError(res, 'Failed to refresh update status');
		toastActions.error('moonraker', 'Check for updates failed', msg);
		throw new Error(msg);
	}
	const json = await res.json();
	return json.result as UpdateStatus;
}

/** `POST /machine/update/upgrade` — omit `name` to update everything. */
export async function startUpgrade(name?: string): Promise<void> {
	await post('/machine/update/upgrade', name ? { name } : {}, 'Update failed');
}

/**
 * `POST /machine/update/recover` — repairs a repo Moonraker considers broken.
 * Soft recovery runs `git reset`; hard recovery deletes the repo and re-clones it.
 */
export async function startRecover(name: string, hard: boolean): Promise<void> {
	await post('/machine/update/recover', { name, hard }, 'Recovery failed');
}

/**
 * Like `fetchUpdateStatus()` but without a toast, for polling loops — in
 * particular the one that reads `busy` to tell a genuinely failed request from
 * one that merely got cut short while the update keeps running on the host.
 */
export async function fetchUpdateStatusQuietly(): Promise<UpdateStatus | null> {
	try {
		const res = await fetch(`${getApiUrl()}/machine/update/status`);
		if (!res.ok) return null;
		const json = await res.json();
		return json.result as UpdateStatus;
	} catch {
		return null;
	}
}

/**
 * Name of GingerView's own entry in Moonraker's `update_manager` (see
 * `script/install.sh`). Updating it replaces the files nginx serves while the
 * browser is still running the old bundle, so the page has to reload itself:
 * everything else on the printer can be updated without touching the client.
 */
export const SELF_UPDATE_NAME = 'GingerView';

/** Matches case-insensitively: Moonraker echoes the section name as configured. */
export function isSelfUpdate(application: string): boolean {
	return application.toLowerCase() === SELF_UPDATE_NAME.toLowerCase();
}

// --- derived state -----------------------------------------------------------

/** Moonraker uses `"?"` for a version it could not determine. */
function isKnownVersion(version: string | undefined): version is string {
	return typeof version === 'string' && version !== '' && version !== '?';
}

export function getItemType(item: UpdateItem): string {
	return (
		item.configured_type ?? item.detected_type ?? (item.name === 'system' ? 'system' : 'git_repo')
	);
}

/**
 * Turns the raw fields into the handful of booleans the UI actually branches on.
 * Recovery is deliberately derived rather than always offered: it is destructive,
 * so it only appears when Moonraker's own flags say the repo is broken.
 */
export function describeItem(item: UpdateItem): UpdateItemState {
	const isSystem = getItemType(item) === 'system';

	const updateAvailable = isSystem
		? (item.package_count ?? 0) > 0
		: isKnownVersion(item.version) &&
			isKnownVersion(item.remote_version) &&
			item.version !== item.remote_version;

	const corrupt = item.corrupt === true;
	const invalid = item.is_valid === false;
	const detached = item.detached === true;
	const dirty = item.is_dirty === true;
	const needsRecovery = !isSystem && (corrupt || invalid || detached || dirty);

	let badge = 'Up to date';
	let badgeTone: UpdateItemState['badgeTone'] = 'ok';
	if (corrupt) {
		badge = 'Corrupt';
		badgeTone = 'problem';
	} else if (invalid) {
		badge = 'Invalid';
		badgeTone = 'problem';
	} else if (detached) {
		badge = 'Detached';
		badgeTone = 'problem';
	} else if (dirty) {
		badge = 'Modified';
		badgeTone = 'problem';
	} else if (updateAvailable) {
		badge = 'Update available';
		badgeTone = 'pending';
	}

	return { isSystem, updateAvailable, needsRecovery, badge, badgeTone };
}

/** Display name: Moonraker's raw keys are lowercase (`klipper`, `crowsnest`). */
export function getItemLabel(item: UpdateItem): string {
	if (getItemType(item) === 'system') return 'System';
	return item.name.charAt(0).toUpperCase() + item.name.slice(1);
}

/** One-line version summary shown under the item name. */
export function getVersionLine(item: UpdateItem): string {
	if (getItemType(item) === 'system') {
		const count = item.package_count ?? 0;
		if (count === 0) return 'No packages to update';
		return `${count} package${count === 1 ? '' : 's'} to update`;
	}

	const current = isKnownVersion(item.version) ? item.version : 'unknown';
	if (isKnownVersion(item.remote_version) && item.remote_version !== item.version) {
		return `${current} → ${item.remote_version}`;
	}
	return current;
}

/**
 * Sort order for the list: `system` first, then everything else alphabetically.
 * Moonraker returns `version_info` as an object, whose key order is an
 * implementation detail we should not depend on.
 */
export function sortItems(versionInfo: Record<string, UpdateItem>): UpdateItem[] {
	return Object.entries(versionInfo)
		.map(([name, item]) => ({ ...item, name: item.name ?? name }))
		.sort((a, b) => {
			if (a.name === 'system') return -1;
			if (b.name === 'system') return 1;
			return a.name.localeCompare(b.name);
		});
}

// --- WebSocket ---------------------------------------------------------------

export interface UpdateSocketHandlers {
	/** A line of update output. Fires many times during an operation. */
	onResponse: (payload: UpdateResponse) => void;
	/** Moonraker finished a refresh on its own and pushed the full status. */
	onRefreshed: (status: UpdateStatus) => void;
}

/**
 * Opens a WebSocket dedicated to update notifications, kept alive only while the
 * update page is mounted. It does not share the notifier's connection: that one
 * has no subscription mechanism, and update output is only of interest here.
 *
 * Returns a disposer to be called on unmount.
 */
export function connectUpdateSocket(handlers: UpdateSocketHandlers): () => void {
	const wsUrl = configService.getKlipperConfig().moonrakerWsUrl;
	let socket: WebSocket | null = null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let closed = false;

	function connect() {
		if (closed || !wsUrl) return;
		try {
			socket = new WebSocket(wsUrl);
		} catch {
			scheduleReconnect();
			return;
		}

		socket.onopen = () => {
			socket?.send(
				JSON.stringify({
					jsonrpc: '2.0',
					method: 'server.connection.identify',
					params: {
						client_name: 'GingerView',
						version: '0.0.1',
						type: 'web',
						url: window.location.href
					},
					id: Date.now()
				})
			);
		};

		socket.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				if (data.method === 'notify_update_response') {
					const payload = data.params?.[0];
					if (payload) handlers.onResponse(payload as UpdateResponse);
					return;
				}
				if (data.method === 'notify_update_refreshed') {
					const payload = data.params?.[0];
					if (payload) handlers.onRefreshed(payload as UpdateStatus);
				}
			} catch {
				// Not a notification we care about.
			}
		};

		socket.onclose = () => {
			socket = null;
			scheduleReconnect();
		};

		socket.onerror = () => {
			// `onclose` fires right after and handles the reconnect.
		};
	}

	function scheduleReconnect() {
		if (closed) return;
		if (reconnectTimer) clearTimeout(reconnectTimer);
		reconnectTimer = setTimeout(connect, 5000);
	}

	connect();

	return () => {
		closed = true;
		if (reconnectTimer) clearTimeout(reconnectTimer);
		reconnectTimer = null;
		socket?.close(1000);
		socket = null;
	};
}
