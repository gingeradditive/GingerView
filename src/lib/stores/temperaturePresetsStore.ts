import { get, writable } from 'svelte/store';
import { getDbItem, setDbItem } from '$lib/services/moonraker-database';
import { materialPresets } from '$lib/stores/movementStore';
import { toastActions } from '$lib/stores/toastStore';

/**
 * Preset di temperatura del popup "Temperatures" della dashboard: una temperatura per
 * zona dell'ugello più il piatto, da mettere nei campi con un tocco.
 *
 * Due famiglie:
 * - **di base** (PLA, PETG): costanti, costruite da `materialPresets` — gli stessi valori
 *   di Heat & Extrude — per le zone che la macchina ha davvero. Non si modificano;
 * - **personalizzati**: salvati nel database di Moonraker (`gingerview` /
 *   `temperature_presets`), quindi uguali da ogni dispositivo. Si creano dal popup o da
 *   Settings → Temperature presets.
 *
 * Una temperatura a 0 vuol dire "spenta", come nei campi del popup.
 */
export type HeaterPreset = {
	id: string;
	name: string;
	/** Per nome Kalico della zona: `extruder`, `extruder1`, … */
	zones: Record<string, number>;
	bed: number;
	builtIn?: boolean;
};

/** Kalico accetta fino a max_temp (1000, valore di calibrazione): l'interfaccia si ferma a un limite da pellet. */
export const MAX_NOZZLE_TEMPERATURE = 300;
/** max_temp di [heater_bed] in 30_bed.cfg. */
export const MAX_BED_TEMPERATURE = 110;
/** Abbastanza per "PETG Black 2" e per stare in un chip. */
export const MAX_PRESET_NAME_LENGTH = 24;

const DB_KEY = 'temperature_presets';

export const customTemperaturePresets = writable<HeaterPreset[]>([]);

/** PLA e PETG per le zone di questa macchina: la prima zona e "tutte le altre", come in Heat & Extrude. */
export function builtInPresets(zones: string[]): HeaterPreset[] {
	return (['pla', 'petg'] as const).map((key) => {
		const material = materialPresets[key];
		return {
			id: `builtin-${key}`,
			name: key.toUpperCase(),
			zones: Object.fromEntries(
				zones.map((zone, index) => [zone, index === 0 ? material.firstZoneC : material.otherZonesC])
			),
			bed: material.bedC,
			builtIn: true
		};
	});
}

const isTemperature = (value: unknown): value is number =>
	typeof value === 'number' && Number.isInteger(value) && value >= 0;

/** Scarta quello che nel database non ha la forma giusta, invece di rompere il popup. */
function parsePresets(value: unknown): HeaterPreset[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((item): HeaterPreset[] => {
		if (typeof item !== 'object' || item === null) return [];
		const { id, name, zones, bed } = item as Record<string, unknown>;
		if (typeof id !== 'string' || typeof name !== 'string' || !isTemperature(bed)) return [];
		if (typeof zones !== 'object' || zones === null) return [];
		const cleanZones = Object.fromEntries(
			Object.entries(zones).filter((entry): entry is [string, number] => isTemperature(entry[1]))
		);
		return [{ id, name, zones: cleanZones, bed }];
	});
}

let inFlight: Promise<void> | null = null;

/**
 * Rilegge i preset personalizzati dalla stampante. Si chiama a ogni apertura del popup e
 * della pagina: un preset salvato dal telefono deve comparire anche sul computer senza
 * ricaricare. Se Moonraker non risponde resta l'ultimo elenco noto.
 */
export function loadTemperaturePresets(): Promise<void> {
	if (!inFlight) {
		inFlight = getDbItem(DB_KEY)
			.then((value) => customTemperaturePresets.set(parsePresets(value)))
			.catch(() => {
				// Stampante irraggiungibile: si tiene quello che c'è.
			})
			.finally(() => {
				inFlight = null;
			});
	}
	return inFlight;
}

/**
 * Cambia l'elenco subito a schermo e lo salva. Se il salvataggio fallisce torna a quello
 * di prima e lo dice: un preset che sembra salvato ma non lo è sparirebbe al prossimo avvio.
 */
async function persist(next: HeaterPreset[], failure: string): Promise<boolean> {
	const previous = get(customTemperaturePresets);
	customTemperaturePresets.set(next);
	try {
		await setDbItem(
			DB_KEY,
			next.map(({ id, name, zones, bed }) => ({ id, name, zones, bed }))
		);
		return true;
	} catch (error) {
		customTemperaturePresets.set(previous);
		toastActions.error(
			'system',
			failure,
			error instanceof Error ? error.message : "Can't reach Moonraker"
		);
		return false;
	}
}

/** Nuovo id: niente `crypto.randomUUID`, che sulla stampante (http, non https) non c'è. */
export const newPresetId = (): string =>
	`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Crea o sostituisce (stesso `id`) un preset personalizzato. */
export function saveTemperaturePreset(preset: HeaterPreset): Promise<boolean> {
	const list = get(customTemperaturePresets);
	const clean = { ...preset, name: preset.name.trim(), builtIn: undefined };
	const exists = list.some((item) => item.id === preset.id);
	const next = exists
		? list.map((item) => (item.id === preset.id ? clean : item))
		: [...list, clean];
	return persist(next, "Couldn't save the preset");
}

export function deleteTemperaturePreset(id: string): Promise<boolean> {
	const next = get(customTemperaturePresets).filter((item) => item.id !== id);
	return persist(next, "Couldn't delete the preset");
}

/** Il nome è già usato (anche da PLA/PETG)? Senza distinguere maiuscole, escluso `exceptId`. */
export function isPresetNameTaken(name: string, zones: string[], exceptId?: string): boolean {
	const wanted = name.trim().toLowerCase();
	return [...builtInPresets(zones), ...get(customTemperaturePresets)].some(
		(item) => item.id !== exceptId && item.name.toLowerCase() === wanted
	);
}

/**
 * I valori da mettere nei campi del popup (`null` = spenta). Una zona che il preset non
 * conosce — salvato su una macchina con meno zone — resta com'era.
 */
export function presetTargets(
	preset: HeaterPreset,
	zones: string[],
	current: (number | null)[]
): (number | null)[] {
	return zones.map((zone, index) => {
		const value = preset.zones[zone];
		if (value === undefined) return current[index] ?? null;
		return value > 0 ? value : null;
	});
}

/** I campi coincidono con il preset? Serve a evidenziare il chip giusto. */
export function matchesPreset(
	preset: HeaterPreset,
	zones: string[],
	values: (number | null)[],
	bed: number | null
): boolean {
	if ((bed ?? 0) !== preset.bed) return false;
	return zones.every((zone, index) => preset.zones[zone] === (values[index] ?? 0));
}

/** "200° · bed 60°", "200–220° · bed off": quanto basta per riconoscerlo. */
export function presetSummary(preset: HeaterPreset): string {
	const on = Object.values(preset.zones).filter((value) => value > 0);
	let nozzle = 'nozzle off';
	if (on.length > 0) {
		const low = Math.min(...on);
		const high = Math.max(...on);
		nozzle = low === high ? `${low}°` : `${low}–${high}°`;
	}
	return `${nozzle} · bed ${preset.bed > 0 ? `${preset.bed}°` : 'off'}`;
}
