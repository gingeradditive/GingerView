import { demoConfig } from './config';
import { emit } from './events';
import { broadcast, connections } from './notify';
import { getMetadata } from './storage';
import * as history from './history';

/**
 * La G2 simulata: lo stato che Klipper esporrebbe come oggetti, i comandi
 * G-code che GingerView manda, e una stampa con l'orologio accelerato.
 *
 * Non è una simulazione fedele (vedi DEMO.md): temperature, movimenti e tempi
 * sono compressi perché la demo resti viva e una stampa duri pochi minuti.
 * Lo stato si legge con `getStatus()`, nel formato di
 * `printer.objects.query`; chi vuole le notifiche le calcola per differenza
 * a ogni passo (vedi `socket.ts`).
 */

export type Status = Record<string, Record<string, unknown>>;

/** Un comando rifiutato: il messaggio è quello che Klipper mostrerebbe. */
export class GcodeError extends Error {}

export const ZONES = ['extruder', 'extruder1', 'extruder2', 'extruder3'];

const AXIS_MIN = [0, 0, -5];
const AXIS_MAX = [1100, 1000, 1050];
/** Dove G28 lascia la testina. */
const HOME_POSITION = [0, 0, 40];
/** Parcheggio per riscaldamento e fine stampa: fuori dal piano, davanti. */
const PARK_POSITION = [1050, 30, 60];
/** Centro del pezzo simulato. */
const PRINT_CENTER = [550, 500];
const MAX_Z_SPEED = 7; // mm/s, come la macchina vera
const TICK_MS = 250;

// --- stato --------------------------------------------------------------------

type KlippyState = 'ready' | 'startup' | 'shutdown';

let klippy: KlippyState = 'ready';
let stateMessage = 'Printer is ready';

/**
 * Un riscaldatore con la sua fisica, semplificata: la resistenza scalda a
 * `rate` °C/s a piena potenza, il blocco disperde verso l'ambiente con
 * costante `lossTau`, e la potenza arriva al blocco con un ritardo `lag`.
 * Un PI con feed-forward la regola. I parametri sono un po' diversi per ogni
 * zona, così le curve salgono separate e a regime oscillano di qualche decimo,
 * come su una macchina vera.
 */
type Heater = {
	temperature: number;
	target: number;
	maxTemp: number;
	rate: number;
	lossTau: number;
	lag: number;
	ambient: number;
	/** Errore di taratura del feed-forward: l'integrale lo recupera a regime. */
	feedForwardError: number;
	/** Fase del disturbo lento (correnti d'aria, ventola, pellet che entra). */
	phase: number;
	power: number;
	integral: number;
};

const heater = (
	maxTemp: number,
	rate: number,
	lossTau: number,
	lag: number,
	ambient: number,
	feedForwardError: number
): Heater => ({
	temperature: ambient,
	target: 0,
	maxTemp,
	rate,
	lossTau,
	lag,
	ambient,
	feedForwardError,
	phase: Math.random() * Math.PI * 2,
	power: 0,
	integral: 0
});

const heaters: Record<string, Heater> = {
	extruder: heater(300, 8.0, 50, 2.2, 22.4, 1.04),
	extruder1: heater(300, 7.2, 46, 2.8, 23.1, 0.97),
	extruder2: heater(300, 6.7, 52, 3.1, 22.7, 1.06),
	extruder3: heater(300, 7.6, 44, 2.5, 23.4, 0.95),
	heater_bed: heater(110, 1.9, 95, 4.0, 22.1, 1.03)
};

type Move = { from: number[]; to: number[]; duration: number; elapsed: number; eVelocity: number };

const live = [550, 500, 300];
let commanded = [...live];
const queue: Move[] = [];
let homedAxes = '';
let steppersOn = false;
let absolute = true;
let absoluteE = true;
let feedRate = 3000; // mm/min
let ePosition = 0;
let liveVelocity = 0;
let liveExtruderVelocity = 0;

let fanSpeed = 0;
let led = [0, 0, 0, 0];
let feeder = 0;
let speedFactor = 1;
let extrudeFactor = 1;

const printStats = {
	filename: '',
	state: 'standby',
	print_duration: 0,
	total_duration: 0,
	filament_used: 0,
	message: '',
	info: { total_layer: null as number | null, current_layer: null as number | null }
};
let progress = 0;

type Job = {
	filename: string;
	historyId: string;
	metadata: Record<string, unknown>;
	phase: 'heating' | 'printing';
	/** Secondi reali passati nella fase corrente. */
	phaseElapsed: number;
	/** Secondi reali del riscaldamento, contati nel tempo di stampa. */
	heatingSeconds: number;
	/** Durata reale della fase di stampa. */
	printSeconds: number;
	estimated: number;
	layers: number;
	layerHeight: number;
	filamentTotal: number;
};

let job: Job | null = null;

// --- attese -------------------------------------------------------------------

type Waiter = { check: () => boolean; resolve: () => void; reject: (error: Error) => void };
const waiters = new Set<Waiter>();

function waitFor(check: () => boolean): Promise<void> {
	if (check()) return Promise.resolve();
	return new Promise((resolve, reject) => waiters.add({ check, resolve, reject }));
}

function sleep(seconds: number): Promise<void> {
	let left = seconds;
	let last = performance.now();
	return waitFor(() => {
		const now = performance.now();
		left -= (now - last) / 1000;
		last = now;
		return left <= 0;
	});
}

function rejectWaiters(message: string): void {
	for (const waiter of waiters) waiter.reject(new GcodeError(message));
	waiters.clear();
}

// --- lettura ------------------------------------------------------------------

const round = (value: number, digits = 2): number => {
	const factor = 10 ** digits;
	return Math.round(value * factor) / factor;
};

/** Un decimo di grado di rumore, come un termistore vero. */
function displayedTemperature(heater: Heater): number {
	return round(heater.temperature + (Math.random() - 0.5) * 0.25);
}

function heaterPower(heater: Heater): number {
	return round(heater.power, 2);
}

/** Tutti gli oggetti di Klipper che la demo conosce, completi. */
export function getStatus(): Status {
	const position = [round(live[0], 3), round(live[1], 3), round(live[2], 3), round(ePosition, 3)];
	const gcodePosition = [
		round(commanded[0], 3),
		round(commanded[1], 3),
		round(commanded[2], 3),
		round(ePosition, 3)
	];
	const status: Status = {
		webhooks: { state: klippy, state_message: stateMessage },
		print_stats: {
			...printStats,
			print_duration: round(printStats.print_duration, 1),
			total_duration: round(printStats.total_duration, 1),
			filament_used: round(printStats.filament_used, 1),
			info: { ...printStats.info }
		},
		virtual_sdcard: {
			file_path: printStats.filename ? `/home/pi/printer_data/gcodes/${printStats.filename}` : null,
			progress: round(progress, 4),
			is_active: job !== null && printStats.state === 'printing',
			file_position: Math.round(progress * 1_000_000),
			file_size: 1_000_000
		},
		display_status: { progress: round(progress, 4), message: null },
		pause_resume: { is_paused: printStats.state === 'paused' },
		idle_timeout: {
			state: job ? 'Printing' : queue.length > 0 ? 'Printing' : 'Idle',
			printing_time: 0
		},
		toolhead: {
			position,
			homed_axes: homedAxes,
			axis_minimum: [...AXIS_MIN, 0],
			axis_maximum: [...AXIS_MAX, 0],
			max_velocity: 500,
			max_accel: 3000,
			extruder: 'extruder',
			estimated_print_time: round(performance.now() / 1000, 1),
			print_time: round(performance.now() / 1000, 1)
		},
		gcode_move: {
			gcode_position: gcodePosition,
			position: gcodePosition,
			homing_origin: [0, 0, 0, 0],
			speed: job?.phase === 'printing' ? 6000 : feedRate,
			speed_factor: speedFactor,
			extrude_factor: extrudeFactor,
			absolute_coordinates: absolute,
			absolute_extrude: absoluteE
		},
		motion_report: {
			live_position: position,
			live_velocity: round(liveVelocity, 1),
			live_extruder_velocity: round(liveExtruderVelocity, 1)
		},
		stepper_enable: {
			steppers: {
				stepper_x: steppersOn,
				stepper_y: steppersOn,
				stepper_z: steppersOn,
				extruder: steppersOn
			}
		},
		fan: { speed: round(fanSpeed, 3), rpm: null },
		'led LED_CAMERA': { color_data: [led.map((value) => round(value, 3))] },
		'output_pin _FEEDER_STATUS': { value: feeder }
	};

	for (const [name, heater] of Object.entries(heaters)) {
		status[name] = {
			temperature: displayedTemperature(heater),
			target: heater.target,
			power: heaterPower(heater),
			...(name.startsWith('extruder')
				? { can_extrude: heater.temperature >= 170, pressure_advance: 0, smooth_time: 0.04 }
				: {})
		};
	}
	return status;
}

export function objectNames(): string[] {
	return [
		...Object.keys(getStatus()),
		'configfile',
		'gcode_macro START_PRINT',
		'gcode_macro END_PRINT',
		'gcode_macro PAUSE',
		'gcode_macro RESUME',
		'gcode_macro CANCEL_PRINT',
		'gcode_macro FEEDER_ENABLE',
		'gcode_macro FEEDER_DISABLE'
	];
}

/** `printer.objects.query`: gli oggetti chiesti, con i soli campi chiesti. */
export function queryObjects(objects: Record<string, string[] | null>): Status {
	const status = getStatus();
	const result: Status = {};
	for (const [name, fields] of Object.entries(objects)) {
		const object = status[name];
		if (!object) continue;
		if (!fields || fields.length === 0) {
			result[name] = object;
			continue;
		}
		result[name] = Object.fromEntries(
			fields.filter((field) => field in object).map((field) => [field, object[field]])
		);
	}
	return result;
}

export function getKlippyState(): { state: KlippyState; message: string } {
	return { state: klippy, message: stateMessage };
}

/** Per il livello demo: la stampa in corso e quanto è accelerata. */
export function getJobInfo(): {
	filename: string;
	phase: 'heating' | 'printing';
	speedup: number;
	paused: boolean;
} | null {
	if (!job) return null;
	return {
		filename: job.filename,
		phase: job.phase,
		speedup: job.estimated / job.printSeconds,
		paused: printStats.state === 'paused'
	};
}

// --- simulazione --------------------------------------------------------------

let thermalClock = 0;

function stepHeaters(dt: number): void {
	thermalClock += dt;
	for (const heater of Object.values(heaters)) {
		let command = 0;
		if (heater.target > 0) {
			const error = heater.target - heater.temperature;
			const feedForward =
				((heater.target - heater.ambient) / (heater.rate * heater.lossTau)) *
				heater.feedForwardError;
			// L'integrale lavora solo vicino al target, come l'anti-windup di Klipper.
			if (Math.abs(error) < 15)
				heater.integral = Math.min(0.1, Math.max(-0.1, heater.integral + error * 0.002 * dt));
			command = Math.min(1, Math.max(0, feedForward + 0.09 * error + heater.integral));
		} else {
			heater.integral = 0;
		}
		heater.power += (command - heater.power) * (1 - Math.exp(-dt / heater.lag));
		const disturbance = heater.target > 0 ? 0.15 * Math.sin(thermalClock / 7 + heater.phase) : 0;
		heater.temperature +=
			(heater.power * heater.rate -
				(heater.temperature - heater.ambient) / heater.lossTau +
				disturbance) *
			dt;
	}
}

function stepMotion(dt: number): void {
	liveVelocity = 0;
	if (!job || job.phase !== 'printing') liveExtruderVelocity = 0;

	let left = dt;
	while (left > 0 && queue.length > 0) {
		const move = queue[0];
		const step = Math.min(left, move.duration - move.elapsed);
		move.elapsed += step;
		left -= step;

		const t = move.duration > 0 ? move.elapsed / move.duration : 1;
		for (let axis = 0; axis < 3; axis++)
			live[axis] = move.from[axis] + (move.to[axis] - move.from[axis]) * t;

		const distance = Math.hypot(...move.to.map((value, axis) => value - move.from[axis]));
		liveVelocity =
			move.duration > 0 ? (distance / move.duration) * (1 / demoConfig.motionSpeedup) : 0;
		liveExtruderVelocity = move.eVelocity;

		if (move.elapsed >= move.duration) queue.shift();
	}
}

/** Aggiunge un movimento in coda; la durata tiene conto dell'accelerazione demo. */
function enqueue(to: number[], feed: number, eDelta = 0, fixedSeconds?: number): void {
	const from = queue.length > 0 ? queue[queue.length - 1].to : [...live];
	const distance = Math.hypot(to[0] - from[0], to[1] - from[1]);
	const zDistance = Math.abs(to[2] - from[2]);
	const speed = Math.max(1, (feed * speedFactor) / 60);
	const nominal =
		fixedSeconds ??
		Math.max(distance / speed, zDistance / Math.min(speed, MAX_Z_SPEED), Math.abs(eDelta) / speed);
	const duration = fixedSeconds ?? nominal / demoConfig.motionSpeedup;
	queue.push({
		from,
		to: [...to],
		duration,
		elapsed: 0,
		eVelocity: eDelta !== 0 && nominal > 0 ? eDelta / nominal : 0
	});
	commanded = [...to];
}

function clearMotion(): void {
	queue.length = 0;
	commanded = [...live];
	liveVelocity = 0;
	liveExtruderVelocity = 0;
}

function stepJob(dt: number): void {
	if (!job || printStats.state !== 'printing') {
		if (job && printStats.state === 'paused') printStats.total_duration += dt;
		return;
	}

	job.phaseElapsed += dt;

	if (job.phase === 'heating') {
		printStats.print_duration += dt;
		printStats.total_duration += dt;
		const ready = Object.values(heaters).every(
			(heater) => heater.target <= 0 || heater.temperature >= heater.target - 1
		);
		if ((ready && queue.length === 0) || job.phaseElapsed >= demoConfig.heatingMaxSeconds) {
			job.heatingSeconds = job.phaseElapsed;
			job.phase = 'printing';
			job.phaseElapsed = 0;
			queue.length = 0;
			emit('print:phase', { filename: job.filename, phase: 'printing' });
		}
		return;
	}

	progress = Math.min(1, job.phaseElapsed / job.printSeconds);
	printStats.print_duration = job.heatingSeconds + progress * job.estimated;
	printStats.total_duration = Math.max(printStats.total_duration, printStats.print_duration);
	printStats.filament_used = progress * job.filamentTotal;

	const layer = Math.min(job.layers, Math.floor(progress * job.layers) + 1);
	printStats.info = { total_layer: job.layers, current_layer: layer };

	// La testina gira attorno al pezzo, uno strato alla volta: abbastanza per
	// vedere assi e quota muoversi, senza pretendere di seguire il G-code.
	const angle = (job.phaseElapsed / 5) * Math.PI * 2;
	const z = layer * job.layerHeight;
	const radius = 170 + 40 * Math.sin(z / 90);
	live[0] = PRINT_CENTER[0] + radius * Math.cos(angle);
	live[1] = PRINT_CENTER[1] + radius * Math.sin(angle);
	live[2] = z;
	commanded = [...live];
	liveVelocity = (2 * Math.PI * radius) / 5;
	liveExtruderVelocity = 140 + 25 * Math.sin(job.phaseElapsed * 1.7);
	if (layer > 1 && fanSpeed === 0) fanSpeed = 0.6;

	if (progress >= 1) finishJob('complete');
}

function step(dt: number): void {
	stepHeaters(dt);
	if (klippy === 'ready') {
		stepMotion(dt);
		stepJob(dt);
	}
	for (const waiter of [...waiters]) {
		if (waiter.check()) {
			waiters.delete(waiter);
			waiter.resolve();
		}
	}
}

let lastTick = 0;
let running = false;

/** Avvia l'orologio del simulatore. Le notifiche partono a ogni passo. */
export function startSimulation(): void {
	if (running) return;
	running = true;
	lastTick = performance.now();
	setInterval(() => {
		const now = performance.now();
		// Con il telefono bloccato i timer si fermano: al ritorno il tempo perso si
		// recupera a passi di un secondo, così la stampa è andata avanti davvero.
		let elapsed = Math.min((now - lastTick) / 1000, 3600);
		lastTick = now;
		while (elapsed > 0) {
			const dt = Math.min(1, elapsed);
			step(dt);
			elapsed -= dt;
		}
		for (const connection of connections) connection.onTick();
	}, TICK_MS);
}

// --- stampa -------------------------------------------------------------------

function heatersOff(): void {
	for (const heater of Object.values(heaters)) heater.target = 0;
}

function finishJob(state: 'complete' | 'cancelled' | 'error'): void {
	if (!job) return;
	const finished = job;
	job = null;

	if (state === 'complete') {
		progress = 1;
		printStats.print_duration = finished.heatingSeconds + finished.estimated;
		printStats.filament_used = finished.filamentTotal;
	}
	printStats.state = state;
	printStats.total_duration = Math.max(printStats.total_duration, printStats.print_duration);
	heatersOff();
	fanSpeed = 0;
	feeder = 0;
	liveExtruderVelocity = 0;

	if (state !== 'error') {
		// END_PRINT: su di 10 mm, poi parcheggio.
		clearMotion();
		enqueue([live[0], live[1], Math.min(AXIS_MAX[2], live[2] + 10)], 420);
		enqueue([HOME_POSITION[0], live[1], Math.min(AXIS_MAX[2], live[2] + 10)], 6000);
	}

	history.finishJob(
		finished.historyId,
		state === 'complete' ? 'completed' : state === 'cancelled' ? 'cancelled' : 'klippy_shutdown',
		{
			print_duration: printStats.print_duration,
			total_duration: printStats.total_duration,
			filament_used: printStats.filament_used
		}
	);

	if (state === 'complete') emit('print:complete', { filename: finished.filename });
	if (state === 'cancelled') emit('print:cancel', { filename: finished.filename });
}

export function startPrint(filename: string): void {
	if (klippy !== 'ready')
		throw new GcodeError(klippy === 'shutdown' ? 'Printer is shutdown' : 'Printer is not ready');
	if (job) throw new GcodeError('Printer is busy: a print is already running');

	const metadata = getMetadata(filename);
	if (!metadata) throw new GcodeError(`File ${filename} does not exist`);

	const estimated = Number(metadata.estimated_time) > 0 ? Number(metadata.estimated_time) : 3600;
	const printSeconds = Math.min(
		demoConfig.printMaxSeconds,
		Math.max(demoConfig.printMinSeconds, (estimated / 3600) * demoConfig.secondsPerPrintHour)
	);
	const layerHeight = Number(metadata.layer_height) > 0 ? Number(metadata.layer_height) : 2;
	const objectHeight = Number(metadata.object_height) > 0 ? Number(metadata.object_height) : 300;

	job = {
		filename,
		historyId: history.startJob(filename),
		metadata,
		phase: 'heating',
		phaseElapsed: 0,
		heatingSeconds: 0,
		printSeconds,
		estimated,
		layers: Math.max(1, Math.round(objectHeight / layerHeight)),
		layerHeight,
		filamentTotal: Number(metadata.filament_total) > 0 ? Number(metadata.filament_total) : 0
	};

	progress = 0;
	Object.assign(printStats, {
		filename,
		state: 'printing',
		print_duration: 0,
		total_duration: 0,
		filament_used: 0,
		message: '',
		info: { total_layer: job.layers, current_layer: 0 }
	});

	// START_PRINT: feeder, piatto, zone, homing e parcheggio durante il riscaldamento.
	const zoneTarget = Number(metadata.first_layer_extr_temp ?? metadata.extruder_temp) || 200;
	const bedTarget = Number(metadata.first_layer_bed_temp ?? metadata.bed_temp) || 50;
	heaters.heater_bed.target = Math.min(heaters.heater_bed.maxTemp, bedTarget);
	for (const zone of ZONES) heaters[zone].target = zoneTarget;
	feeder = 1;
	fanSpeed = 0;
	steppersOn = true;
	clearMotion();
	enqueue([HOME_POSITION[0], HOME_POSITION[1], Math.max(live[2], HOME_POSITION[2])], 0, 0, 2);
	enqueue(HOME_POSITION, 0, 0, 1);
	homedAxes = 'xyz';
	enqueue(PARK_POSITION, 9000);

	emit('print:start', { filename });
	emit('print:phase', { filename, phase: 'heating' });
}

function pause(): string {
	if (printStats.state === 'paused') return 'Already paused';
	if (!job || printStats.state !== 'printing')
		throw new GcodeError('No print in progress to pause');
	printStats.state = 'paused';
	liveExtruderVelocity = 0;
	emit('print:pause', { filename: job.filename });
	return '';
}

function resume(): string {
	if (!job || printStats.state !== 'paused')
		return "The print isn't paused, so there's nothing to resume";
	printStats.state = 'printing';
	emit('print:resume', { filename: job.filename });
	return '';
}

function cancel(): void {
	if (!job) throw new GcodeError('No print in progress to cancel');
	finishJob('cancelled');
}

// --- Klippy -------------------------------------------------------------------

export function emergencyStop(): void {
	if (job) finishJob('error');
	klippy = 'shutdown';
	stateMessage =
		'Shutdown due to webhooks request\nOnce the underlying issue is corrected, use the\n"FIRMWARE_RESTART" command to reset the firmware, reload the\nconfig, and restart the host software.\nPrinter is shutdown';
	heatersOff();
	fanSpeed = 0;
	feeder = 0;
	clearMotion();
	homedAxes = '';
	steppersOn = false;
	printStats.state = printStats.filename ? 'error' : 'standby';
	printStats.message = 'Shutdown due to webhooks request';
	rejectWaiters('Printer is shutdown');
	broadcast('notify_klippy_shutdown');
	emit('klippy:shutdown', {});
}

/** Firmware restart, host restart: Klippy riparte e torna pronto in pochi secondi. */
export function restart(): void {
	if (job) finishJob('error');
	klippy = 'startup';
	stateMessage = 'Printer is restarting';
	heatersOff();
	clearMotion();
	homedAxes = '';
	steppersOn = false;
	fanSpeed = 0;
	feeder = 0;
	rejectWaiters('Printer is restarting');
	setTimeout(() => {
		klippy = 'ready';
		stateMessage = 'Printer is ready';
		Object.assign(printStats, {
			state: 'standby',
			filename: '',
			message: '',
			print_duration: 0,
			total_duration: 0,
			filament_used: 0
		});
		progress = 0;
		broadcast('notify_klippy_ready');
		emit('klippy:ready', {});
	}, 3000);
}

// --- G-code -------------------------------------------------------------------

/** Macro della G2 che la demo accetta senza effetti visibili. */
const SILENT_COMMANDS = new Set([
	'SET_EXTRUDER_ROTATION_DISTANCE',
	'SET_PRESSURE_ADVANCE',
	'SET_VELOCITY_LIMIT',
	'CLEAR_PAUSE',
	'BED_MESH_CLEAR',
	'BED_MESH_PROFILE',
	'BED_MESH_CALIBRATE',
	'BUZZER_ON',
	'BUZZER_OFF',
	'BUZZER_BEEP',
	'BUZZER_TONE_INITIAL',
	'BUZZER_TONE_FINAL',
	'LED_MESSAGE',
	'SET_GCODE_OFFSET',
	'SAVE_CONFIG',
	'SET_PIN',
	'EXTRUDER_MIXING_MULTIPLIER',
	'PROBE_UP',
	'PROBE_DOWN',
	'M117',
	'M73'
]);

const HELP_TEXT = [
	"Here's what you can try (Virtual G2):",
	'G28 - Home all axes',
	'G1 X Y Z E F - Move',
	'M104 / M109 S - Nozzle zones temperature',
	'M140 / M190 S - Bed temperature',
	'SET_HEATER_TEMPERATURE HEATER= TARGET=',
	'M106 S / M107 - Fan',
	'SET_LED LED=LED_CAMERA WHITE=',
	'FEEDER_ENABLE / FEEDER_DISABLE',
	'M84 - Motors off',
	'M114 / GET_POSITION - Position',
	'PAUSE / RESUME / CANCEL_PRINT',
	'FIRMWARE_RESTART'
].join('\n');

type Params = Record<string, string>;

function parseLine(line: string): { command: string; params: Params } {
	const [word, ...rest] = line.trim().split(/\s+/);
	const command = word.toUpperCase();
	const params: Params = {};
	for (const token of rest) {
		const equals = token.indexOf('=');
		if (equals > 0)
			params[token.slice(0, equals).toUpperCase()] = token.slice(equals + 1).replace(/^"|"$/g, '');
		else if (/^[a-zA-Z]/.test(token)) params[token[0].toUpperCase()] = token.slice(1);
	}
	return { command, params };
}

const number = (value: string | undefined, fallback = 0): number => {
	const parsed = Number.parseFloat(value ?? '');
	return Number.isFinite(parsed) ? parsed : fallback;
};

const formatPosition = (values: number[]): string =>
	`${values
		.slice(0, 3)
		.map((value) => value.toFixed(3))
		.join(' ')} [${ePosition.toFixed(3)}]`;

function assertIdle(): void {
	if (job) throw new GcodeError('Printer is busy: a print is running');
}

function setHeater(name: string, target: number): void {
	const heater = heaters[name];
	if (!heater) throw new GcodeError(`Unknown heater '${name}'`);
	if (target > heater.maxTemp) {
		throw new GcodeError(
			`Requested temperature (${target.toFixed(1)}) out of range (0.0:${heater.maxTemp.toFixed(1)})`
		);
	}
	heater.target = Math.max(0, target);
}

const reached =
	(name: string, minimum: number, maximum = Infinity) =>
	(): boolean => {
		const temperature = heaters[name].temperature;
		return temperature >= minimum - 0.5 && temperature <= maximum;
	};

async function home(params: Params): Promise<void> {
	assertIdle();
	const axes = ['X', 'Y', 'Z'].filter((axis) => axis in params);
	const all = axes.length === 0;
	const target = [...commanded];
	if (all || axes.includes('X')) target[0] = HOME_POSITION[0];
	if (all || axes.includes('Y')) target[1] = HOME_POSITION[1];
	steppersOn = true;
	enqueue([target[0], target[1], Math.max(live[2], HOME_POSITION[2])], 0, 0, 2.5);
	if (all || axes.includes('Z')) {
		target[2] = HOME_POSITION[2];
		enqueue(target, 0, 0, 1.5);
	}
	await waitFor(() => queue.length === 0);
	const homed = new Set(homedAxes.split(''));
	for (const axis of all ? ['X', 'Y', 'Z'] : axes) homed.add(axis.toLowerCase());
	homedAxes = ['x', 'y', 'z'].filter((axis) => homed.has(axis)).join('');
}

function move(params: Params): void {
	const target = [...commanded];
	const moved: number[] = [];
	['X', 'Y', 'Z'].forEach((axis, index) => {
		if (!(axis in params)) return;
		const value = number(params[axis], target[index]);
		target[index] = absolute ? value : target[index] + value;
		moved.push(index);
	});
	if ('F' in params) feedRate = number(params.F, feedRate);

	let eDelta = 0;
	if ('E' in params) {
		const value = number(params.E);
		eDelta = absoluteE ? value - ePosition : value;
		ePosition += eDelta;
	}

	if (moved.length > 0) {
		assertIdle();
		if (moved.some((index) => !homedAxes.includes('xyz'[index]))) {
			throw new GcodeError(`Must home axis first: ${formatPosition(target)}`);
		}
		if (target.some((value, index) => value < AXIS_MIN[index] || value > AXIS_MAX[index])) {
			throw new GcodeError(`Move out of range: ${formatPosition(target)}`);
		}
	}
	if (moved.length === 0 && eDelta === 0) return;
	if (eDelta !== 0 && heaters.extruder.temperature < 170) {
		throw new GcodeError(
			"Extrude below minimum temp\nSee the 'min_extrude_temp' config option for details"
		);
	}
	steppersOn = true;
	enqueue(target, feedRate, eDelta);
}

async function runLine(line: string): Promise<string> {
	const { command, params } = parseLine(line);

	switch (command) {
		case 'G28':
			await home(params);
			return '';
		case 'G0':
		case 'G1':
			move(params);
			return '';
		case 'G90':
			absolute = true;
			return '';
		case 'G91':
			absolute = false;
			return '';
		case 'M82':
			absoluteE = true;
			return '';
		case 'M83':
			absoluteE = false;
			return '';
		case 'G92':
			if ('E' in params) ePosition = number(params.E);
			return '';
		case 'M400':
			await waitFor(() => queue.length === 0);
			return '';
		case 'G4':
			await sleep(Math.min(10, number(params.P) / 1000));
			return '';
		case 'M84':
		case 'M18':
			assertIdle();
			steppersOn = false;
			homedAxes = '';
			return '';
		case 'M104':
		case 'M109': {
			const target = number(params.S);
			const zones = 'T' in params ? [ZONES[number(params.T)] ?? 'extruder'] : ZONES;
			for (const zone of zones) setHeater(zone, target);
			if (command === 'M109' && target > 0)
				await Promise.all(zones.map((zone) => waitFor(reached(zone, target))));
			return '';
		}
		case 'M140':
		case 'M190': {
			const target = number(params.S);
			setHeater('heater_bed', target);
			if (command === 'M190' && target > 0) await waitFor(reached('heater_bed', target));
			return '';
		}
		case 'SET_HEATER_TEMPERATURE':
			setHeater(params.HEATER ?? '', number(params.TARGET));
			return '';
		case 'TEMPERATURE_WAIT': {
			const sensor = params.SENSOR ?? '';
			if (!heaters[sensor]) throw new GcodeError(`Unknown sensor '${sensor}'`);
			await waitFor(
				reached(sensor, number(params.MINIMUM, -Infinity), number(params.MAXIMUM, Infinity))
			);
			return '';
		}
		case 'M106':
			fanSpeed = Math.min(1, Math.max(0, number(params.S, 255) / 255));
			return '';
		case 'M107':
			fanSpeed = 0;
			return '';
		case 'SET_LED': {
			if ((params.LED ?? '').toUpperCase() !== 'LED_CAMERA')
				throw new GcodeError(`Unknown LED '${params.LED ?? ''}'`);
			const channel = (key: string, index: number): number =>
				key in params ? Math.min(1, Math.max(0, number(params[key]))) : led[index];
			led = [channel('RED', 0), channel('GREEN', 1), channel('BLUE', 2), channel('WHITE', 3)];
			return '';
		}
		case 'FEEDER_ENABLE':
			feeder = 1;
			return '';
		case 'FEEDER_DISABLE':
			feeder = 0;
			return '';
		case 'M220':
			speedFactor = Math.max(0.1, number(params.S, 100) / 100);
			return '';
		case 'M221':
			extrudeFactor = Math.max(0.1, number(params.S, 100) / 100);
			return '';
		case 'PAUSE':
			return pause();
		case 'RESUME':
			return resume();
		case 'CANCEL_PRINT':
			cancel();
			return '';
		case 'SDCARD_RESET_FILE':
			if (job) throw new GcodeError('Cannot reset file while a print is running');
			Object.assign(printStats, {
				filename: '',
				state: 'standby',
				print_duration: 0,
				total_duration: 0,
				filament_used: 0
			});
			progress = 0;
			return '';
		case 'M112':
			emergencyStop();
			return '';
		case 'FIRMWARE_RESTART':
		case 'RESTART':
			restart();
			return '';
		case 'M115':
			return 'FIRMWARE_VERSION:v2026.09-demo FIRMWARE_NAME:Kalico (Virtual G2)';
		case 'M114':
			return `X:${commanded[0].toFixed(3)} Y:${commanded[1].toFixed(3)} Z:${commanded[2].toFixed(3)} E:${ePosition.toFixed(3)}`;
		case 'GET_POSITION':
			return [
				`toolhead: X:${live[0].toFixed(6)} Y:${live[1].toFixed(6)} Z:${live[2].toFixed(6)} E:${ePosition.toFixed(6)}`,
				`gcode: X:${commanded[0].toFixed(6)} Y:${commanded[1].toFixed(6)} Z:${commanded[2].toFixed(6)} E:${ePosition.toFixed(6)}`
			].join('\n');
		case 'STATUS':
			return 'Klipper state: Ready';
		case 'HELP':
			return HELP_TEXT;
		case 'START_PRINT':
		case 'END_PRINT':
			return '';
		default:
			if (SILENT_COMMANDS.has(command) || /^(EXTRUDER|BED|COOLER|PURGE|PROBE)_/.test(command))
				return '';
			throw new GcodeError(`Unknown command:"${command}"`);
	}
}

/**
 * Esegue uno script G-code, una riga alla volta, e risponde quando tutte le
 * righe sono state eseguite — come `printer/gcode/script`. Le risposte
 * testuali vanno anche a tutti i client come `notify_gcode_response`, che è
 * quello che legge la console.
 */
export async function runScript(script: string): Promise<string[]> {
	emit('gcode', { script });
	const output: string[] = [];
	for (const raw of script.split('\n')) {
		const line = raw.replace(/;.*$/, '').trim();
		if (!line) continue;
		if (klippy !== 'ready') {
			throw new GcodeError(klippy === 'shutdown' ? 'Printer is shutdown' : 'Printer is not ready');
		}
		const response = await runLine(line);
		if (response) {
			output.push(response);
			broadcast('notify_gcode_response', [
				response
					.split('\n')
					.map((text) => `// ${text}`)
					.join('\n')
			]);
		}
	}
	return output;
}

export { pause, resume, cancel };
