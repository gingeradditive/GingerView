import { get, writable } from 'svelte/store';
import { getMoonrakerApiUrl } from '$lib/services/config';
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

// One nozzle, four heated zones (see extruderKeys in DashboardTemperaturePanel).
export type TemperatureZones = { extruder: number; extruder1: number; extruder2: number; extruder3: number };

export type TemperaturePreset = {
	zones: TemperatureZones;
	// Klipper rotation_distance for this material; not shown in the UI.
	rotationVolume: number;
};

export const zoneKeys: (keyof TemperatureZones)[] = ['extruder', 'extruder1', 'extruder2', 'extruder3'];

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

export const temperaturePresets: Record<'petg' | 'pla', TemperaturePreset> = {
	petg: {
		zones: { extruder: 200, extruder1: 220, extruder2: 220, extruder3: 220 },
		rotationVolume: 450
	},
	pla: {
		zones: { extruder: 200, extruder1: 200, extruder2: 200, extruder3: 200 },
		rotationVolume: 330
	}
};

// --- selected parameters -----------------------------------------------------

export const extrudeAmount = writable<Amount>('mid');
export const extrudeSpeed = writable<Speed>('standard');
export const extrudeTemperature = writable<Temperature>('pla');
export const customTemperaturePreset = writable<TemperaturePreset>({
	zones: { extruder: 200, extruder1: 200, extruder2: 200, extruder3: 200 },
	rotationVolume: 330
});

// --- running operations ------------------------------------------------------

export const extrudePhase = writable<ExtrudePhase>('idle');

/**
 * True while a `G28` is in flight, whatever started it — the Home button on the
 * first slide or the homing step of the extrude sequence on the second. One
 * flag for both keeps the Home button honest: it reads "Homing..." for any
 * homing the machine is doing, not only the one that button asked for.
 */
export const homingBusy = writable(false);

/**
 * Moonraker reports a refused command as `{"error": {"message": ...}}` with a
 * non-2xx status. That message is the one worth showing ("Must home axis first",
 * "Printer is shutdown"), so prefer it over the bare HTTP status text.
 */
const readError = async (response: Response, fallback: string): Promise<string> => {
	try {
		const payload = await response.json();
		const message = payload?.error?.message;
		if (typeof message === 'string' && message.trim()) return message;
	} catch {
		// Body was not JSON — fall through to the generic message.
	}
	return `${fallback}: ${response.status} ${response.statusText}`;
};

/**
 * Throws when the printer refuses the command.
 *
 * Kalico answers `printer/gcode/script` only once every command in the script
 * has run, so a non-2xx here means the machine did **not** do what was asked.
 * The caller has to know: an extrude sequence that ignored a failed `G28` went
 * on to move, heat and extrude from an unknown position.
 */
const runGcode = async (script: string): Promise<void> => {
	let response: Response;
	try {
		response = await fetch(`${getMoonrakerApiUrl()}/printer/gcode/script?script=${encodeURIComponent(script)}`, {
			method: 'POST'
		});
	} catch {
		throw new Error('Moonraker is unreachable');
	}
	if (!response.ok) {
		throw new Error(await readError(response, 'Command refused'));
	}
};

// Purge/maintenance position: nozzle centered on X, front of the bed, well clear of it on Z.
const getPurgePositionX = async (): Promise<number> => {
	const response = await fetch(`${getMoonrakerApiUrl()}/printer/objects/query?toolhead=axis_maximum`);
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

const resolveTemperaturePreset = (): TemperaturePreset => {
	const selected = get(extrudeTemperature);
	return selected === 'custom' ? get(customTemperaturePreset) : temperaturePresets[selected];
};

const describeError = (error: unknown): string =>
	error instanceof Error ? error.message : 'Unknown error';

// Which step gave up, as the title of the toast. `idle` cannot fail — the
// sequence is not running — but the map has to cover the whole type.
const phaseFailureTitles: Record<ExtrudePhase, string> = {
	idle: 'Extrude failed',
	homing: 'Homing failed',
	moving: 'Move to purge position failed',
	heating: 'Heating failed',
	extruding: 'Extrusion failed'
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
		toastActions.error('klipper', 'Homing failed', describeError(error));
	} finally {
		homingBusy.set(false);
	}
};

export const startExtrudeSequence = async (): Promise<void> => {
	if (get(extrudePhase) !== 'idle') return;
	try {
		extrudePhase.set('homing');
		homingBusy.set(true);
		try {
			await runGcode('G28');
		} finally {
			homingBusy.set(false);
		}

		extrudePhase.set('moving');
		const centerX = await getPurgePositionX();
		await runGcode(`G90\nG1 X${centerX} Y0 Z250 F3000`);

		extrudePhase.set('heating');
		const preset = resolveTemperaturePreset();
		const setTemperatures = zoneKeys.map(
			(key) => `SET_HEATER_TEMPERATURE HEATER=${key} TARGET=${preset.zones[key]}`
		);
		const waitTemperatures = zoneKeys.map((key) => `TEMPERATURE_WAIT SENSOR=${key} MINIMUM=${preset.zones[key]}`);
		await runGcode([...setTemperatures, ...waitTemperatures].join('\n'));

		extrudePhase.set('extruding');
		const amountValue = amountOptions.find((option) => option.value === get(extrudeAmount))!;
		const speedValue = speedOptions.find((option) => option.value === get(extrudeSpeed))!;
		// Assumes `extruder`'s rotation_distance is calibrated in mm3-per-rotation for the
		// active material ("rotation volume"), so a relative E move of <volumeMm3> mm
		// dispenses that many mm3. Unconfirmed on real hardware — see Q32 in docs/Q&A.md.
		await runGcode(
			[
				`SET_EXTRUDER_ROTATION_DISTANCE EXTRUDER=extruder DISTANCE=${preset.rotationVolume}`,
				'M83',
				`G1 E${amountValue.volumeMm3} F${speedValue.speedMm3PerS * 60}`,
				'M82'
			].join('\n')
		);
	} catch (error) {
		// `extrudePhase` still holds the step that failed — `finally` resets it
		// after this block — so the toast can say where the sequence stopped.
		const failedPhase = get(extrudePhase);
		console.error(`Extrude sequence failed during ${failedPhase}`, error);
		toastActions.error('klipper', phaseFailureTitles[failedPhase], describeError(error));
	} finally {
		extrudePhase.set('idle');
	}
};
