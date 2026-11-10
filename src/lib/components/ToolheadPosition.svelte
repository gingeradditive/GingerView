<script lang="ts" module>
	/**
	 * Su telefono Movement mostra questa card due volte (vedi MovementCarousel: con due sole
	 * card il loop infinito si regge solo duplicandole). Ogni istanza ha quindi un nome di
	 * sottoscrizione suo — con lo stesso nome la seconda prenderebbe il posto della prima, che
	 * resterebbe con i numeri fermi — e l'aggancio di debug muove tutte le istanze.
	 *
	 * Per la stessa ragione le frecce della tastiera le gestisce una sola istanza: la prima
	 * visibile. Altrimenti ogni tasto muoverebbe la testina due volte.
	 */
	let instanceCount = 0;
	const testSetters: ((x: number, y: number, z: number) => void)[] = [];
	const keyboardOwners: { id: number; isVisible: () => boolean }[] = [];
</script>

<script lang="ts">
	import { tooltip } from '$lib/actions/tooltip';
	import { onDestroy, onMount } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut, cubicOut, linear } from 'svelte/easing';
	import { mdiArrowDown, mdiArrowLeft, mdiArrowRight, mdiArrowUp, mdiHome } from '@mdi/js';
	import { sendGcode } from '$lib/services/moonraker-gcode';
	import HomingWarningModal from '$lib/components/HomingWarningModal.svelte';
	import {
		homingBusy,
		jogStepMm,
		jogStepOptions,
		moveRequestsInFlight,
		moveToolhead,
		startHoming,
		type Axis,
		type AxisPosition
	} from '$lib/stores/movementStore';
	import { subscribeWhileVisible } from '$lib/services/panel-subscription.svelte';

	/**
	 * La card unica di Movement: dove sta la testina (schema 3D e coordinate), il jog per
	 * spostarla e i comandi Home e Disable motors. Prima erano tre card più il popup Move.
	 *
	 * Il jog manda mosse assolute con `moveToolhead()`, che ordina Z e XY in modo che l'ugello
	 * non attraversi il piano basso. I tocchi ripetuti si sommano senza aspettare la fine del
	 * movimento.
	 */

	/** Falso quando la slide è fuori dalla viewport del carosello: l'iscrizione si ferma. */
	let { visible = true }: { visible?: boolean } = $props();

	type ToolheadTestWindow = Window & {
		setToolheadTestPosition?: (x: number, y: number, z: number) => void;
	};

	const axes: Axis[] = ['x', 'y', 'z'];

	const tweenOptions = { duration: 600, easing: cubicOut };
	const actualX = new Tween(124.6, tweenOptions);
	const actualY = new Tween(124.6, tweenOptions);
	const actualZ = new Tween(124.6, tweenOptions);
	const targetX = new Tween(124.6, tweenOptions);
	const targetY = new Tween(124.6, tweenOptions);
	const targetZ = new Tween(124.6, tweenOptions);

	let minimum = $state<AxisPosition>({ x: 0, y: 0, z: 0 });
	let maximum = $state<AxisPosition>({ x: 1000, y: 1000, z: 1000 });
	let limitsKnown = $state(false);
	let homedAxes = $state('');
	let printState = $state('');

	// Where the machine is going: the G-code position, or past it while jog
	// commands are still on their way. Repeated taps add up from here, without
	// waiting for the previous move to end.
	let commanded = $state<AxisPosition | null>(null);
	// The last G-code position the machine reported, to fall back on when a
	// move is refused: the machine stayed where it was.
	let reported: AxisPosition | null = null;

	// Optimistic default: when Kalico does not report `stepper_enable` the motor
	// state is unknown, and an enabled button is the useful fallback.
	let motorsEnabled = $state(true);
	let motorsBusy = $state(false);

	type ToolheadStatus = {
		toolhead?: {
			position?: number[];
			homed_axes?: string;
			axis_minimum?: number[];
			axis_maximum?: number[];
		};
		motion_report?: { live_position?: number[] };
		gcode_move?: { gcode_position?: number[] };
		stepper_enable?: { steppers?: Record<string, boolean> };
		print_stats?: { state?: string };
	};

	const instanceId = ++instanceCount;
	const dataSource = `movement-toolhead-${instanceId}`;
	const dataQuery =
		'toolhead=position,homed_axes,axis_minimum,axis_maximum&gcode_move=gcode_position' +
		'&stepper_enable=steppers&motion_report=live_position&print_stats=state';

	/**
	 * Dove sta davvero la testina.
	 *
	 * `toolhead.position` è la posizione **comandata**: salta al punto di arrivo appena il
	 * movimento entra in coda, mentre la macchina ci mette secondi a raggiungerlo, e a schermo
	 * sembrava già ferma lì. `motion_report.live_position` è quella reale, campionata da Kalico
	 * circa quattro volte al secondo: il disegno la segue con un'interpolazione lineare lunga
	 * quanto un campione, così il punto scorre invece di avanzare a scatti.
	 *
	 * Se `motion_report` non c'è, si anima verso il punto comandato alla velocità tipica di un
	 * movimento a mano, invece di saltarci: non è la posizione vera, ma non finge di essere
	 * già arrivata.
	 */
	const LIVE_SAMPLE_MS = 280;
	const FALLBACK_SPEED_MM_S = 50;
	const FALLBACK_MIN_MS = 600;
	const FALLBACK_MAX_MS = 8000;
	let hasLivePosition = false;
	/** Ultimo punto comandato su cui è partito il ripiego: lo stesso punto non lo fa ripartire. */
	let fallbackGoal: string | null = null;

	const animateToCommanded = (x: number, y: number, z: number): void => {
		const goal = `${x},${y},${z}`;
		if (goal === fallbackGoal) return;
		fallbackGoal = goal;
		setActual(x, y, z, fallbackDuration(x, y, z), cubicInOut);
	};

	const setActual = (x: number, y: number, z: number, duration: number, easing = linear): void => {
		actualX.set(x, { duration, easing });
		actualY.set(y, { duration, easing });
		actualZ.set(z, { duration, easing });
	};

	/** Durata del ripiego: proporzionale alla distanza, entro i limiti. */
	const fallbackDuration = (x: number, y: number, z: number): number => {
		const distance = Math.hypot(x - actualX.target, y - actualY.target, z - actualZ.target);
		const ms = (distance / FALLBACK_SPEED_MM_S) * 1000;
		return Math.min(FALLBACK_MAX_MS, Math.max(FALLBACK_MIN_MS, ms));
	};

	const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

	const actualXNorm = $derived(clamp(actualX.current / maximum.x));
	const actualYNorm = $derived(clamp(actualY.current / maximum.y));
	const actualZNorm = $derived(clamp(actualZ.current / maximum.z));

	const isoCenterX = 220;
	const isoBaseY = 160;
	const isoScaleX = 104;
	const isoScaleY = 56;
	const isoScaleZ = 104;

	const project = (x: number, y: number, z: number): { x: number; y: number } => ({
		x: isoCenterX + (x - y) * isoScaleX,
		y: isoBaseY + (x + y) * isoScaleY - z * isoScaleZ
	});

	// Gli otto vertici del cubo e il centro della base non dipendono dalla posizione:
	// sono costanti, non derivati.
	const p000 = project(0, 0, 0);
	const p100 = project(1, 0, 0);
	const p110 = project(1, 1, 0);
	const p010 = project(0, 1, 0);
	const p001 = project(0, 0, 1);
	const p101 = project(1, 0, 1);
	const p111 = project(1, 1, 1);
	const p011 = project(0, 1, 1);

	const pCenterBase = project(0.5, 0.5, 0);
	const pCenterAtZ = $derived(project(0.5, 0.5, actualZNorm));

	const planeA = $derived(project(0, 0, actualZNorm));
	const planeB = $derived(project(1, 0, actualZNorm));
	const planeC = $derived(project(1, 1, actualZNorm));
	const planeD = $derived(project(0, 1, actualZNorm));

	const actualMarker = $derived(project(actualXNorm, actualYNorm, actualZNorm));

	const pointsToString = (...points: { x: number; y: number }[]): string =>
		points.map((point) => `${point.x},${point.y}`).join(' ');

	const toPosition = (values: number[] | undefined): AxisPosition | null =>
		Array.isArray(values) && values.length > 2
			? { x: Number(values[0]) || 0, y: Number(values[1]) || 0, z: Number(values[2]) || 0 }
			: null;

	const updateToolheadPosition = (status: ToolheadStatus): void => {
		const toolhead = status.toolhead;
		if (toolhead) {
			const min = toPosition(toolhead.axis_minimum);
			const max = toPosition(toolhead.axis_maximum);
			if (min && max) {
				minimum = min;
				maximum = {
					x: max.x || maximum.x,
					y: max.y || maximum.y,
					z: max.z || maximum.z
				};
				limitsKnown = true;
			}
			if (typeof toolhead.homed_axes === 'string') homedAxes = toolhead.homed_axes;
		}

		const gcodePosition = toPosition(status.gcode_move?.gcode_position);
		if (gcodePosition) {
			targetX.set(gcodePosition.x);
			targetY.set(gcodePosition.y);
			targetZ.set(gcodePosition.z);
			// While commands are in flight `commanded` is ahead of what the machine
			// reports; once they are answered the machine is the truth again (another
			// client, a homing or a refused move may have changed it).
			reported = gcodePosition;
			if ($moveRequestsInFlight === 0) commanded = gcodePosition;
		}

		const live = status.motion_report?.live_position;
		if (Array.isArray(live) && live.length > 2) {
			hasLivePosition = true;
			setActual(Number(live[0]) || 0, Number(live[1]) || 0, Number(live[2]) || 0, LIVE_SAMPLE_MS);
		} else if (hasLivePosition) {
			// Arriva solo quello che cambia: senza live_position in questo aggiornamento la testina
			// non si è mossa, e la posizione comandata non va usata.
		} else if (toolhead && Array.isArray(toolhead.position) && toolhead.position.length > 2) {
			animateToCommanded(
				Number(toolhead.position[0]) || 0,
				Number(toolhead.position[1]) || 0,
				Number(toolhead.position[2]) || 0
			);
		} else {
			animateToCommanded(targetX.target, targetY.target, targetZ.target);
		}

		const steppers = status.stepper_enable?.steppers;
		if (steppers && typeof steppers === 'object') {
			// M84 disables every stepper at once, so any stepper still enabled
			// means the motors have not been disabled.
			motorsEnabled = Object.values(steppers).some((value) => Boolean(value));
		}

		if (typeof status.print_stats?.state === 'string') printState = status.print_stats.state;
	};

	const setTestPosition = (x: number, y: number, z: number): void => {
		actualX.set(x);
		actualY.set(y);
		actualZ.set(z);
		targetX.set(x);
		targetY.set(y);
		targetZ.set(z);
	};

	onMount(() => {
		testSetters.push(setTestPosition);
		(window as ToolheadTestWindow).setToolheadTestPosition = (x, y, z) =>
			testSetters.forEach((set) => set(x, y, z));
		keyboardOwners.push({ id: instanceId, isVisible: () => visible });
	});

	subscribeWhileVisible<ToolheadStatus>(
		dataSource,
		() => dataQuery,
		updateToolheadPosition,
		() => visible
	);

	onDestroy(() => {
		const at = testSetters.indexOf(setTestPosition);
		if (at !== -1) testSetters.splice(at, 1);
		if (typeof window !== 'undefined' && testSetters.length === 0) {
			delete (window as ToolheadTestWindow).setToolheadTestPosition;
		}
		const owner = keyboardOwners.findIndex((entry) => entry.id === instanceId);
		if (owner !== -1) keyboardOwners.splice(owner, 1);
	});

	// --- Jog ---------------------------------------------------------------

	const homed = $derived(axes.every((axis) => homedAxes.includes(axis)));
	const printing = $derived(printState === 'printing' || printState === 'paused');
	const canMove = $derived(homed && !printing && limitsKnown && commanded !== null);

	const clampAxis = (axis: Axis, value: number): number =>
		Math.min(maximum[axis], Math.max(minimum[axis], value));

	// A jog button is pointless at the end of its axis: it would send nothing.
	const canJog = (axis: Axis, direction: 1 | -1): boolean => {
		if (!canMove || !commanded) return false;
		return direction > 0
			? commanded[axis] < maximum[axis] - 0.001
			: commanded[axis] > minimum[axis] + 0.001;
	};

	const jog = async (axis: Axis, direction: 1 | -1): Promise<void> => {
		if (!canJog(axis, direction) || !commanded) return;
		const from = { ...commanded };
		const to = { ...from, [axis]: clampAxis(axis, from[axis] + direction * $jogStepMm) };
		commanded = to;
		const accepted = await moveToolhead(from, to);
		// A refused move did not happen: go back to counting from the machine.
		if (!accepted) commanded = reported;
	};

	// Il passo scelto, per le etichette dei pulsanti di jog ("Move X by +10 mm").
	const stepLabel = $derived(
		jogStepOptions.find((option) => option.mm === $jogStepMm)?.label ?? `${$jogStepMm} mm`
	);

	// Arrow keys jog X/Y and PageUp/PageDown jog Z, for whoever drives the page
	// from a desktop. Not while typing, and not under the homing confirmation.
	const keyJogs: Record<string, [Axis, 1 | -1]> = {
		ArrowUp: ['y', 1],
		ArrowDown: ['y', -1],
		ArrowLeft: ['x', -1],
		ArrowRight: ['x', 1],
		PageUp: ['z', 1],
		PageDown: ['z', -1]
	};

	const handleKeydown = (event: KeyboardEvent): void => {
		if (showHomingWarning) return;
		if (keyboardOwners.find((entry) => entry.isVisible())?.id !== instanceId) return;
		const target = event.target;
		if (
			target instanceof HTMLInputElement ||
			target instanceof HTMLTextAreaElement ||
			target instanceof HTMLSelectElement
		) {
			return;
		}
		const keyJog = keyJogs[event.key];
		if (!keyJog) return;
		event.preventDefault();
		jog(...keyJog);
	};

	// --- Home e motori -----------------------------------------------------

	let showHomingWarning = $state(false);

	const handleHome = (): void => {
		if ($homingBusy) return;
		showHomingWarning = true;
	};

	const cancelHoming = (): void => {
		showHomingWarning = false;
	};

	// The homing itself runs in the store, so it survives leaving the page and the
	// button still reports it when the user comes back — see movementStore.
	const confirmHoming = (): void => {
		showHomingWarning = false;
		startHoming();
	};

	const handleMotorOff = async (): Promise<void> => {
		if (!motorsEnabled || motorsBusy) return;
		motorsBusy = true;
		if (await sendGcode('M84', "Couldn't turn motors off")) motorsEnabled = false;
		motorsBusy = false;
	};
</script>

<svelte:window onkeydown={handleKeydown} />

<section class="movement" aria-label="Move the head">
	<!-- Due colonne di due card: a sinistra lo schema con Home e Disable motors, a destra
	     le coordinate con il jog sotto. Sul telefono le quattro card una sotto l'altra. -->
	<div class="layout">
		<div class="column">
			<div class="card schema-card">
				<div class="schema" aria-hidden="true">
					<svg viewBox="0 0 440 280" class="toolhead-svg" role="presentation">
						<line
							class="axis-z-inner"
							x1={pCenterBase.x}
							y1={pCenterBase.y}
							x2={p001.x}
							y2={p001.y}
						/>
						<line
							class="z-guide"
							x1={pCenterAtZ.x}
							y1={pCenterAtZ.y}
							x2={pCenterBase.x}
							y2={pCenterBase.y}
						/>

						<polygon class="bed-fill" points={pointsToString(p000, p100, p110, p010)} />

						<polygon class="z-plane" points={pointsToString(planeA, planeB, planeC, planeD)} />

						<line class="cube-edge" x1={p000.x} y1={p000.y} x2={p100.x} y2={p100.y} />
						<line class="cube-edge" x1={p100.x} y1={p100.y} x2={p110.x} y2={p110.y} />
						<line class="cube-edge" x1={p110.x} y1={p110.y} x2={p010.x} y2={p010.y} />
						<line class="cube-edge" x1={p010.x} y1={p010.y} x2={p000.x} y2={p000.y} />

						<line class="cube-edge" x1={p001.x} y1={p001.y} x2={p101.x} y2={p101.y} />
						<line class="cube-edge" x1={p101.x} y1={p101.y} x2={p111.x} y2={p111.y} />
						<line class="cube-edge" x1={p111.x} y1={p111.y} x2={p011.x} y2={p011.y} />
						<line class="cube-edge" x1={p011.x} y1={p011.y} x2={p001.x} y2={p001.y} />

						<line class="cube-edge" x1={p000.x} y1={p000.y} x2={p001.x} y2={p001.y} />
						<line class="cube-edge" x1={p100.x} y1={p100.y} x2={p101.x} y2={p101.y} />
						<line class="cube-edge" x1={p110.x} y1={p110.y} x2={p111.x} y2={p111.y} />
						<line class="cube-edge" x1={p010.x} y1={p010.y} x2={p011.x} y2={p011.y} />

						<line class="axis-z-outer" x1={p001.x} y1={p001.y} x2={p001.x} y2={p001.y - 30} />
						<text class="axis-label axis-label-z" x={p001.x} y={p001.y - 40}>Z</text>

						<line class="axis-x" x1={p100.x} y1={p100.y} x2={p100.x + 52} y2={p100.y + 28} />
						<text class="axis-label axis-label-x" x={p100.x + 60} y={p100.y + 36}>X</text>

						<line class="axis-y" x1={p010.x} y1={p010.y} x2={p010.x - 52} y2={p010.y + 28} />
						<text class="axis-label axis-label-y" x={p010.x - 70} y={p010.y + 36}>Y</text>

						<circle class="toolhead-shadow" cx={actualMarker.x} cy={actualMarker.y + 2} r="5" />
						<circle class="toolhead-marker" cx={actualMarker.x} cy={actualMarker.y} r="5" />
					</svg>
				</div>
				<!-- Disable motors e Home, impilati sotto lo schema, grandi come Heat & extrude. -->
				<div class="actions">
					<button
						class="action-btn"
						aria-label={motorsEnabled ? 'Disable motors' : 'Disabled motors'}
						use:tooltip={motorsEnabled
							? "Turn the motors off so you can move the axes by hand. You'll need to home again afterwards"
							: 'Motors are off. Hit Home or move an axis to turn them back on'}
						aria-disabled={!motorsEnabled || motorsBusy}
						onclick={handleMotorOff}
					>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path
								d="M2.5,3.77L6.87,8.14L5,10V13H3V10H1V18H3V15H5V18H8L10,20H18V19.27L21.23,22.5L22.5,21.22L3.78,2.5L2.5,3.77M16,18H11L9,16H7V11L8,10H8.73L16,17.27V18M23,9V19H22.82L16,12.18V10H13.82L7.82,4H15V6H12V8H18V12H20V9H23Z"
							/>
						</svg>
						<span>{motorsEnabled ? 'Disable motors' : 'Disabled motors'}</span>
					</button>
					<button
						class="action-btn home"
						aria-label={$homingBusy ? 'Homing' : 'Home'}
						use:tooltip={'Home all axes so the printer knows where zero is'}
						disabled={$homingBusy}
						onclick={handleHome}
					>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path d={mdiHome} />
						</svg>
						<span>{$homingBusy ? 'Homing…' : 'Home'}</span>
					</button>
				</div>
			</div>
		</div>

		<div class="column">
			<div class="card coords-card" aria-live="polite">
				<div class="position-row">
					<span class="axis-name axis-x">X</span>
					<span class="position-value"
						>{actualX.current.toFixed(1)}<span class="position-unit">mm</span></span
					>
				</div>
				<div class="position-row">
					<span class="axis-name axis-y">Y</span>
					<span class="position-value"
						>{actualY.current.toFixed(1)}<span class="position-unit">mm</span></span
					>
				</div>
				<div class="position-row">
					<span class="axis-name axis-z">Z</span>
					<span class="position-value"
						>{actualZ.current.toFixed(1)}<span class="position-unit">mm</span></span
					>
				</div>
			</div>

			<div class="card jog-card">
				<div class="step-row" role="radiogroup" aria-label="Step size">
					{#each jogStepOptions as option (option.mm)}
						<button
							class="step-btn"
							class:selected={$jogStepMm === option.mm}
							role="radio"
							aria-checked={$jogStepMm === option.mm}
							use:tooltip={`Each jog button moves ${option.label}`}
							onclick={() => jogStepMm.set(option.mm)}
						>
							{option.label}
						</button>
					{/each}
				</div>

				<div class="jog-area">
					<div class="xy-pad">
						<button
							class="jog-btn pad-up"
							aria-label="Y plus"
							use:tooltip={`Move Y by +${stepLabel}`}
							disabled={!canJog('y', 1)}
							onclick={() => jog('y', 1)}
						>
							<svg viewBox="0 0 24 24" aria-hidden="true"><path d={mdiArrowUp} /></svg>
							<span class="axis-y">Y+</span>
						</button>
						<button
							class="jog-btn pad-left"
							aria-label="X minus"
							use:tooltip={`Move X by −${stepLabel}`}
							disabled={!canJog('x', -1)}
							onclick={() => jog('x', -1)}
						>
							<svg viewBox="0 0 24 24" aria-hidden="true"><path d={mdiArrowLeft} /></svg>
							<span class="axis-x">X−</span>
						</button>
						<div class="pad-center" aria-hidden="true">{stepLabel}</div>
						<button
							class="jog-btn pad-right"
							aria-label="X plus"
							use:tooltip={`Move X by +${stepLabel}`}
							disabled={!canJog('x', 1)}
							onclick={() => jog('x', 1)}
						>
							<svg viewBox="0 0 24 24" aria-hidden="true"><path d={mdiArrowRight} /></svg>
							<span class="axis-x">X+</span>
						</button>
						<button
							class="jog-btn pad-down"
							aria-label="Y minus"
							use:tooltip={`Move Y by −${stepLabel}`}
							disabled={!canJog('y', -1)}
							onclick={() => jog('y', -1)}
						>
							<svg viewBox="0 0 24 24" aria-hidden="true"><path d={mdiArrowDown} /></svg>
							<span class="axis-y">Y−</span>
						</button>
					</div>

					<div class="z-column">
						<button
							class="jog-btn"
							aria-label="Z plus"
							use:tooltip={`Move Z by +${stepLabel}`}
							disabled={!canJog('z', 1)}
							onclick={() => jog('z', 1)}
						>
							<svg viewBox="0 0 24 24" aria-hidden="true"><path d={mdiArrowUp} /></svg>
							<span class="axis-z">Z+</span>
						</button>
						<button
							class="jog-btn"
							aria-label="Z minus"
							use:tooltip={`Move Z by −${stepLabel}`}
							disabled={!canJog('z', -1)}
							onclick={() => jog('z', -1)}
						>
							<svg viewBox="0 0 24 24" aria-hidden="true"><path d={mdiArrowDown} /></svg>
							<span class="axis-z">Z−</span>
						</button>
					</div>
				</div>
				<!-- Perché i tasti sono spenti: un avviso in fondo alla card, sotto il pad. -->
				{#if printing}
					<p class="notice" role="status">Not while a print is running, sorry!</p>
				{:else if limitsKnown && !homed}
					<p class="notice" role="status">Home all axes before moving.</p>
				{/if}
			</div>
		</div>
	</div>
</section>

<HomingWarningModal isOpen={showHomingWarning} onConfirm={confirmHoming} onCancel={cancelHoming} />

<style>
	/* --- Layout ---------------------------------------------------------------
	 * Da tablet in su due colonne affiancate, ognuna con due card. Sul telefono le colonne
	 * spariscono (display: contents) e le quattro card stanno una sotto l'altra, in
	 * quest'ordine: schema con Home e Disable motors, coordinate, jog.
	 * La misura dei pulsanti del jog guarda tutto il blocco (container `movement`).
	 */
	/* Il container è la sezione, il layout il div dentro: una regola @container non può
	   cambiare lo stile del container stesso. */
	.movement {
		width: 100%;
		height: 100%;
		container: movement / size;
	}

	.layout {
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.column {
		display: contents;
	}

	.card {
		background: var(--color-white);
		border-radius: 16px;
		box-shadow: var(--shadow-panel);
		box-sizing: border-box;
		min-width: 0;
	}

	.schema-card {
		order: 1;
		flex: 1;
		min-height: 0;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.schema {
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}

	.coords-card {
		order: 2;
		flex-shrink: 0;
		padding: 12px 16px;
		display: flex;
		justify-content: space-between;
		gap: 8px;
	}

	.jog-card {
		order: 3;
		position: relative;
		flex-shrink: 0;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.actions {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	/* --- Schema -------------------------------------------------------------- */

	.toolhead-svg {
		width: 100%;
		height: 100%;
		display: block;
	}

	.bed-fill {
		fill: var(--color-divider);
	}

	.cube-edge {
		stroke: var(--color-gray-light);
		stroke-width: 1.8;
	}

	.z-plane {
		fill: rgba(var(--rgb-red), 0.3);
		stroke: rgba(var(--rgb-red), 0.6);
		stroke-width: 1;
	}

	.axis-x {
		stroke: var(--color-red);
		stroke-width: 2.2;
	}

	.axis-y {
		stroke: var(--color-success-vivid);
		stroke-width: 2.2;
	}

	.axis-z-inner {
		stroke: rgba(var(--rgb-info), 0.6);
		stroke-width: 2;
	}

	.axis-z-outer {
		stroke: var(--color-info);
		stroke-width: 2.2;
	}

	.z-guide {
		stroke: rgba(var(--rgb-info), 0.33);
		stroke-width: 1.4;
		stroke-dasharray: 4 4;
	}

	.axis-label {
		font-size: 18px;
		font-weight: 700;
		font-family: var(--font-sans);
	}

	.axis-label-x {
		fill: var(--color-red);
	}

	.axis-label-y {
		fill: var(--color-success-vivid);
	}

	.axis-label-z {
		fill: var(--color-info);
		text-anchor: middle;
	}

	.toolhead-shadow {
		fill: rgba(var(--rgb-black), 0.2);
	}

	.toolhead-marker {
		fill: var(--color-red);
	}

	/* --- Coordinate ---------------------------------------------------------- */

	/* Sul telefono le tre coordinate in una riga; da tablet in su una per riga. */
	.position-row {
		display: flex;
		align-items: baseline;
		gap: 4px;
	}

	.axis-name {
		font-size: clamp(0.8rem, 4.6cqw, 1.3rem);
		font-weight: 700;
	}

	/* I colori degli assi valgono per i nomi, le frecce del jog e le etichette. */
	span.axis-x {
		color: var(--color-red);
	}

	span.axis-y {
		color: var(--color-success-vivid);
	}

	span.axis-z {
		color: var(--color-info);
	}

	.position-value {
		font-size: clamp(0.8rem, 4.6cqw, 1.3rem);
		font-weight: 600;
		color: var(--color-text-muted);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.position-unit {
		margin-left: 2px;
		font-size: clamp(0.65rem, 3.4cqw, 0.85rem);
		font-weight: 500;
		color: var(--color-text-subtle);
	}

	/* --- Jog ----------------------------------------------------------------- */

	.jog-card {
		/* Lato di un pulsante del jog. Sul telefono: pad (3 pulsanti) e colonna Z nella
		   larghezza della card, lasciando allo schema almeno ~100px di altezza. */
		--jog-size: clamp(40px, min(calc(25cqw - 24px), calc((100cqh - 460px) / 3)), 76px);
	}

	.notice {
		box-sizing: border-box;
		margin: 0;
		padding: 10px 16px;
		border-radius: 12px;
		border: 1px solid var(--color-warning-border);
		background: var(--color-warning-bg);
		color: var(--color-warning);
		font-size: 0.9rem;
		font-weight: 600;
		line-height: 1.3;
		text-align: center;
	}

	.step-row {
		display: flex;
		gap: 8px;
	}

	/* I passi sono tutti in mm ("500 mm"): su una riga sola anche sulle card strette. */
	.step-btn {
		flex: 1;
		min-width: 0;
		min-height: 44px;
		background: var(--color-white);
		border: 1px solid var(--color-border-light);
		border-radius: 10px;
		box-sizing: border-box;
		padding: 8px 2px;
		font-size: 0.9rem;
		font-weight: 600;
		white-space: nowrap;
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.step-btn.selected {
		border: 2px solid var(--color-red);
		color: var(--color-red);
		padding: 7px 1px;
	}

	.step-btn:hover:not(.selected) {
		background: var(--color-background);
	}

	.jog-area {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 20px;
	}

	.xy-pad {
		display: grid;
		grid-template-columns: repeat(3, var(--jog-size));
		grid-template-rows: repeat(3, var(--jog-size));
		grid-template-areas:
			'. up .'
			'left center right'
			'. down .';
		gap: 8px;
	}

	.pad-up {
		grid-area: up;
	}

	.pad-left {
		grid-area: left;
	}

	.pad-right {
		grid-area: right;
	}

	.pad-down {
		grid-area: down;
	}

	.pad-center {
		grid-area: center;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: var(--color-background);
		color: var(--color-text-soft);
		font-size: 0.8rem;
		font-weight: 700;
		white-space: nowrap;
	}

	.z-column {
		display: flex;
		flex-direction: column;
		gap: calc(var(--jog-size) + 16px);
	}

	.jog-btn {
		width: var(--jog-size);
		height: var(--jog-size);
		padding: 0;
		background: var(--color-white);
		border: 1px solid var(--color-border-light);
		border-radius: 14px;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		color: var(--color-text-muted);
		cursor: pointer;
		touch-action: manipulation;
	}

	.jog-btn svg {
		width: calc(var(--jog-size) * 0.38);
		height: calc(var(--jog-size) * 0.38);
		fill: currentColor;
	}

	.jog-btn span {
		font-size: 0.85rem;
		font-weight: 700;
	}

	.jog-btn:hover:not(:disabled) {
		background: var(--color-background);
	}

	.jog-btn:active:not(:disabled) {
		background: var(--color-surface-sunken);
	}

	.jog-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	/* --- Home e Disable motors ------------------------------------------------- */

	/* Stesse misure e stesso font di "Heat & extrude" (ExtrudeDialog), accanto: il padding
	   è 1px meno del suo per compensare il bordo. Icona prima del testo. */
	.action-btn {
		width: 100%;
		background: var(--color-white);
		border: 1px solid var(--color-border-light);
		border-radius: 16px;
		box-sizing: border-box;
		padding: 17px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		color: var(--color-text-muted);
		font-family: inherit;
		font-size: 1.2rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		cursor: pointer;
	}

	.action-btn svg {
		flex-shrink: 0;
		width: 24px;
		height: 24px;
		fill: currentColor;
	}

	.action-btn:hover {
		background: var(--color-background);
	}

	.action-btn.home {
		background: var(--color-red);
		border-color: var(--color-red);
		color: var(--color-white);
	}

	.action-btn.home:hover {
		background: var(--color-red-dark);
	}

	.action-btn:disabled {
		cursor: default;
		opacity: 0.55;
		pointer-events: none;
	}

	/* Disable motors usa aria-disabled invece di disabled: un pulsante disabled non riceve
	   il mouse né il tocco, e l'etichetta che spiega perché è spento non comparirebbe mai.
	   Il clic lo ignora già handleMotorOff. */
	.action-btn[aria-disabled='true'] {
		cursor: default;
		opacity: 0.55;
	}

	.action-btn[aria-disabled='true']:hover {
		background: var(--color-white);
	}

	/* --- Telefono basso: lo schema sotto i ~100px non si legge più ------------- */

	@container movement (max-width: 559px) and (max-height: 520px) {
		.schema {
			display: none;
		}

		.action-btn {
			padding: 11px;
		}

		/* Qui nel flusso l'avviso non ci sta: galleggia sopra il fondo della card, dove i tasti
		   sono comunque spenti quando compare. */
		.notice {
			position: absolute;
			left: 16px;
			right: 16px;
			bottom: 16px;
			z-index: 1;
			box-shadow: var(--shadow-float);
			pointer-events: none;
		}

		.schema-card {
			flex: none;
		}

		.jog-card {
			flex: 1;
			justify-content: center;
		}
	}

	/* --- Da tablet in su: due colonne di due card ------------------------------ */

	@container movement (min-width: 560px) {
		.layout {
			flex-direction: row;
			gap: 24px;
		}

		.column {
			flex: 1;
			min-width: 0;
			display: flex;
			flex-direction: column;
			gap: 24px;
		}

		/* Coordinate una per riga, separate da una linea leggera. */
		.coords-card {
			display: grid;
			justify-content: center;
			align-content: center;
			gap: 0;
			padding: 8px 20px;
		}

		/* Lettera dell'asse e valore insieme, al centro. Le linee tra le righe sono appena più
		   larghe del testo, tutte lunghe quanto la riga più larga (la colonna della griglia). */
		.position-row {
			justify-content: center;
			gap: 12px;
			padding: 12px 10px;
			border-bottom: 1px solid var(--color-border-light);
		}

		.position-row:last-child {
			border-bottom: none;
		}

		.axis-name,
		.position-value {
			font-size: 1.3rem;
		}

		.position-unit {
			margin-left: 4px;
			font-size: 0.85rem;
		}

		/* Il jog prende lo spazio sotto le coordinate, con il pad centrato. Pulsanti dalla
		   larghezza della colonna e dall'altezza che resta, il 10% più grandi di quanto
		   chiederebbe l'altezza (la card non cambia misura). */
		.jog-card {
			flex: 1;
			min-height: 0;
			--jog-size: clamp(40px, min(calc(12.5cqw - 20px), calc((100cqh - 330px) / 3 * 1.1)), 92px);
		}

		.jog-area {
			flex: 1;
		}
	}

	/* Tablet da 600px e portatili bassi: coordinate più compatte, così il jog sotto ci sta. */
	@container movement (min-width: 560px) and (max-height: 480px) {
		.coords-card {
			padding: 4px 16px;
		}

		/* Nel flusso l'avviso non ci sta: galleggia sopra il fondo della card. */
		.notice {
			position: absolute;
			left: 16px;
			right: 16px;
			bottom: 16px;
			z-index: 1;
			box-shadow: var(--shadow-float);
			pointer-events: none;
		}

		.position-row {
			padding: 6px 10px;
		}

		.axis-name,
		.position-value {
			font-size: 1.1rem;
		}
	}
</style>
