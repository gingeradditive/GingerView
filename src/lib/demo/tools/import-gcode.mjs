#!/usr/bin/env node
/**
 * Aggiunge G-code veri alla lista file della demo.
 *
 * Del file si tengono solo i metadati e la miniatura più grande: il G-code
 * completo non viene pubblicato (vedi DEMO.md, "File di stampa").
 *
 *     node src/lib/demo/tools/import-gcode.mjs [--dir Cartella] [--reset] file.gcode ...
 *
 *   --dir    sottocartella di `gcodes` in cui far comparire i file
 *   --reset  svuota la lista prima di aggiungere (le miniature vecchie restano
 *            su disco finché non si cancellano a mano)
 *
 * Scrive `src/lib/demo/files/catalog.json` e `src/lib/demo/files/thumbs/*.png`.
 * Un file già presente con lo stesso percorso viene sostituito.
 */
import { readFileSync, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractThumbnails, parseGcodeMetadata } from '../gcode-meta.js';

const here = dirname(fileURLToPath(import.meta.url));
const filesDir = join(here, '..', 'files');
const thumbsDir = join(filesDir, 'thumbs');
const catalogPath = join(filesDir, 'catalog.json');

const args = process.argv.slice(2);
let folder = '';
let reset = false;
const inputs = [];
for (let i = 0; i < args.length; i++) {
	if (args[i] === '--dir') folder = (args[++i] ?? '').replace(/^\/+|\/+$/g, '');
	else if (args[i] === '--reset') reset = true;
	else inputs.push(args[i]);
}

if (inputs.length === 0) {
	console.error('Uso: import-gcode.mjs [--dir Cartella] [--reset] file.gcode ...');
	process.exit(1);
}

mkdirSync(thumbsDir, { recursive: true });
/** @type {Array<Record<string, unknown>>} */
let catalog =
	!reset && existsSync(catalogPath) ? JSON.parse(readFileSync(catalogPath, 'utf8')) : [];

const slug = (/** @type {string} */ text) =>
	text
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-zA-Z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.toLowerCase();

for (const input of inputs) {
	const text = readFileSync(input, 'utf8');
	const name = basename(input);
	const path = folder ? `${folder}/${name}` : name;
	const metadata = parseGcodeMetadata(text);

	/** @type {Record<string, unknown> | undefined} */
	let thumbnail;
	const [best] = extractThumbnails(text);
	if (best) {
		const file = `${slug(path.replace(/\.gcode$/i, ''))}.png`;
		const png = Buffer.from(best.base64, 'base64');
		writeFileSync(join(thumbsDir, file), png);
		thumbnail = { file, width: best.width, height: best.height, size: png.length };
	}

	catalog = catalog.filter((entry) => entry.path !== path);
	catalog.push({
		path,
		size: statSync(input).size,
		modified: Math.round(statSync(input).mtimeMs / 1000),
		thumbnail,
		metadata
	});

	const hours =
		typeof metadata.estimated_time === 'number' ? (metadata.estimated_time / 3600).toFixed(1) : '?';
	console.log(
		`+ ${path}  (${hours} h, ${metadata.filament_type ?? '?'}, miniatura ${best ? `${best.width}x${best.height}` : 'assente'})`
	);
}

catalog.sort((a, b) => String(a.path).localeCompare(String(b.path)));
writeFileSync(catalogPath, `${JSON.stringify(catalog, null, '\t')}\n`);
console.log(`Scritto ${catalogPath} (${catalog.length} file)`);
