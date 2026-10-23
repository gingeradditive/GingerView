import { demoConfig } from './config';
import * as history from './history';
import { connections } from './notify';
import * as printer from './printer';
import * as storage from './storage';
import * as host from './data/host';
import * as update from './data/update';

/**
 * Le risposte HTTP di Moonraker (`/server`, `/printer`, `/machine`) e di
 * G2-Service (`/service`), senza rete.
 *
 * `handleRequest()` riceve le richieste che `fetch` avrebbe mandato alla
 * stampante e restituisce una `Response` con la stessa forma: `{result}` per
 * Moonraker, il corpo nudo per G2-Service, e i rispettivi errori.
 */

type Context = {
	method: string;
	path: string;
	query: URLSearchParams;
	request: Request;
};

type Handler = (ctx: Context, match: RegExpMatchArray) => Promise<Response> | Response;

/** Prefissi che la demo serve; il resto (asset, pagine) va alla rete. */
export const API_PREFIXES = [
	'/server/',
	'/printer/',
	'/machine/',
	'/service/',
	'/access/',
	'/api/'
];

const json = (body: unknown, status = 200): Response =>
	new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const ok = (result: unknown): Response => json({ result });

const STATUS_TEXT: Record<number, string> = {
	400: 'Bad Request',
	403: 'Forbidden',
	404: 'Not Found',
	409: 'Conflict',
	503: 'Service Unavailable'
};

/** Errore nel formato di Moonraker. */
const fail = (status: number, message: string): Response =>
	new Response(JSON.stringify({ error: { code: status, message } }), {
		status,
		statusText: STATUS_TEXT[status] ?? 'Error',
		headers: { 'Content-Type': 'application/json' }
	});

/** Errore nel formato di G2-Service. */
const serviceFail = (status: number, code: string, message: string): Response =>
	new Response(JSON.stringify({ detail: { code, message } }), {
		status,
		statusText: STATUS_TEXT[status] ?? 'Error',
		headers: { 'Content-Type': 'application/json' }
	});

async function readJson(request: Request): Promise<Record<string, unknown>> {
	try {
		const body = await request.json();
		return body && typeof body === 'object' ? body : {};
	} catch {
		return {};
	}
}

/** `print_stats&toolhead=position,homed_axes` → `{print_stats: null, toolhead: [...]}`. */
function readObjects(query: URLSearchParams): Record<string, string[] | null> {
	const objects: Record<string, string[] | null> = {};
	for (const [name, value] of query) {
		const fields = value
			.split(',')
			.map((field) => field.trim())
			.filter(Boolean);
		objects[name] = fields.length > 0 ? fields : null;
	}
	return objects;
}

async function gcode(script: string): Promise<Response> {
	try {
		await printer.runScript(script);
		return ok('ok');
	} catch (error) {
		return fail(400, error instanceof Error ? error.message : 'Command failed');
	}
}

function printerAction(action: () => void): Response {
	try {
		action();
		return ok('ok');
	} catch (error) {
		return fail(400, error instanceof Error ? error.message : 'Command failed');
	}
}

function storageAction(action: () => unknown): Response {
	try {
		return ok(action() ?? 'ok');
	} catch (error) {
		if (error instanceof storage.StorageError) return fail(error.status, error.message);
		throw error;
	}
}

/** Contenuto di un file come risposta di download. */
async function fileResponse(path: string): Promise<Response> {
	const content = await storage.readFile(path);
	if (content === null) return fail(404, `File ${path} does not exist`);
	return new Response(content, { status: 200, headers: { 'Content-Type': 'text/plain' } });
}

/** Le due root senza prefisso che Moonraker accetta per i log. */
const LOG_ALIASES: Record<string, string> = {
	'klippy.log': 'logs/klippy.log',
	'moonraker.log': 'logs/moonraker.log'
};

let database: Record<string, Record<string, unknown>> = {};

const routes: [string, RegExp, Handler][] = [
	// --- server ---
	[
		'GET',
		/^\/server\/info$/,
		() => {
			const { state } = printer.getKlippyState();
			return ok({
				klippy_connected: true,
				klippy_state: state,
				components: ['file_manager', 'history', 'update_manager', 'machine', 'database', 'webcam'],
				failed_components: [],
				registered_directories: ['config', 'logs', 'gcodes'],
				warnings: [],
				websocket_count: connections.size,
				moonraker_version: 'v0.9.3-112-demo',
				api_version: [1, 5, 0],
				api_version_string: '1.5.0'
			});
		}
	],
	['POST', /^\/server\/restart$/, () => ok('ok')],
	[
		'GET',
		/^\/server\/database\/item$/,
		({ query }) => {
			const value = database[query.get('namespace') ?? '']?.[query.get('key') ?? ''];
			return value === undefined
				? fail(404, 'Key not found')
				: ok({ namespace: query.get('namespace'), key: query.get('key'), value });
		}
	],
	[
		'POST',
		/^\/server\/database\/item$/,
		async ({ request }) => {
			const body = await readJson(request);
			const namespace = String(body.namespace ?? '');
			database = {
				...database,
				[namespace]: { ...database[namespace], [String(body.key)]: body.value }
			};
			return ok({ namespace, key: body.key, value: body.value });
		}
	],
	[
		'POST',
		/^\/server\/logs\/rollover$/,
		() => ok({ rolled_over: ['klippy', 'moonraker'], failed: {} })
	],

	// --- file ---
	[
		'GET',
		/^\/server\/files\/directory$/,
		({ query }) => {
			const listing = storage.listDirectory(query.get('path') ?? 'gcodes');
			return listing ? ok(listing) : fail(404, `Directory ${query.get('path')} does not exist`);
		}
	],
	[
		'POST',
		/^\/server\/files\/directory$/,
		({ query }) =>
			storageAction(() => {
				storage.createDirectory(query.get('path') ?? '');
				return { item: { path: query.get('path') }, action: 'create_dir' };
			})
	],
	[
		'DELETE',
		/^\/server\/files\/directory$/,
		({ query }) =>
			storageAction(() => {
				storage.deleteDirectory(query.get('path') ?? '', query.get('force') === 'true');
				return { item: { path: query.get('path') }, action: 'delete_dir' };
			})
	],
	[
		'GET',
		/^\/server\/files\/metadata$/,
		({ query }) => {
			const metadata = storage.getMetadata(query.get('filename') ?? '');
			return metadata ? ok(metadata) : fail(404, 'Metadata not available');
		}
	],
	[
		'POST',
		/^\/server\/files\/move$/,
		async ({ request }) => {
			const body = await readJson(request);
			return storageAction(() =>
				storage.moveEntry(String(body.source ?? ''), String(body.dest ?? ''))
			);
		}
	],
	[
		'POST',
		/^\/server\/files\/upload$/,
		async ({ request }) => {
			const form = await request.formData();
			const file = form.get('file');
			if (!(file instanceof File)) return fail(400, 'No file uploaded');
			try {
				return ok(
					await storage.uploadFile(
						String(form.get('root') ?? 'gcodes'),
						String(form.get('path') ?? ''),
						file
					)
				);
			} catch (error) {
				if (error instanceof storage.StorageError) return fail(error.status, error.message);
				throw error;
			}
		}
	],
	[
		'GET',
		/^\/server\/files\/(.+)$/,
		(_ctx, match) => {
			const path = decodeURIComponent(match[1]);
			return fileResponse(LOG_ALIASES[path] ?? path);
		}
	],
	[
		'DELETE',
		/^\/server\/files\/(.+)$/,
		(_ctx, match) =>
			storageAction(() => {
				const path = decodeURIComponent(match[1]);
				storage.deleteFile(path);
				return { item: { path }, action: 'delete_file' };
			})
	],

	// --- storico ---
	[
		'GET',
		/^\/server\/history\/list$/,
		({ query }) =>
			ok(history.listJobs(Number(query.get('start') ?? 0), Number(query.get('limit') ?? 50)))
	],
	[
		'GET',
		/^\/server\/history\/job$/,
		({ query }) => {
			const job = history.getJob(query.get('uid') ?? '');
			return job ? ok({ job }) : fail(404, 'Job not found');
		}
	],
	[
		'DELETE',
		/^\/server\/history\/job$/,
		({ query }) =>
			ok({
				deleted_jobs:
					query.get('all') === 'true'
						? history.deleteAll()
						: history.deleteJob(query.get('uid') ?? '')
			})
	],
	['GET', /^\/server\/history\/totals$/, () => ok(history.getTotals())],
	['POST', /^\/server\/history\/totals\/reset$/, () => ok(history.resetTotals())],

	// --- stampante ---
	[
		'GET',
		/^\/printer\/info$/,
		() => {
			const { state, message } = printer.getKlippyState();
			return ok({
				state,
				state_message: message,
				hostname: 'g2-virtual',
				klipper_path: '/home/pi/kalico',
				python_path: '/home/pi/klippy-env/bin/python',
				log_file: '/home/pi/printer_data/logs/klippy.log',
				config_file: '/home/pi/printer_data/config/printer.cfg',
				software_version: 'v2026.09-demo',
				cpu_info: '4 core ARM'
			});
		}
	],
	['GET', /^\/printer\/objects\/list$/, () => ok({ objects: printer.objectNames() })],
	[
		'GET',
		/^\/printer\/objects\/query$/,
		({ query }) =>
			ok({ eventtime: performance.now() / 1000, status: printer.queryObjects(readObjects(query)) })
	],
	[
		'POST',
		/^\/printer\/objects\/query$/,
		async ({ request }) => {
			const body = await readJson(request);
			return ok({
				eventtime: performance.now() / 1000,
				status: printer.queryObjects((body.objects as Record<string, string[] | null>) ?? {})
			});
		}
	],
	[
		'POST',
		/^\/printer\/gcode\/script$/,
		async ({ query, request }) => {
			const script = query.get('script') ?? String((await readJson(request)).script ?? '');
			return gcode(script);
		}
	],
	[
		'POST',
		/^\/printer\/print\/start$/,
		async ({ query, request }) => {
			const filename = query.get('filename') ?? String((await readJson(request)).filename ?? '');
			return printerAction(() => printer.startPrint(filename));
		}
	],
	['POST', /^\/printer\/print\/pause$/, () => printerAction(() => printer.pause())],
	['POST', /^\/printer\/print\/resume$/, () => printerAction(() => printer.resume())],
	['POST', /^\/printer\/print\/cancel$/, () => printerAction(() => printer.cancel())],
	['POST', /^\/printer\/emergency_stop$/, () => printerAction(() => printer.emergencyStop())],
	['POST', /^\/printer\/(firmware_restart|restart)$/, () => printerAction(() => printer.restart())],

	// --- macchina ---
	['GET', /^\/machine\/system_info$/, () => ok(host.systemInfo())],
	['GET', /^\/machine\/proc_stats$/, () => ok(host.procStats())],
	['GET', /^\/machine\/update\/status$/, () => ok(update.getUpdateStatus())],
	[
		'POST',
		/^\/machine\/update\/refresh$/,
		async () => {
			if (update.isBusy() || printer.getJobInfo())
				return fail(503, 'Unable to refresh: an update or a print is in progress');
			return ok(await update.refresh());
		}
	],
	[
		'POST',
		/^\/machine\/update\/upgrade$/,
		async ({ request }) => {
			if (printer.getJobInfo()) return fail(503, 'Print in progress, cannot update');
			const body = await readJson(request);
			try {
				await update.upgrade(body.name ? String(body.name) : undefined);
				return ok('ok');
			} catch (error) {
				return fail(400, error instanceof Error ? error.message : "The update didn't work");
			}
		}
	],
	[
		'POST',
		/^\/machine\/update\/recover$/,
		async ({ request }) => {
			const body = await readJson(request);
			try {
				await update.recover(String(body.name ?? ''));
				return ok('ok');
			} catch (error) {
				return fail(400, error instanceof Error ? error.message : "The fix didn't work");
			}
		}
	],
	['POST', /^\/machine\/(reboot|shutdown)$/, () => ok('ok')],

	// --- G2-Service ---
	['GET', /^\/service\/network\/status$/, () => json(host.networkStatus())],
	['GET', /^\/service\/network\/wifi\/networks$/, () => json(host.listWifi())],
	[
		'POST',
		/^\/service\/network\/wifi\/rescan$/,
		async () => {
			await new Promise((resolve) => setTimeout(resolve, 1500));
			return json(host.listWifi());
		}
	],
	[
		'POST',
		/^\/service\/network\/wifi\/connect$/,
		async ({ request }) => {
			const body = await readJson(request);
			return json(
				host.connectWifi(String(body.ssid ?? ''), body.password as string | null | undefined),
				202
			);
		}
	],
	[
		'GET',
		/^\/service\/jobs\/(.+)$/,
		(_ctx, match) => {
			const job = host.getJob(decodeURIComponent(match[1]));
			return job ? json(job) : serviceFail(404, 'NOT_FOUND', 'Job not found');
		}
	],
	['GET', /^\/service\/timezone$/, () => json(host.getTimezone())],
	[
		'POST',
		/^\/service\/timezone$/,
		async ({ request }) => {
			const body = await readJson(request);
			const result = host.setTimezone(String(body.timezone ?? ''));
			return result ? json(result) : serviceFail(400, 'INVALID_INPUT', 'Unknown time zone');
		}
	],
	['GET', /^\/service\/usb$/, () => json({ mounted: true })],
	[
		'GET',
		/^\/service\/usb\/files$/,
		({ query }) => {
			const listing = host.usbDirectory(query.get('path') ?? '');
			return listing ? json(listing) : serviceFail(404, 'NOT_FOUND', 'Folder not found');
		}
	],
	[
		'POST',
		/^\/service\/usb\/import$/,
		async ({ request }) => {
			const body = await readJson(request);
			const source = String(body.source ?? '');
			const destDir = String(body.destDir ?? '').replace(/^\/+|\/+$/g, '');
			const onConflict = String(body.onConflict ?? 'fail');
			const file = host.findUsbFile(source);
			if (!file) return serviceFail(404, 'NOT_FOUND', 'File not found');

			let name = file.name;
			const target = (candidate: string) => `gcodes/${destDir ? `${destDir}/` : ''}${candidate}`;
			if (storage.exists(target(name))) {
				if (onConflict === 'fail') return serviceFail(409, 'FILE_EXISTS', 'File already exists');
				if (onConflict === 'rename') {
					const base = name.replace(/\.gcode$/i, '');
					let index = 1;
					while (storage.exists(target(`${base}_${index}.gcode`))) index++;
					name = `${base}_${index}.gcode`;
				}
			}

			const job = host.startUsbImport(() => {
				storage.copyGcode(`gcodes/${file.source}`, target(name), file.size);
				return { result: { filename: name, path: destDir ? `${destDir}/${name}` : name } };
			});
			return json(job, 202);
		}
	]
];

/** Le richieste dirette alla stampante; `null` per tutto il resto. */
export async function handleRequest(request: Request): Promise<Response | null> {
	const url = new URL(request.url, window.location.href);
	const path = url.pathname;
	if (!API_PREFIXES.some((prefix) => path.startsWith(prefix))) return null;

	const method = request.method.toUpperCase();
	if (demoConfig.blockedActions.includes(`${method} ${path}`)) {
		return path.startsWith('/service/')
			? serviceFail(403, 'DEMO_BLOCKED', demoConfig.blockedMessage)
			: fail(403, demoConfig.blockedMessage);
	}

	// Una manciata di millisecondi, come una rete locale: le interfacce che
	// mostrano "Loading…" lo mostrano per un attimo invece che mai.
	await new Promise((resolve) => setTimeout(resolve, 20 + Math.random() * 60));

	for (const [routeMethod, pattern, handler] of routes) {
		if (routeMethod !== method) continue;
		const match = path.match(pattern);
		if (match) return handler({ method, path, query: url.searchParams, request }, match);
	}

	return path.startsWith('/service/')
		? serviceFail(404, 'NOT_FOUND', 'Not found')
		: fail(404, 'Not Found');
}
