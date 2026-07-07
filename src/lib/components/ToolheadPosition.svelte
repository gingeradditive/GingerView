<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { tweened } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { mdiCursorMove } from '@mdi/js';
	import { configService } from '$lib/services/config';

	type ToolheadTestWindow = Window & {
		setToolheadTestPosition?: (x: number, y: number, z: number) => void;
	};

	let actualX = tweened(124.6, {
		duration: 600,
		easing: cubicOut
	});
	let actualY = tweened(124.6, {
		duration: 600,
		easing: cubicOut
	});
	let actualZ = tweened(124.6, {
		duration: 600,
		easing: cubicOut
	});

	let targetX = tweened(124.6, {
		duration: 600,
		easing: cubicOut
	});
	let targetY = tweened(124.6, {
		duration: 600,
		easing: cubicOut
	});
	let targetZ = tweened(124.6, {
		duration: 600,
		easing: cubicOut
	});

	let maxX = 1000;
	let maxY = 1000;
	let maxZ = 1000;

	const pollIntervalMs = 1000;

	const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

	$: actualXNorm = clamp($actualX / maxX);
	$: actualYNorm = clamp($actualY / maxY);
	$: actualZNorm = clamp($actualZ / maxZ);

	$: targetXNorm = clamp($targetX / maxX);
	$: targetYNorm = clamp($targetY / maxY);
	$: targetZNorm = clamp($targetZ / maxZ);

	const isoCenterX = 220;
	const isoBaseY = 160;
	const isoScaleX = 104;
	const isoScaleY = 56;
	const isoScaleZ = 104;

	const project = (x: number, y: number, z: number): { x: number; y: number } => ({
		x: isoCenterX + (x - y) * isoScaleX,
		y: isoBaseY + (x + y) * isoScaleY - z * isoScaleZ
	});

	$: p000 = project(0, 0, 0);
	$: p100 = project(1, 0, 0);
	$: p110 = project(1, 1, 0);
	$: p010 = project(0, 1, 0);
	$: p001 = project(0, 0, 1);
	$: p101 = project(1, 0, 1);
	$: p111 = project(1, 1, 1);
	$: p011 = project(0, 1, 1);

	$: pCenterBase = project(0.5, 0.5, 0);
	$: pCenterTop = project(0.5, 0.5, 1);
	$: pCenterAtZ = project(0.5, 0.5, actualZNorm);

	$: planeA = project(0, 0, actualZNorm);
	$: planeB = project(1, 0, actualZNorm);
	$: planeC = project(1, 1, actualZNorm);
	$: planeD = project(0, 1, actualZNorm);

	$: actualMarker = project(actualXNorm, actualYNorm, actualZNorm);
	$: targetMarker = project(targetXNorm, targetYNorm, targetZNorm);

	const pointsToString = (...points: { x: number; y: number }[]): string =>
		points.map((point) => `${point.x},${point.y}`).join(' ');

	const getApiUrl = (): string => {
		const config = configService.getKlipperConfig();
		const baseUrl = config.moonrakerApiUrl ?? `http://${config.moonrakerHost}:${config.moonrakerPort}`;
		return baseUrl.replace(/\/$/, '');
	};

	const updateToolheadPosition = async (): Promise<void> => {
		try {
			const response = await fetch(
				`${getApiUrl()}/printer/objects/query?toolhead=position,axis_maximum&gcode_move=gcode_position`
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
			if (gcodeMove && Array.isArray(gcodeMove.gcode_position) && gcodeMove.gcode_position.length > 2) {
				targetX.set(Number(gcodeMove.gcode_position[0]) || 0);
				targetY.set(Number(gcodeMove.gcode_position[1]) || 0);
				targetZ.set(Number(gcodeMove.gcode_position[2]) || 0);
			}

			if (toolhead && Array.isArray(toolhead.position) && toolhead.position.length > 2) {
				actualX.set(Number(toolhead.position[0]) || 0);
				actualY.set(Number(toolhead.position[1]) || 0);
				actualZ.set(Number(toolhead.position[2]) || 0);
			} else {
				actualX.set($targetX);
				actualY.set($targetY);
				actualZ.set($targetZ);
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
		delete (window as ToolheadTestWindow).setToolheadTestPosition;
	});

	const handleHome = (): void => {
		console.log('Home');
	};

	const handleMotorOff = (): void => {
		console.log('Motor Off');
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
				<line class="z-guide" x1={pCenterAtZ.x} y1={pCenterAtZ.y} x2={pCenterBase.x} y2={pCenterBase.y} />

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
			<span class="position-value">{$actualX.toFixed(1)} mm</span>
		</div>
		<div class="position-row">
			<span class="position-label position-label-y">Y</span>
			<span class="position-value">{$actualY.toFixed(1)} mm</span>
		</div>
		<div class="position-row">
			<span class="position-label position-label-z">Z</span>
			<span class="position-value">{$actualZ.toFixed(1)} mm</span>
		</div>
	</div>

	<div class="controls-card">
		<button class="control-btn" aria-label="Move" onclick={handleMove}>
			<svg width="32" height="32" viewBox="0 0 24 24">
				<path d={mdiCursorMove} fill="currentColor" />
			</svg>
			<span>Move</span>
		</button>
		<button class="control-btn home" aria-label="Home" onclick={handleHome}>
			<svg width="32" height="32" viewBox="0 0 24 24">
				<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill="currentColor" />
			</svg>
			<span>Home</span>
		</button>
		<button class="control-btn" aria-label="Disable Motors" onclick={handleMotorOff}>
			<svg width="32" height="32" viewBox="0 0 24 24">
				<path
					d="M2.5,3.77L6.87,8.14L5,10V13H3V10H1V18H3V15H5V18H8L10,20H18V19.27L21.23,22.5L22.5,21.22L3.78,2.5L2.5,3.77M16,18H11L9,16H7V11L8,10H8.73L16,17.27V18M23,9V19H22.82L16,12.18V10H13.82L7.82,4H15V6H12V8H18V12H20V9H23Z"
					fill="currentColor"
				/>
			</svg>
			<span>Disable Motors</span>
		</button>
	</div>
</div>

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
		background: #ffffff;
		border-radius: 16px;
		box-shadow: 0px 4px 3px 0px #00000040;
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
		fill: #d3d3d3;
	}

	.cube-edge {
		stroke: #bcbcbc;
		stroke-width: 1.8;
	}

	.z-plane {
		fill: #d72e284d;
		stroke: #d72e2899;
		stroke-width: 1;
	}

	.axis-x {
		stroke: #d72e28;
		stroke-width: 2.2;
	}

	.axis-y {
		stroke: #26b73f;
		stroke-width: 2.2;
	}

	.axis-z-inner {
		stroke: #3d67d899;
		stroke-width: 2;
	}

	.axis-z-outer {
		stroke: #3d67d8;
		stroke-width: 2.2;
	}

	.z-guide {
		stroke: #3d67d855;
		stroke-width: 1.4;
		stroke-dasharray: 4 4;
	}

	.axis-label {
		font-size: 18px;
		font-weight: 700;
		font-family: 'Segoe UI', sans-serif;
	}

	.axis-label-x {
		fill: #d72e28;
	}

	.axis-label-y {
		fill: #26b73f;
	}

	.axis-label-z {
		fill: #3d67d8;
		text-anchor: middle;
	}

	.toolhead-shadow {
		fill: #00000033;
	}

	.toolhead-marker {
		fill: #d72e28;
	}

	.position-card {
		background: #ffffff;
		border-radius: 16px;
		box-shadow: 0px 4px 3px 0px #00000040;
		box-sizing: border-box;
		flex-shrink: 0;
		padding: 0 20px;
	}

	.position-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 0;
		border-bottom: 1px solid #ececec;
	}

	.position-row:last-child {
		border-bottom: none;
	}

	.position-label {
		font-size: 1.4rem;
		font-weight: 700;
	}

	.position-label-x {
		color: #d72e28;
	}

	.position-label-y {
		color: #26b73f;
	}

	.position-label-z {
		color: #3d67d8;
	}

	.position-value {
		color: #9a9a9a;
		font-size: 1.4rem;
		font-weight: 600;
	}

	.controls-card {
		background: #ffffff;
		border-radius: 16px;
		box-shadow: 0px 4px 3px 0px #00000040;
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
		background: #ffffff;
		border: 1px solid #e0e0e0;
		border-radius: 12px;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		color: #4a4a4a;
		cursor: pointer;
	}

	.control-btn:hover {
		background: #f5f5f5;
	}

	.control-btn span {
		font-size: 0.9rem;
		font-weight: 600;
		line-height: 1.1;
		text-align: center;
	}

	.control-btn.home {
		background: #d72e28;
		border-color: #d72e28;
		color: #ffffff;
	}

	.control-btn.home:hover {
		background: #b82520;
	}
</style>
