/**
 * Types for Moonraker's update manager (`/machine/update/*`).
 *
 * Moonraker returns a different set of fields per updater kind (`system`,
 * `git_repo`, `web`, `zip`, `python`), all inside the same `version_info` map.
 * Rather than modelling five disjoint shapes, `UpdateItem` is the union of every
 * field with everything but `name` optional: consumers read what is relevant for
 * the kind they are looking at. This also keeps the code working against older
 * Moonraker builds, which simply omit the newer keys.
 *
 * These interfaces describe the **wire format**, not what the page shows. The UI
 * deliberately surfaces only name, version and state, so fields such as
 * `commits_behind`, `package_list` and `rollback_version` are documented here
 * without being read anywhere — that is not dead code, it is the payload.
 */

/** One commit in `commits_behind`. */
export interface UpdateCommit {
	sha: string;
	author: string;
	/** Unix timestamp, sent by Moonraker as a *string*. */
	date: string;
	subject: string;
	message: string;
	tag: string | null;
}

export type UpdateItemType = 'system' | 'git_repo' | 'web' | 'zip' | 'python';

export interface UpdateItem {
	name: string;
	/** Present since Moonraker 0.8; older builds only send `detected_type`. */
	configured_type?: UpdateItemType;
	detected_type?: UpdateItemType;

	// --- system (OS packages) ---
	package_count?: number;
	package_list?: string[];

	// --- application updaters ---
	/** Installed version. Moonraker sends `"?"` when it cannot determine it. */
	version?: string;
	remote_version?: string;
	rollback_version?: string;
	full_version_string?: string;
	channel?: string;
	branch?: string;
	owner?: string;
	repo_name?: string;
	current_hash?: string;
	remote_hash?: string;
	remote_alias?: string;
	remote_url?: string;
	recovery_url?: string;

	// --- health flags (git_repo) ---
	is_valid?: boolean;
	is_dirty?: boolean;
	corrupt?: boolean;
	pristine?: boolean;
	detached?: boolean;
	repo_detected?: boolean;

	commits_behind?: UpdateCommit[];
	commits_behind_count?: number;

	git_messages?: string[];
	warnings?: string[];
	anomalies?: string[];
	info_tags?: string[];
	last_error?: string;
}

/** Payload of `GET /machine/update/status` and of `notify_update_refreshed`. */
export interface UpdateStatus {
	busy: boolean;
	github_rate_limit: number;
	github_requests_remaining: number;
	/** Unix timestamp at which the GitHub rate limit resets. */
	github_limit_reset_time: number;
	version_info: Record<string, UpdateItem>;
}

/** Payload of the `notify_update_response` WebSocket notification. */
export interface UpdateResponse {
	/** Name of the item being updated, matching a key of `version_info`. */
	application: string;
	proc_id: number;
	message: string;
	/** `true` on the last notification emitted for this item. */
	complete: boolean;
}

/** Lifecycle of the live output panel shown while an operation runs. */
export type UpdateLogState = 'running' | 'success' | 'error';

/** What the UI is allowed to offer for a given item, derived from its raw fields. */
export interface UpdateItemState {
	/** `system` is the OS package updater and behaves differently from the rest. */
	isSystem: boolean;
	updateAvailable: boolean;
	/** The repo is dirty, detached, corrupt or otherwise unusable: offer recovery. */
	needsRecovery: boolean;
	/** Short label for the badge, e.g. `Up to date`, `Update available`, `Corrupt`. */
	badge: string;
	badgeTone: 'ok' | 'pending' | 'problem';
}
