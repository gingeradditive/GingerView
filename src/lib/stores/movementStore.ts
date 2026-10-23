import { get, writable } from 'svelte/store';
import { getMoonrakerApiUrl } from '$lib/services/config';
import { describeError, readError, runGcode } from '$lib/services/moonraker-gcode';
import { loadNozzleZones } from '$lib/services/moonraker-zones';
import { toastActions } from '$lib/stores/toastStore';

/**
 * State of the movement page that has to outlive the page itself.
 *
 * Both slides are unmounted the moment the user navigates away, and leaving
 * `/movement` mid-operation is the normal thing to do: an extrude spends most
 * of its time heating, and the temperatures live on the dashboard. With the
 * state local to the components, coming back showed an idle "EXTRUDE" button
 * and the default parameters, as if nothing were running.
 *
 * Keeping both the parameters and the running sequence in a module-level store
 * means the sequence is driven from outside the component tree: it keeps
 * advancing while the page is gone, and the page renders whatever is actually
 * happening when it comes back.
 */

export type Amount = 'low' | 'mid' | 'high';
export type Speed = 'slow' | 'standard' | 'boost';
export type Temperature = 'petg' | 'pla' | 'custom';
export type ExtrudePhase = 'idle' | 'homing' | 'moving' | 'heating' | 'extruding';

/**
 * One target per heated zone of the single nozzle, keyed by the Klipper object
 * name (`extruder`, `extruder1`, ...). Which keys exist depends on the machine
 * and is read at runtime — see `loadNozzleZones()`.
 */
export type TemperatureZones = Record<string, number>;

export type TemperaturePreset = {
	zones: TemperatureZones;
	// Klipper rotation_distance for this material; not shown in the UI.
	rotationVolume: number;
};

export const DEFAULT_ZONE_TEMPERATURE_C = 200;

export const amountOptions: { value: Amount; label: string; volumeMm3: number }[] = [
	{ value: 'low', label: 'Low', volumeMm3: 1000 },
	{ value: 'mid', label: 'Mid', volumeMm3: 10000 },
	{ value: 'high', label: 'High', volumeMm3: 20000 }
];

export const speedOptions: { value: Speed; label: string; speedMm3PerS: number }[] = [
	{ value: 'slow', label: 'Slow', speedMm3PerS: 50 },
	{ value: 'standard', label: 'Standard', speedMm3PerS: 150 },
	{ value: 'boost', label: 'Boost', speedMm3PerS: 250 }
];

export const temperatureOptions: { value: Temperature; label: string }[] = [
	{ value: 'petg', label: 'PETG' },
	{ value: 'pla', label: 'PLA' },
	{ value: 'custom', label: 'Custom' }
];

/**
 * Per-material settings.
 *
 * The temperatures are given as "the first zone" plus "all the others" rather
 * than one value per zone: the number of zones is only known once the machine
 * has been asked, and the presets never distinguished more than those two groups
 * anyway — PETG runs the zone Klipper calls `extruder` cooler than the rest,
 * PLA is flat.
 */
export type MaterialPreset = {
	firstZoneC: number;
	otherZonesC: number;
	// Klipper rotation_distance for this material; not shown in the UI.
	rotationVolume: number;
};

export const materialPresets: Record<'petg' | 'pla', MaterialPreset> = {
	petg: { firstZoneC: 200, otherZonesC: 220, rotationVolume: 450 },
	pla: { firstZoneC: 200, otherZonesC: 200, rotationVolume: 330 }
};

/**
 * Targets for `zones`, keeping whatever the stored preset already says and
 * filling in every zone it does not mention. A custom preset saved before the
 * zone list was known — or on a machine with a different one — stays usable.
 */
export const fillZoneTemperatures = (zones: string[], stored: TemperatureZones): TemperatureZones =>
	Object.fromEntries(zones.map((zone) => [zone, stored[zone] ?? DEFAULT_ZONE_TEMPERATURE_C]));

// --- selected parameters -----------------------------------------------------

export const extrudeAmount = writable<Amount>('mid');
export const extrudeSpeed = writable<Speed>('standard');
export const extrudeTemperature = writable<Temperature>('pla');
// Empty until the popup is opened: only then is the zone list known, and the
// fields are filled with `DEFAULT_ZONE_TEMPERATURE_C` for the zones this machine
// turns out to have.
export const customTemperaturePreset = writable<TemperaturePreset>({
	zones: {},
	rotationVolume: 330
});

// --- running operations ------------------------------------------------------

export const extrudePhase = writable<ExtrudePhase>('idle');

/**
 * Come è finita l'ultima sequenza, per il pannello: "Done" per qualche secondo, oppure la
 * fase che ha fallito con "Retry". `null` mentre gira e quando non c'è niente da dire. Il
 * toast di errore resta: questo serve a chi guarda il pannello, il toast a chi è altrove.
 */
export type ExtrudeOutcome =
	| { status: 'done' }
	| { status: 'failed'; phase: Exclude<ExtrudePhase, 'idle'>; message: string };

export const extrudeOutcome = writable<ExtrudeOutcome | null>(null);

/**
 * Cancel chiesto dall'utente. La sequenza lo guarda tra un comando e l'altro: quello già
 * mandato a Kalico non si interrompe (un G28 arriva in fondo), ma l'attesa del calore e
 * l'estrusione sono spezzate apposta in pezzi brevi, così Cancel risponde in pochi secondi.
 */
export const extrudeCancelRequested = writable(false);

export const cancelExtrudeSequence = (): void => {
	if (get(extrudePhase) !== 'idle') extrudeCancelRequested.set(true);
};

class ExtrudeCancelled extends Error {}

const throwIfCancelled = (): void => {
	if (get(extrudeCancelRequested)) throw new ExtrudeCancelled();
};

const HEAT_POLL_MS = 1000;
// Durata di un pezzo di estrusione: tra un pezzo e il successivo si guarda Cancel.
const EXTRUDE_CHUNK_S = 5;

/**
 * Aspetta che ogni zona arrivi al suo target, controllando Cancel a ogni giro. Fa quello
 * che faceva `TEMPERATURE_WAIT` (soglia minima, nessun timeout), ma senza bloccare la coda
 * di Kalico, che altrimenti non si poteva fermare se non con l'arresto d'emergenza.
 */
const waitForZones = async (targets: Record<string, number>): Promise<void> => {
	const query = Object.keys(targets).join('&');
	for (;;) {
		throwIfCancelled();
		const response = await fetch(`${getMoonrakerApiUrl()}/printer/objects/query?${query}`);
		if (!response.ok) {
			throw new Error(await readError(response, 'Could not read the nozzle temperatures'));
		}
		const status = (await response.json())?.result?.status ?? {};
		const reached = Object.entries(targets).every(
			([zone, target]) =>
				typeof status[zone]?.temperature === 'number' && status[zone].temperature >= target
		);
		if (reached) return;
		await new Promise((resolve) => setTimeout(resolve, HEAT_POLL_MS));
	}
};

/**
 * True while a `G28` is in flight, whatever started it — the Home button on the
 * first slide or the homing step of the extrude sequence on the second. One
 * flag for both keeps the Home button honest: it reads "Homing..." for any
 * homing the machine is doing, not only the one that button asked for.
 */
export const homingBusy = writable(false);

// --- Move panel --------------------------------------------------------------

export type Axis = 'x' | 'y' | 'z';
export type AxisPosition = Record<Axis, number>;

/**
 * Jog steps of the Move panel. On a machine of about a metre per side the range
 * goes from a nudge to half the bed; anything longer is what the coordinate
 * fields are for.
 */
export const jogStepOptions: { mm: number; label: string }[] = [
	{ mm: 1, label: '1 mm' },
	{ mm: 10, label: '1 cm' },
	{ mm: 100, label: '10 cm' },
	{ mm: 500, label: '50 cm' }
];

// Kept here rather than in the panel, so reopening it keeps the last step.
export const jogStepMm = writable(10);

/** Commands of the Move panel still waiting for Kalico's answer. */
export const moveRequestsInFlight = writable(0);

// Purge/maintenance position: nozzle centered on X, front of the bed, well clear of it on Z.
const getPurgePositionX = async (): Promise<number> => {
	const response = await fetch(
		`${getMoonrakerApiUrl()}/printer/objects/query?toolhead=axis_maximum`
	);
	if (!response.ok) {
		throw new Error(await readError(response, 'Could not read the bed size'));
	}
	const payload = await response.json();
	const axisMaximum = payload?.result?.status?.toolhead?.axis_maximum;
	if (!Array.isArray(axisMaximum) || typeof axisMaximum[0] !== 'number') {
		throw new Error('axis_maximum unavailable');
	}
	return axisMaximum[0] / 2;
};

/**
 * True when Klipper already knows where X, Y and Z are, so the extrude sequence
 * can go straight to the purge position. Any doubt — query refused, field
 * missing — answers false: an extra `G28` costs time, a skipped one would move
 * from an unknown position.
 */
const isHomed = async (): Promise<boolean> => {
	try {
		const response = await fetch(
			`${getMoonrakerApiUrl()}/printer/objects/query?toolhead=homed_axes`
		);
		if (!response.ok) return false;
		const payload = await response.json();
		const homedAxes = payload?.result?.status?.toolhead?.homed_axes;
		return (
			typeof homedAxes === 'string' && ['x', 'y', 'z'].every((axis) => homedAxes.includes(axis))
		);
	} catch {
		return false;
	}
};

const resolveTemperaturePreset = (zones: string[]): TemperaturePreset => {
	const selected = get(extrudeTemperature);
	if (selected === 'custom') {
		const custom = get(customTemperaturePreset);
		return {
			zones: fillZoneTemperatures(zones, custom.zones),
			rotationVolume: custom.rotationVolume
		};
	}

	const preset = materialPresets[selected];
	return {
		zones: Object.fromEntries(
			zones.map((zone, index) => [zone, index === 0 ? preset.firstZoneC : preset.otherZonesC])
		),
		rotationVolume: preset.rotationVolume
	};
};

// Which step gave up, as the title of the toast. `idle` cannot fail — the
// sequence is not running — but the map has to cover the whole type.
const phaseFailureTitles: Record<ExtrudePhase, string> = {
	idle: 'Something went wrong while extruding',
	homing: "Couldn't home",
	moving: "Couldn't reach the purge spot",
	heating: "Couldn't heat up",
	extruding: "Couldn't extrude"
};

export const startHoming = async (): Promise<void> => {
	if (get(homingBusy)) return;
	homingBusy.set(true);
	try {
		await runGcode('G28');
	} catch (error) {
		// The button goes back to "Home" either way, so without a toast a refused
		// homing is indistinguishable from one that worked.
		console.error('Homing failed', error);
		toastActions.error('klipper', "Couldn't home", describeError(error));
	} finally {
		homingBusy.set(false);
	}
};

export const startExtrudeSequence = async (): Promise<void> => {
	if (get(extrudePhase) !== 'idle') return;
	// Zones whose target this sequence set, so they are switched off again at
	// the end — whether the extrusion finished or something failed on the way.
	let heatedZones: string[] = [];
	extrudeOutcome.set(null);
	extrudeCancelRequested.set(false);
	try {
		// Leave `idle` before the first await, or a second tap during the homed
		// check would start a second sequence.
		extrudePhase.set('moving');
		if (!(await isHomed())) {
			extrudePhase.set('homing');
			homingBusy.set(true);
			try {
				await runGcode('G28');
			} finally {
				homingBusy.set(false);
			}
			extrudePhase.set('moving');
		}

		throwIfCancelled();
		const centerX = await getPurgePositionX();
		await runGcode(`G90\nG1 X${centerX} Y0 Z250 F3000`);
		throwIfCancelled();

		extrudePhase.set('heating');
		// Heating the wrong set of zones is worse than not heating at all: a zone
		// left cold blocks the nozzle. If the machine cannot say which zones it
		// has, the sequence stops here instead of guessing.
		const zones = await loadNozzleZones();
		if (zones.length === 0) {
			throw new Error("Couldn't read the nozzle zones from the printer");
		}
		const preset = resolveTemperaturePreset(zones);
		const setTemperatures = zones.map(
			(zone) => `SET_HEATER_TEMPERATURE HEATER=${zone} TARGET=${preset.zones[zone]}`
		);
		heatedZones = zones;
		await runGcode(setTemperatures.join('\n'));
		await waitForZones(preset.zones);

		extrudePhase.set('extruding');
		const amountValue = amountOptions.find((option) => option.value === get(extrudeAmount))!;
		const speedValue = speedOptions.find((option) => option.value === get(extrudeSpeed))!;
		// `zones[0]` is `extruder`, the only zone with a stepper behind it — the
		// others are heaters. Assumes its rotation_distance is calibrated in
		// mm3-per-rotation for the active material ("rotation volume"), so a relative
		// E move of <volumeMm3> mm dispenses that many mm3. Unconfirmed on real
		// hardware — see Q32 in docs/Q&A.md.
		// In pezzi da EXTRUDE_CHUNK_S secondi, con Cancel guardato tra un pezzo e l'altro:
		// un'unica mossa da 20 cm³ a Slow durava quasi 7 minuti e non si fermava.
		const feed = speedValue.speedMm3PerS * 60;
		const chunkMm3 = speedValue.speedMm3PerS * EXTRUDE_CHUNK_S;
		await runGcode(
			`SET_EXTRUDER_ROTATION_DISTANCE EXTRUDER=${zones[0]} DISTANCE=${preset.rotationVolume}`
		);
		let remaining = amountValue.volumeMm3;
		while (remaining > 0) {
			throwIfCancelled();
			const chunk = Math.min(chunkMm3, remaining);
			await runGcode(
				[
					'M83',
					`G1 E${chunk} F${feed}`,
					'M82',
					// The script returns once the move is queued, not done: wait for it,
					// or the heaters would be switched off mid-extrusion.
					'M400'
				].join('\n')
			);
			remaining -= chunk;
		}
		extrudeOutcome.set({ status: 'done' });
	} catch (error) {
		if (error instanceof ExtrudeCancelled) {
			toastActions.info('klipper', 'Extrude cancelled', 'The heaters have been switched off.');
			return;
		}
		// `extrudePhase` still holds the step that failed — `finally` resets it
		// after this block — so the toast can say where the sequence stopped.
		const failedPhase = get(extrudePhase);
		console.error(`Extrude sequence failed during ${failedPhase}`, error);
		toastActions.error('klipper', phaseFailureTitles[failedPhase], describeError(error));
		if (failedPhase !== 'idle') {
			extrudeOutcome.set({ status: 'failed', phase: failedPhase, message: describeError(error) });
		}
	} finally {
		if (heatedZones.length > 0) {
			try {
				await runGcode(
					heatedZones.map((zone) => `SET_HEATER_TEMPERATURE HEATER=${zone} TARGET=0`).join('\n')
				);
			} catch (error) {
				console.error("Couldn't turn the nozzle heaters off", error);
				toastActions.error(
					'klipper',
					'Heaters are still on',
					"Couldn't turn the nozzle heaters off. Keep an eye on them",
					undefined,
					describeError(error)
				);
			}
		}
		extrudeCancelRequested.set(false);
		extrudePhase.set('idle');
	}
};

// XY at 100 mm/s: brisk on a metre of travel, still easy to follow by eye. Z at
// 7 mm/s, the machine's max_z_velocity — Kalico would clamp anything higher.
const MOVE_FEED_XY = 6000;
const MOVE_FEED_Z = 420;

const formatCoordinate = (value: number): string => String(Number(value.toFixed(3)));

/**
 * Moves the toolhead from `from` to `to` in absolute coordinates.
 *
 * Z and XY go as two separate moves, ordered so the nozzle never travels across
 * the bed lower than it has to: going up, Z first; going down, XY first. On a
 * metre-wide bed a diagonal that lowers Z while crossing it can hit a part.
 *
 * Returns false when Kalico refused the move (out of range, not homed, ...), so
 * the caller can drop the position it was counting on; the reason is toasted.
 */
export const moveToolhead = async (from: AxisPosition, to: AxisPosition): Promise<boolean> => {
	const xyMove =
		to.x !== from.x || to.y !== from.y
			? `G1 X${formatCoordinate(to.x)} Y${formatCoordinate(to.y)} F${MOVE_FEED_XY}`
			: null;
	const zMove = to.z !== from.z ? `G1 Z${formatCoordinate(to.z)} F${MOVE_FEED_Z}` : null;
	const moves = (to.z > from.z ? [zMove, xyMove] : [xyMove, zMove]).filter(
		(line): line is string => line !== null
	);
	if (moves.length === 0) return true;

	moveRequestsInFlight.update((count) => count + 1);
	try {
		await runGcode(['G90', ...moves].join('\n'));
		return true;
	} catch (error) {
		console.error('Move failed', error);
		toastActions.error('klipper', "Couldn't move there", describeError(error));
		return false;
	} finally {
		moveRequestsInFlight.update((count) => count - 1);
	}
};
