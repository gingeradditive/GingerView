import { broadcast } from '../notify';

/**
 * Il gestore aggiornamenti di Moonraker, simulato: GingerView ha un
 * aggiornamento disponibile, il resto è aggiornato. Aggiornare scrive il log a
 * righe come quello vero e poi porta la versione alla nuova.
 */

type Item = Record<string, unknown> & { name: string };

const items: Record<string, Item> = {
	system: {
		name: 'system',
		configured_type: 'system',
		package_count: 3,
		package_list: ['libcamera0.2', 'openssl', 'tzdata']
	},
	GingerView: {
		name: 'GingerView',
		configured_type: 'web',
		channel: 'stable',
		version: 'v1.4.0',
		remote_version: 'v1.5.0',
		rollback_version: 'v1.3.2',
		owner: 'gingeradditive',
		repo_name: 'GingerView',
		is_valid: true,
		warnings: [],
		anomalies: [],
		info_tags: []
	},
	klipper: {
		name: 'klipper',
		configured_type: 'git_repo',
		channel: 'stable',
		version: 'v2026.09.0',
		remote_version: 'v2026.09.0',
		branch: 'main',
		owner: 'KalicoCrew',
		repo_name: 'kalico',
		is_valid: true,
		is_dirty: false,
		corrupt: false,
		detached: false,
		pristine: true,
		commits_behind: [],
		commits_behind_count: 0
	},
	moonraker: {
		name: 'moonraker',
		configured_type: 'git_repo',
		channel: 'stable',
		version: 'v0.9.3-112',
		remote_version: 'v0.9.3-112',
		branch: 'master',
		owner: 'Arksine',
		repo_name: 'moonraker',
		is_valid: true,
		is_dirty: false,
		corrupt: false,
		detached: false,
		pristine: true,
		commits_behind: [],
		commits_behind_count: 0
	},
	'G2-Service': {
		name: 'G2-Service',
		configured_type: 'git_repo',
		channel: 'stable',
		version: 'v0.8.1',
		remote_version: 'v0.8.1',
		branch: 'main',
		owner: 'gingeradditive',
		repo_name: 'G2-Service',
		is_valid: true,
		is_dirty: false,
		corrupt: false,
		detached: false,
		pristine: true,
		commits_behind: [],
		commits_behind_count: 0
	}
};

let busy = false;
let procId = 4000;

export function getUpdateStatus(): Record<string, unknown> {
	return {
		busy,
		github_rate_limit: 60,
		github_requests_remaining: 57,
		github_limit_reset_time: Math.round(Date.now() / 1000) + 2400,
		version_info: structuredClone(items)
	};
}

export function isBusy(): boolean {
	return busy;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function logLines(item: Item): string[] {
	if (item.name === 'system') {
		return [
			'Updating packages...',
			'Get:1 http://deb.debian.org/debian bookworm InRelease',
			`Unpacking ${(item.package_list as string[]).join(', ')}...`,
			'Setting up packages...',
			'Package update finished'
		];
	}
	return [
		`Updating ${item.name}...`,
		`Downloading ${item.name} ${item.remote_version}...`,
		'Download complete, extracting...',
		'Restarting services...',
		`Update of ${item.name} complete`
	];
}

async function upgradeOne(name: string): Promise<void> {
	const item = items[name];
	if (!item) throw new Error(`Invalid application: ${name}`);
	const id = procId++;
	for (const message of logLines(item)) {
		await wait(900 + Math.random() * 700);
		broadcast('notify_update_response', [
			{ application: name, proc_id: id, message, complete: false }
		]);
	}
	if (item.name === 'system') {
		item.package_count = 0;
		item.package_list = [];
	} else {
		item.rollback_version = item.version;
		item.version = item.remote_version;
	}
	broadcast('notify_update_response', [
		{ application: name, proc_id: id, message: `Update of ${name} complete`, complete: true }
	]);
}

/**
 * `POST /machine/update/upgrade`: risponde a lavoro finito, come Moonraker.
 *
 * Aggiornare GingerView nella demo non ricarica niente: la pagina non cambia
 * davvero, ma la riga passa alla nuova versione.
 */
export async function upgrade(name?: string): Promise<void> {
	if (busy) throw new Error('Update in progress');
	busy = true;
	try {
		const targets = name
			? [name]
			: Object.values(items)
					.filter((item) =>
						item.name === 'system'
							? Number(item.package_count) > 0
							: item.version !== item.remote_version
					)
					.map((item) => item.name);
		for (const target of targets) await upgradeOne(target);
	} finally {
		busy = false;
	}
}

export async function recover(name: string): Promise<void> {
	if (!items[name]) throw new Error(`Invalid application: ${name}`);
	busy = true;
	try {
		const id = procId++;
		for (const message of [
			'Attempting repo recovery...',
			'Resetting repository...',
			'Recovery complete'
		]) {
			await wait(800);
			broadcast('notify_update_response', [
				{ application: name, proc_id: id, message, complete: false }
			]);
		}
		Object.assign(items[name], {
			is_dirty: false,
			corrupt: false,
			detached: false,
			is_valid: true
		});
		broadcast('notify_update_response', [
			{ application: name, proc_id: id, message: 'Recovery complete', complete: true }
		]);
	} finally {
		busy = false;
	}
}

export async function refresh(): Promise<Record<string, unknown>> {
	await wait(1200);
	return getUpdateStatus();
}
