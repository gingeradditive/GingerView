import { getMoonrakerApiUrl } from './config';
import { readError } from './moonraker-gcode';

/**
 * Le macro della stampante, per la pagina Impostazioni → Macro.
 *
 * Arrivano da `configfile.settings`, cioè da ciò che Kalico ha caricato da
 * `printer.cfg`: lì c'è sia la `description` sia il template `gcode`, da cui si
 * ricavano i parametri. Le chiavi sono in minuscolo (`gcode_macro purge`), ma
 * Kalico registra i comandi in maiuscolo, quindi il nome si rimette in maiuscolo.
 */

export type MacroParam = { name: string; default?: string };

export type Macro = {
	name: string;
	description?: string;
	params: MacroParam[];
};

const MACRO_PREFIX = 'gcode_macro ';

// `_NOME` è per convenzione una macro interna, chiamata da altre macro; `M104`,
// `G28` sono override di comandi G-code, non azioni da lanciare a mano.
const isHidden = (name: string): boolean => name.startsWith('_') || /^[GM]\d+$/.test(name);

// La descrizione che Kalico mette quando la macro non ne dichiara una.
const DEFAULT_DESCRIPTION = 'G-Code macro';

// `params.NOME`, `params['NOME']` o `params["NOME"]`, seguito dai filtri Jinja
// (`|int`, `|default(1)|float`...), da cui si legge il default.
const PARAM_USE = /params(?:\.(\w+)|\[\s*['"](\w+)['"]\s*\])((?:\s*\|\s*\w+(?:\([^)]*\))?)*)/g;
const DEFAULT_FILTER = /\|\s*default\(\s*([^),]+?)\s*[,)]/;

/** Solo un default letterale (numero o stringa tra apici) ha senso come valore precompilato. */
const literalDefault = (raw: string | undefined): string | undefined => {
	if (!raw) return undefined;
	if (/^-?\d+(\.\d+)?$/.test(raw)) return raw;
	const quoted = /^(['"])(.*)\1$/.exec(raw);
	return quoted ? quoted[2] : undefined;
};

/** I parametri letti dal template, nell'ordine in cui compaiono, senza doppioni. */
export const parseParams = (template: string): MacroParam[] => {
	const params = new Map<string, MacroParam>();
	for (const match of template.matchAll(PARAM_USE)) {
		const name = (match[1] ?? match[2]).toUpperCase();
		const fallback = literalDefault(DEFAULT_FILTER.exec(match[3] ?? '')?.[1]);
		const known = params.get(name);
		if (!known) params.set(name, { name, default: fallback });
		else if (known.default === undefined && fallback !== undefined) known.default = fallback;
	}
	return [...params.values()];
};

export const fetchMacros = async (): Promise<Macro[]> => {
	let response: Response;
	try {
		response = await fetch(`${getMoonrakerApiUrl()}/printer/objects/query?configfile=settings`);
	} catch {
		throw new Error("Can't reach Moonraker");
	}
	if (!response.ok) {
		throw new Error(await readError(response, "Couldn't load the macros"));
	}

	const payload = await response.json();
	const settings: Record<string, Record<string, unknown>> = payload?.result?.status?.configfile
		?.settings ?? {};

	return Object.entries(settings)
		.filter(([key]) => key.startsWith(MACRO_PREFIX))
		.map(([key, section]) => {
			const description =
				typeof section.description === 'string' && section.description !== DEFAULT_DESCRIPTION
					? section.description
					: undefined;
			const template = typeof section.gcode === 'string' ? section.gcode : '';
			return {
				name: key.slice(MACRO_PREFIX.length).trim().toUpperCase(),
				description,
				params: parseParams(template)
			};
		})
		.filter((macro) => !isHidden(macro.name))
		.sort((a, b) => a.name.localeCompare(b.name));
};

/** La riga da mandare a Kalico: `NOME P1=v P2=v`, i parametri vuoti omessi. */
export const macroCommand = (name: string, values: Record<string, string>): string =>
	[
		name,
		...Object.entries(values)
			.map(([param, value]) => [param, value.trim()])
			.filter(([, value]) => value !== '')
			.map(([param, value]) => `${param}=${/\s/.test(value) ? `"${value}"` : value}`)
	].join(' ');
