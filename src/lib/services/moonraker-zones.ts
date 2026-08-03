import { getMoonrakerApiUrl } from './config';

/**
 * The heated zones of the nozzle, as the machine declares them.
 *
 * Kalico has no notion of a multi-zone nozzle, so the configuration declares one
 * extruder per zone — `extruder`, `extruder1`, ... — driven together (see
 * [04 — Moonraker](../../../docs/04-moonraker.md)). How many there are depends
 * on the machine: four on the G2, three on the G1. A list fixed in the code is
 * therefore wrong on every model but one, so it comes from
 * `/printer/objects/list`, which is what Klipper actually loaded from
 * `printer.cfg`.
 */

// `extruder` and `extruderN`, nothing else: an `extruder_stepper foo` or a
// `heater_generic` is not a zone of the nozzle, and Klipper lists those too.
const ZONE_NAME = /^extruder(\d*)$/;

// Klipper numbers the extruders after the first one, which has no suffix, so
// `extruder` sorts as zone 0 and the interface can count them 1..n in order.
const zoneOrder = (name: string): number => Number(ZONE_NAME.exec(name)?.[1] || 0);

let cachedZones: string[] | null = null;
let pendingZones: Promise<string[]> | null = null;

const requestZones = async (): Promise<string[]> => {
	const response = await fetch(`${getMoonrakerApiUrl()}/printer/objects/list`);
	if (!response.ok) {
		throw new Error(`objects/list refused: ${response.status} ${response.statusText}`);
	}

	const payload = await response.json();
	const objects = payload?.result?.objects;
	if (!Array.isArray(objects)) {
		throw new Error('objects/list returned no object list');
	}

	const zones = objects
		.filter((object: unknown): object is string => typeof object === 'string')
		.filter((object) => ZONE_NAME.test(object))
		.sort((a, b) => zoneOrder(a) - zoneOrder(b));

	// A machine with no extruder at all is a configuration nobody prints with:
	// treat it as a failed read rather than caching "this nozzle has no zones".
	if (zones.length === 0) {
		throw new Error('objects/list contains no extruder');
	}
	return zones;
};

/**
 * The zone list, `[]` when the machine could not be asked.
 *
 * The answer is cached because it only changes with `printer.cfg`; a failure is
 * not, since Klippy is unreachable during a restart and while it is starting up.
 * Callers poll or are driven by a tap, so the next call tries again on its own.
 * Concurrent calls share the request in flight.
 */
export const loadNozzleZones = async (): Promise<string[]> => {
	if (cachedZones) return cachedZones;
	if (pendingZones) return pendingZones;

	const request = requestZones()
		.then((zones) => {
			cachedZones = zones;
			return zones;
		})
		.catch((error) => {
			console.error('Could not read the nozzle zones', error);
			return [];
		})
		.finally(() => {
			pendingZones = null;
		});

	pendingZones = request;
	return request;
};

/**
 * Drops the cached list, so the next read asks the machine again.
 *
 * Called when a restart is requested: Klipper comes back with whatever
 * `printer.cfg` says now, and the config editor is one of the places that can
 * have just changed it.
 */
export const forgetNozzleZones = (): void => {
	cachedZones = null;
};
