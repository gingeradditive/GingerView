import { parseGcodeMetadata } from './gcode-meta.js';
import { nativeFetch } from './native';
import { broadcast } from './notify';
import catalog from './files/catalog.json';
import { CONFIG_FILES } from './data/config-files';
import { LOG_FILES } from './data/logs';

/**
 * Il disco della stampante simulata: le root `gcodes`, `config` e `logs` di
 * Moonraker, in memoria.
 *
 * Ogni visitatore parte dallo stesso contenuto e lo può cambiare (caricare,
 * spostare, cancellare file); al ricaricamento della pagina torna tutto come
 * prima. I percorsi sono quelli di Moonraker, root compresa: `gcodes/Stool.gcode`.
 */

type Metadata = Record<string, unknown>;

type Thumbnail = { width: number; height: number; size: number; url: string };

interface FileNode {
	kind: 'file';
	modified: number;
	size: number;
	/** Contenuto testuale (config, log). */
	text?: string;
	/** File caricato dal visitatore: si legge da qui. */
	blob?: Blob;
	metadata?: Metadata;
	thumbnail?: Thumbnail;
}

interface DirNode {
	kind: 'dir';
	modified: number;
}

type Node = FileNode | DirNode;

type CatalogEntry = {
	path: string;
	size: number;
	modified: number;
	thumbnail?: { file: string; width: number; height: number; size: number };
	metadata: Metadata;
};

const ROOT_PERMISSIONS: Record<string, string> = { gcodes: 'rw', config: 'rw', logs: 'r' };

/** Le miniature sono asset della build: qui il loro URL pubblico. */
const thumbnailUrls = import.meta.glob<string>('./files/thumbs/*.png', {
	eager: true,
	query: '?no-inline',
	import: 'default'
});

const nodes = new Map<string, Node>();

const now = (): number => Date.now() / 1000;

function parentOf(path: string): string {
	const slash = path.lastIndexOf('/');
	return slash === -1 ? '' : path.slice(0, slash);
}

function nameOf(path: string): string {
	return path.slice(path.lastIndexOf('/') + 1);
}

function rootOf(path: string): string {
	return path.split('/')[0];
}

/** Crea le cartelle mancanti sopra `path`, root esclusa. */
function ensureParents(path: string, modified = now()): void {
	let parent = parentOf(path);
	while (parent && parent.includes('/') && !nodes.has(parent)) {
		nodes.set(parent, { kind: 'dir', modified });
		parent = parentOf(parent);
	}
	if (parent && !nodes.has(parent)) nodes.set(parent, { kind: 'dir', modified });
}

function seed(): void {
	for (const entry of catalog as CatalogEntry[]) {
		const path = `gcodes/${entry.path}`;
		const url = entry.thumbnail ? thumbnailUrls[`./files/thumbs/${entry.thumbnail.file}`] : undefined;
		ensureParents(path, entry.modified);
		nodes.set(path, {
			kind: 'file',
			modified: entry.modified,
			size: entry.size,
			metadata: { ...entry.metadata },
			thumbnail: entry.thumbnail && url ? { ...entry.thumbnail, url } : undefined
		});
	}

	const configTime = now() - 6 * 86400;
	for (const [name, text] of Object.entries(CONFIG_FILES)) {
		const path = `config/${name}`;
		ensureParents(path, configTime);
		nodes.set(path, { kind: 'file', modified: configTime, size: text.length, text });
	}

	for (const [name, build] of Object.entries(LOG_FILES)) {
		const text = build();
		nodes.set(`logs/${name}`, { kind: 'file', modified: now(), size: text.length, text });
	}
}

seed();

// --- miniature ----------------------------------------------------------------

/**
 * `relative_path` della miniatura, che GingerView appende a
 * `/server/files/<cartella>/`: risale fino alla radice del sito e punta
 * all'asset della build. Il browser risolve i `..` da solo, quindi l'`<img>`
 * carica il PNG senza passare dal simulatore.
 */
function thumbnailRelativePath(dir: string, url: string): string | null {
	if (!url.startsWith('/')) return null;
	const depth = 2 + dir.split('/').length; // server/files + cartella
	return `${'../'.repeat(depth)}${url.slice(1)}`;
}

function thumbnailsFor(path: string, node: FileNode): Metadata[] | undefined {
	if (!node.thumbnail) return undefined;
	const relative = thumbnailRelativePath(parentOf(path), node.thumbnail.url);
	if (!relative) return undefined;
	const { width, height, size } = node.thumbnail;
	return [{ width, height, size, relative_path: relative }];
}

const base64Cache = new Map<string, Promise<string>>();

function toBase64(url: string): Promise<string> {
	let cached = base64Cache.get(url);
	if (!cached) {
		cached = nativeFetch(url)
			.then((response) => response.arrayBuffer())
			.then((buffer) => {
				let binary = '';
				const bytes = new Uint8Array(buffer);
				for (let i = 0; i < bytes.length; i += 0x8000) {
					binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
				}
				return btoa(binary);
			});
		base64Cache.set(url, cached);
	}
	return cached;
}

/**
 * La testa di un G-code del catalogo: il file vero non viene pubblicato, ma
 * GingerView legge la miniatura dai primi KB del file, quindi si ricostruisce
 * quella parte.
 */
async function gcodeHeader(node: FileNode): Promise<string> {
	const metadata = node.metadata ?? {};
	const lines = [
		'; HEADER_BLOCK_START',
		`; generated by ${metadata.slicer ?? 'OrcaSlicer'} ${metadata.slicer_version ?? ''}`.trimEnd(),
		`; max_z_height: ${metadata.object_height ?? 0}`,
		'; HEADER_BLOCK_END',
		''
	];
	if (node.thumbnail) {
		const base64 = await toBase64(node.thumbnail.url);
		const chunks = base64.match(/.{1,76}/g) ?? [];
		lines.push(
			'; THUMBNAIL_BLOCK_START',
			`; thumbnail begin ${node.thumbnail.width}x${node.thumbnail.height} ${base64.length}`,
			...chunks.map((chunk) => `; ${chunk}`),
			'; thumbnail end',
			'; THUMBNAIL_BLOCK_END',
			''
		);
	}
	lines.push('; Virtual G2 demo: the full G-code is not published.', 'G28', '');
	return lines.join('\n');
}

// --- lettura ------------------------------------------------------------------

export function exists(path: string): boolean {
	return nodes.has(path) || path in ROOT_PERMISSIONS;
}

export function isDirectory(path: string): boolean {
	return path in ROOT_PERMISSIONS || nodes.get(path)?.kind === 'dir';
}

/** `GET /server/files/directory`, o `null` se la cartella non esiste. */
export function listDirectory(path: string): Record<string, unknown> | null {
	const clean = path.replace(/\/+$/, '');
	if (!isDirectory(clean)) return null;

	const dirs: Record<string, unknown>[] = [];
	const files: Record<string, unknown>[] = [];
	for (const [childPath, node] of nodes) {
		if (parentOf(childPath) !== clean) continue;
		if (node.kind === 'dir') {
			dirs.push({ dirname: nameOf(childPath), modified: node.modified, size: 4096, permissions: 'rw' });
		} else {
			files.push({
				filename: nameOf(childPath),
				modified: node.modified,
				size: node.size,
				permissions: ROOT_PERMISSIONS[rootOf(clean)] ?? 'r',
				...(node.thumbnail ? { thumbnails: thumbnailsFor(childPath, node) } : {})
			});
		}
	}

	const used = [...nodes.values()].reduce((sum, node) => sum + (node.kind === 'file' ? node.size : 0), 0);
	const total = 58 * 1024 ** 3;
	return {
		dirs,
		files,
		disk_usage: { total, used: 9.4 * 1024 ** 3 + used, free: total - 9.4 * 1024 ** 3 - used },
		root_info: { name: rootOf(clean), permissions: ROOT_PERMISSIONS[rootOf(clean)] ?? 'r' }
	};
}

/** Metadati di un G-code (`filename` relativo a `gcodes`), o `null`. */
export function getMetadata(filename: string): Metadata | null {
	const path = `gcodes/${filename}`;
	const node = nodes.get(path);
	if (!node || node.kind !== 'file') return null;
	return {
		size: node.size,
		modified: node.modified,
		uuid: `demo-${filename}`,
		...node.metadata,
		filename,
		...(node.thumbnail ? { thumbnails: thumbnailsFor(path, node) } : {})
	};
}

/** Aggiorna i metadati dopo una stampa, come fa Moonraker (`job_id`, `print_start_time`). */
export function updateMetadata(filename: string, values: Metadata): void {
	const node = nodes.get(`gcodes/${filename}`);
	if (node?.kind === 'file') node.metadata = { ...node.metadata, ...values };
}

/** Contenuto di un file, o `null` se non esiste. */
export async function readFile(path: string): Promise<Blob | string | null> {
	const node = nodes.get(path);
	if (!node || node.kind !== 'file') return null;
	if (node.blob) return node.blob;
	if (node.text !== undefined) return node.text;
	if (rootOf(path) === 'gcodes') return gcodeHeader(node);
	return '';
}

// --- scrittura ----------------------------------------------------------------

function itemFor(path: string): Record<string, unknown> {
	const node = nodes.get(path);
	return {
		root: rootOf(path),
		path: path.slice(rootOf(path).length + 1),
		modified: node?.modified ?? now(),
		size: node?.kind === 'file' ? node.size : 4096,
		permissions: 'rw'
	};
}

function announce(action: string, path: string, source?: string): void {
	broadcast('notify_filelist_changed', [
		{
			action,
			item: itemFor(path),
			...(source ? { source_item: { root: rootOf(source), path: source.slice(rootOf(source).length + 1) } } : {})
		}
	]);
}

export class StorageError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
	}
}

function assertWritable(path: string): void {
	if (!ROOT_PERMISSIONS[rootOf(path)]?.includes('w')) {
		throw new StorageError(`Access Denied: ${rootOf(path)}`, 403);
	}
}

/** Testa e coda di un G-code caricato: Orca scrive i metadati in fondo. */
async function readGcodeMetadata(file: Blob): Promise<Metadata> {
	const chunk = 256 * 1024;
	const head = await file.slice(0, chunk).text();
	const tail = file.size > chunk ? await file.slice(Math.max(chunk, file.size - chunk)).text() : '';
	return parseGcodeMetadata(`${head}\n${tail}`);
}

/** `POST /server/files/upload`. */
export async function uploadFile(root: string, subdir: string, file: File): Promise<Record<string, unknown>> {
	const dir = subdir ? `${root}/${subdir.replace(/^\/+|\/+$/g, '')}` : root;
	const path = `${dir}/${file.name}`;
	assertWritable(path);
	const existed = nodes.has(path);
	ensureParents(path);

	const node: FileNode = { kind: 'file', modified: now(), size: file.size };
	if (root === 'gcodes') {
		node.blob = file;
		node.metadata = await readGcodeMetadata(file);
	} else {
		node.text = await file.text();
	}
	nodes.set(path, node);
	announce(existed ? 'modify_file' : 'create_file', path);
	return { item: itemFor(path), action: existed ? 'modify_file' : 'create_file' };
}

/** Aggiunge un G-code (import da USB), senza contenuto proprio. */
export function addGcode(path: string, metadata: Metadata, size: number, thumbnail?: Thumbnail): void {
	ensureParents(path);
	nodes.set(path, { kind: 'file', modified: now(), size, metadata, thumbnail });
	announce('create_file', path);
}

export function deleteFile(path: string): void {
	assertWritable(path);
	const node = nodes.get(path);
	if (!node || node.kind !== 'file') throw new StorageError(`File ${path} does not exist`, 404);
	const item = itemFor(path);
	nodes.delete(path);
	broadcast('notify_filelist_changed', [{ action: 'delete_file', item }]);
}

export function createDirectory(path: string): void {
	assertWritable(path);
	if (nodes.has(path)) throw new StorageError(`Directory ${path} already exists`, 400);
	ensureParents(path);
	nodes.set(path, { kind: 'dir', modified: now() });
	announce('create_dir', path);
}

export function deleteDirectory(path: string, force: boolean): void {
	assertWritable(path);
	if (nodes.get(path)?.kind !== 'dir') throw new StorageError(`Directory ${path} does not exist`, 404);
	const children = [...nodes.keys()].filter((key) => key.startsWith(`${path}/`));
	if (children.length > 0 && !force) throw new StorageError(`Directory ${path} is not empty`, 400);
	const item = itemFor(path);
	for (const child of children) nodes.delete(child);
	nodes.delete(path);
	broadcast('notify_filelist_changed', [{ action: 'delete_dir', item }]);
}

/** `POST /server/files/move`: file o cartella, con tutto il contenuto. */
export function moveEntry(source: string, dest: string): Record<string, unknown> {
	assertWritable(source);
	assertWritable(dest);
	const node = nodes.get(source);
	if (!node) throw new StorageError(`File ${source} does not exist`, 404);

	// Una cartella di destinazione esistente riceve l'elemento dentro di sé.
	const target = isDirectory(dest) ? `${dest}/${nameOf(source)}` : dest;
	if (nodes.has(target)) throw new StorageError(`Destination ${target} already exists`, 400);

	ensureParents(target);
	const moved = [...nodes.entries()].filter(([key]) => key === source || key.startsWith(`${source}/`));
	for (const [key] of moved) nodes.delete(key);
	for (const [key, value] of moved) nodes.set(target + key.slice(source.length), value);

	const action = node.kind === 'dir' ? 'move_dir' : 'move_file';
	announce(action, target, source);
	return { item: itemFor(target), source_item: { path: source.slice(rootOf(source).length + 1), root: rootOf(source) }, action };
}
