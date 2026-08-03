<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { mdiCursorMove } from '@mdi/js';
	import { getMoonrakerApiUrl } from '$lib/services/config';
	import HomingWarningModal from '$lib/components/HomingWarningModal.svelte';
	import { homingBusy, startHoming } from '$lib/stores/movementStore';

	type ToolheadTestWindow = Window & {
		setToolheadTestPosition?: (x: number, y: number, z: number) => void;
	};

	const tweenOptions = { duration: 600, easing: cubicOut };

	const actualX = new Tween(124.6, tweenOptions);
	const actualY = new Tween(124.6, tweenOptions);
	const actualZ = new Tween(124.6, tweenOptions);

	const targetX = new Tween(124.6, tweenOptions);
	const targetY = new Tween(124.6, tweenOptions);
	const targetZ = new Tween(124.6, tweenOptions);

	let maxX = $state(1000);
	let maxY = $state(1000);
	let maxZ = $state(1000);

	// Optimistic default: when Kalico does not report `stepper_enable` the motor
	// state is unknown, and an enabled button is the useful fallback.
	let motorsEnabled = $state(true);
	let motorsBusy = $state(false);

	const pollIntervalMs = 1000;

	const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

	const actualXNorm = $derived(clamp(actualX.current / maxX));
	const actualYNorm = $derived(clamp(actualY.current / maxY));
	const actualZNorm = $derived(clamp(actualZ.current / maxZ));

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

	const updateToolheadPosition = async (): Promise<void> => {
		try {
			const response = await fetch(
				`${getMoonrakerApiUrl()}/printer/objects/query?toolhead=position,axis_maximum&gcode_move=gcode_position&stepper_enable=steppers`
			);
			if (!response.ok) return;

			const payload = await response.json();
			const status = payload?.result?.status;
			if (!status) return;

			const toolhead = status.toolhead;
			if (toolhead && Array.isArray(toolhead.axis_maximum) && toolhead.axis_maximum.length > 2) {
				maxX = Number(toolhead.axis_maximum[0]) || maxX;
				maxY = Number(toolhead.axis_maximum[1]) || maxY;
				maxZ = Number(toolhead.axis_maximum[2]) || maxZ;
			}

			const gcodeMove = status.gcode_move;
			if (
				gcodeMove &&
				Array.isArray(gcodeMove.gcode_position) &&
				gcodeMove.gcode_position.length > 2
			) {
				targetX.set(Number(gcodeMove.gcode_position[0]) || 0);
				targetY.set(Number(gcodeMove.gcode_position[1]) || 0);
				targetZ.set(Number(gcodeMove.gcode_position[2]) || 0);
			}

			if (toolhead && Array.isArray(toolhead.position) && toolhead.position.length > 2) {
				actualX.set(Number(toolhead.position[0]) || 0);
				actualY.set(Number(toolhead.position[1]) || 0);
				actualZ.set(Number(toolhead.position[2]) || 0);
			} else {
				actualX.set(targetX.current);
				actualY.set(targetY.current);
				actualZ.set(targetZ.current);
			}

			const stepperEnable = status.stepper_enable;
			const steppers = stepperEnable?.steppers;
			if (steppers && typeof steppers === 'object') {
				// M84 disables every stepper at once, so any stepper still enabled
				// means the motors have not been disabled.
				motorsEnabled = Object.values(steppers).some((value) => Boolean(value));
			}
		} catch {
			return;
		}
	};

	onMount(() => {
		const win = window as ToolheadTestWindow;
		win.setToolheadTestPosition = (x: number, y: number, z: number): void => {
			actualX.set(x);
			actualY.set(y);
			actualZ.set(z);
			targetX.set(x);
			targetY.set(y);
			targetZ.set(z);
		};

		updateToolheadPosition();
		const interval = window.setInterval(updateToolheadPosition, pollIntervalMs);

		return () => {
			window.clearInterval(interval);
		};
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			delete (window as ToolheadTestWindow).setToolheadTestPosition;
		}
	});

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
		try {
			const response = await fetch(`${getMoonrakerApiUrl()}/printer/gcode/script?script=M84`, {
				method: 'POST'
			});
			if (response.ok) {
				motorsEnabled = false;
			}
		} catch {
			// ignore; next poll will reflect the actual motor state
		} finally {
			motorsBusy = false;
		}
	};

	const handleMove = (): void => {
		console.log('Move');
	};
</script>

<div class="toolhead-position-card">
	<div class="viz-card">
		<div class="toolhead-isometric" aria-hidden="true">
			<svg viewBox="0 0 440 280" class="toolhead-svg" role="presentation">
				<line class="axis-z-inner" x1={pCenterBase.x} y1={pCenterBase.y} x2={p001.x} y2={p001.y} />
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
	</div>

	<div class="position-card">
		<div class="position-row">
			<span class="position-label position-label-x">X</span>
			<span class="position-value">{actualX.current.toFixed(1)} mm</span>
		</div>
		<div class="position-row">
			<span class="position-label position-label-y">Y</span>
			<span class="position-value">{actualY.current.toFixed(1)} mm</span>
		</div>
		<div class="position-row">
			<span class="position-label position-label-z">Z</span>
			<span class="position-value">{actualZ.current.toFixed(1)} mm</span>
		</div>
	</div>

	<div class="controls-card">
		<button class="control-btn" aria-label="Move" onclick={handleMove}>
			<svg width="32" height="32" viewBox="0 0 24 24">
				<path d={mdiCursorMove} fill="currentColor" />
			</svg>
			<span>Move</span>
		</button>
		<button
			class="control-btn home"
			aria-label={$homingBusy ? 'Homing' : 'Home'}
			disabled={$homingBusy}
			onclick={handleHome}
		>
			<svg width="32" height="32" viewBox="0 0 24 24">
				<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill="currentColor" />
			</svg>
			<span>{$homingBusy ? 'Homing...' : 'Home'}</span>
		</button>
		<button
			class="control-btn"
			aria-label={motorsEnabled ? 'Disable Motors' : 'Motors Disabled'}
			disabled={!motorsEnabled || motorsBusy}
			onclick={handleMotorOff}
		>
			<svg width="32" height="32" viewBox="0 0 24 24">
				<path
					d="M2.5,3.77L6.87,8.14L5,10V13H3V10H1V18H3V15H5V18H8L10,20H18V19.27L21.23,22.5L22.5,21.22L3.78,2.5L2.5,3.77M16,18H11L9,16H7V11L8,10H8.73L16,17.27V18M23,9V19H22.82L16,12.18V10H13.82L7.82,4H15V6H12V8H18V12H20V9H23Z"
					fill="currentColor"
				/>
			</svg>
			<span>{motorsEnabled ? 'Disable Motors' : 'Motors Disabled'}</span>
		</button>
	</div>
</div>

<HomingWarningModal isOpen={showHomingWarning} onConfirm={confirmHoming} onCancel={cancelHoming} />

<style>
	.toolhead-position-card {
		width: 100%;
		height: 100%;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.viz-card {
		background: var(--color-white);
		border-radius: 16px;
		box-shadow: var(--shadow-panel);
		box-sizing: border-box;
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
	}

	.toolhead-isometric {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}

	.toolhead-svg {
		width: 55%;
		height: 55%;
		display: block;
		margin: 0 auto;
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
		font-family: 'Segoe UI', sans-serif;
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

	.position-card {
		background: var(--color-white);
		border-radius: 16px;
		box-shadow: var(--shadow-panel);
		box-sizing: border-box;
		flex-shrink: 0;
		padding: 0 20px;
	}

	.position-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 0;
		border-bottom: 1px solid var(--color-surface-sunken);
	}

	.position-row:last-child {
		border-bottom: none;
	}

	.position-label {
		font-size: 1.4rem;
		font-weight: 700;
	}

	.position-label-x {
		color: var(--color-red);
	}

	.position-label-y {
		color: var(--color-success-vivid);
	}

	.position-label-z {
		color: var(--color-info);
	}

	.position-value {
		color: var(--color-text-disabled);
		font-size: 1.4rem;
		font-weight: 600;
	}

	.controls-card {
		background: var(--color-white);
		border-radius: 16px;
		box-shadow: var(--shadow-panel);
		box-sizing: border-box;
		flex-shrink: 0;
		display: flex;
		justify-content: center;
		gap: 12px;
		padding: 12px;
	}

	.control-btn {
		flex: 0 0 92px;
		width: 92px;
		height: 92px;
		aspect-ratio: 1 / 1;
		background: var(--color-white);
		border: 1px solid var(--color-border-light);
		border-radius: 12px;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.control-btn:hover {
		background: var(--color-background);
	}

	.control-btn span {
		font-size: 0.9rem;
		font-weight: 600;
		line-height: 1.1;
		text-align: center;
	}

	.control-btn.home {
		background: var(--color-red);
		border-color: var(--color-red);
		color: var(--color-white);
	}

	.control-btn.home:hover {
		background: var(--color-red-dark);
	}

	.control-btn:disabled {
		cursor: default;
		opacity: 0.55;
		pointer-events: none;
	}
</style>
