#!/usr/bin/env node
/**
 * Rigenera i due file di dati della pagina `/settings/timezone`:
 *
 *   src/lib/data/timezones.ts   elenco delle zone IANA con le loro coordinate
 *   src/lib/data/world-map.ts   sagoma delle terre emerse, come singolo path SVG
 *
 * Uso:  node script/generate-timezone-data.mjs
 *
 * Le zone vengono lette da `zone.tab` di tzdata, cioè lo stesso file che sta sul
 * Raspberry Pi sotto `/usr/share/zoneinfo/`: l'elenco generato è per costruzione
 * quello che `timedatectl set-timezone` accetta. Va rigenerato quando tzdata
 * cambia (zone aggiunte, rinominate o ritirate), non a ogni build.
 *
 * La mappa viene da Natural Earth (`ne_110m_land`, pubblico dominio), scaricata
 * al volo: serve rete solo quando si esegue questo script, mai a runtime.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ZONE_TAB = '/usr/share/zoneinfo/zone.tab';
const ISO3166_TAB = '/usr/share/zoneinfo/iso3166.tab';
const LAND_URL =
	'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson';

// Ritaglio della mappa. La proiezione è equirettangolare, quindi la longitudine
// copre sempre tutto il giro; in latitudine si taglia sopra le isole artiche
// disabitate e sotto il continente antartico, per non sprecare metà altezza in
// bianco. I due valori sono anche l'altezza del viewBox generato.
const LAT_TOP = 84;
const LAT_BOTTOM = -80;

/** Punti più vicini di così, dopo la proiezione, collassano in uno solo. */
const GRID = 0.1;
/** Poligoni il cui bounding box è più piccolo di così vengono scartati. */
const MIN_SIZE = 0.6;

// --- zone -------------------------------------------------------------------

/** `+4230` / `-100503` → gradi decimali. */
function parseAngle(raw, degDigits) {
	const sign = raw[0] === '-' ? -1 : 1;
	const digits = raw.slice(1);
	const deg = Number(digits.slice(0, degDigits));
	const min = Number(digits.slice(degDigits, degDigits + 2));
	const sec = digits.length > degDigits + 2 ? Number(digits.slice(degDigits + 2)) : 0;
	return sign * (deg + min / 60 + sec / 3600);
}

function readTabLines(path) {
	return readFileSync(path, 'utf8')
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line && !line.startsWith('#'));
}

function buildZones() {
	const countries = new Map();
	for (const line of readTabLines(ISO3166_TAB)) {
		const [code, name] = line.split('\t');
		countries.set(code, name);
	}

	const zones = [];
	for (const line of readTabLines(ZONE_TAB)) {
		const [code, coordinates, id] = line.split('\t');
		// La longitudine ha tre cifre di gradi, la latitudine due; il campo è la
		// concatenazione delle due senza separatore.
		const split = coordinates.length === 11 ? 5 : 7;
		zones.push({
			id,
			countryCode: code,
			country: countries.get(code) ?? code,
			lat: Number(parseAngle(coordinates.slice(0, split), 2).toFixed(2)),
			lon: Number(parseAngle(coordinates.slice(split), 3).toFixed(2))
		});
	}

	zones.sort((a, b) => a.id.localeCompare(b.id));
	return zones;
}

function writeZones(zones) {
	// Apici singoli come nel resto del progetto. `src/lib/data/` è in
	// `.prettierignore`: una riga per zona resta leggibile in diff anche quando
	// supera le 100 colonne del formatter.
	const quote = (text) => `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
	const rows = zones
		.map(
			(z) =>
				`\t{ id: ${quote(z.id)}, country: ${quote(z.country)}, countryCode: '${z.countryCode}', lat: ${z.lat}, lon: ${z.lon} }`
		)
		.join(',\n');

	const source = `// GENERATO DA script/generate-timezone-data.mjs — non modificare a mano.
// Sorgente: zone.tab di tzdata (pubblico dominio), lo stesso file installato sul
// Raspberry Pi sotto /usr/share/zoneinfo/. ${zones.length} zone.

export interface TimezoneEntry {
	/** Identificatore IANA, es. \`Europe/Rome\`. È ciò che si passa a timedatectl. */
	id: string;
	/** Nome del paese secondo iso3166.tab, per disambiguare città omonime. */
	country: string;
	/** Codice ISO 3166-1 alpha-2. */
	countryCode: string;
	/** Coordinate della città di riferimento della zona, in gradi decimali. */
	lat: number;
	lon: number;
}

export const TIMEZONES: TimezoneEntry[] = [
${rows}
];
`;

	mkdirSync(resolve(ROOT, 'src/lib/data'), { recursive: true });
	writeFileSync(resolve(ROOT, 'src/lib/data/timezones.ts'), source);
	console.log(`src/lib/data/timezones.ts — ${zones.length} zone`);
}

// --- mappa ------------------------------------------------------------------

/** Equirettangolare, con l'origine nell'angolo in alto a sinistra del ritaglio. */
function project([lon, lat]) {
	return [lon + 180, LAT_TOP - lat];
}

function quantize(points) {
	const out = [];
	for (const point of points) {
		const x = Math.round(point[0] / GRID) * GRID;
		const y = Math.round(point[1] / GRID) * GRID;
		const previous = out[out.length - 1];
		if (previous && previous[0] === x && previous[1] === y) continue;
		out.push([x, y]);
	}
	return out;
}

function isNegligible(points) {
	const xs = points.map((p) => p[0]);
	const ys = points.map((p) => p[1]);
	return (
		Math.max(...xs) - Math.min(...xs) < MIN_SIZE && Math.max(...ys) - Math.min(...ys) < MIN_SIZE
	);
}

function ringToPath(ring) {
	const projected = quantize(ring.map(project));
	if (projected.length < 3 || isNegligible(projected)) return '';

	const fmt = (n) => {
		const rounded = Number(n.toFixed(1));
		return String(rounded);
	};

	// L'ultimo punto di un anello GeoJSON ripete il primo: `Z` lo rende superfluo.
	const body = projected
		.slice(1, -1)
		.map(([x, y]) => `${fmt(x)} ${fmt(y)}`)
		.join('L');
	return `M${fmt(projected[0][0])} ${fmt(projected[0][1])}L${body}Z`;
}

async function buildMap() {
	const response = await fetch(LAND_URL);
	if (!response.ok) throw new Error(`Download della mappa fallito: ${response.status}`);
	const geojson = await response.json();

	const polygons = [];
	for (const feature of geojson.features) {
		const { type, coordinates } = feature.geometry;
		if (type === 'Polygon') polygons.push(coordinates);
		else if (type === 'MultiPolygon') polygons.push(...coordinates);
	}

	// Solo l'anello esterno: i laghi interni non aggiungono nulla a una mappa
	// decorativa e raddoppierebbero il peso del path.
	const path = polygons
		.map((rings) => ringToPath(rings[0]))
		.filter(Boolean)
		.join('');

	const source = `// GENERATO DA script/generate-timezone-data.mjs — non modificare a mano.
// Sorgente: Natural Earth ne_110m_land (pubblico dominio), semplificata a una
// griglia di ${GRID}° e senza le isole minori.

/** Latitudine del bordo superiore e inferiore del ritaglio, in gradi. */
export const MAP_LAT_TOP = ${LAT_TOP};
export const MAP_LAT_BOTTOM = ${LAT_BOTTOM};

/** Dimensioni del viewBox: un'unità = un grado, origine in alto a sinistra. */
export const MAP_WIDTH = 360;
export const MAP_HEIGHT = ${LAT_TOP - LAT_BOTTOM};

/**
 * Terre emerse in proiezione equirettangolare, come unico path SVG.
 * Coordinate: \`x = lon + 180\`, \`y = ${LAT_TOP} - lat\`.
 */
export const WORLD_LAND_PATH =
	'${path}';
`;

	mkdirSync(resolve(ROOT, 'src/lib/data'), { recursive: true });
	writeFileSync(resolve(ROOT, 'src/lib/data/world-map.ts'), source);
	console.log(`src/lib/data/world-map.ts — path di ${path.length} caratteri`);
}

writeZones(buildZones());
await buildMap();
