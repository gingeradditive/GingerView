<script lang="ts">
	import { queryPrinterObjects } from '$lib/services/moonraker-poll';
	import { pollWhileVisible } from '$lib/services/panel-poll.svelte';

	/** Falso quando la slide è fuori dalla viewport del carosello: il polling si ferma. */
	let { visible = true }: { visible?: boolean } = $props();

	type FlowStatus = {
		print_stats?: { state?: string };
		motion_report?: { live_extruder_velocity?: number };
		gcode_move?: { speed?: number; extrude_factor?: number };
	};

	const pollSource = 'dashboard-flow';
	const pollIntervalMs = 1500;
	const minValue = 0;
	const maxValue = 800;
	const radius = 88;
	const circumference = 2 * Math.PI * radius;

	let flowValue = $state(0);
	let isIdle = $state(true);

	let clampedValue = $derived(Math.min(maxValue, Math.max(minValue, flowValue)));
	let progress = $derived((clampedValue - minValue) / (maxValue - minValue));
	let strokeDasharray = $derived(`${progress * circumference} ${circumference}`);

	const updateFlow = async (): Promise<void> => {
		const status = await queryPrinterObjects<FlowStatus>(
			pollSource,
			'gcode_move&motion_report&print_stats'
		);
		if (!status) return;

		const printState = status.print_stats?.state ?? 'standby';
		isIdle = printState !== 'printing' && printState !== 'paused';

		const motionReport = status.motion_report;
		if (motionReport && typeof motionReport.live_extruder_velocity === 'number') {
			// live_extruder_velocity is in mm/s of filament; convert to volumetric
			// Assume 1.75mm filament diameter -> cross-section area = π * (0.875)² ≈ 2.405 mm²
			const filamentArea = Math.PI * Math.pow(0.875, 2);
			flowValue = Math.abs(motionReport.live_extruder_velocity) * filamentArea;
			return;
		}

		const gcodeMove = status.gcode_move;
		if (gcodeMove) {
			// Fallback: use speed (mm/s) * extrude_factor as approximate flow indicator
			const speed = typeof gcodeMove.speed === 'number' ? gcodeMove.speed / 60 : 0; // speed is in mm/min
			const extrudeFactor =
				typeof gcodeMove.extrude_factor === 'number' ? gcodeMove.extrude_factor : 1;
			flowValue = speed * extrudeFactor;
		}
	};

	pollWhileVisible(pollSource, pollIntervalMs, updateFlow, () => visible);
</script>

<section class="flow-panel" aria-label="Flow Rate">
	<div class="flow-gauge">
		<svg
			viewBox="0 0 220 220"
			class="circular-progress"
			role="img"
			aria-label={isIdle ? 'Flow idle' : `Flow ${Math.round(clampedValue)} mm³/s`}
		>
			<circle class="circle-bg" cx="110" cy="110" r={radius} />
			{#if !isIdle}
				<circle class="circle" cx="110" cy="110" r={radius} stroke-dasharray={strokeDasharray} />
			{/if}
		</svg>
		<div class="gauge-content">
			<div class="flow-label">FLOW</div>
			{#if isIdle}
				<div class="flow-value">Let me extrude!</div>
			{:else}
				<div class="flow-value">{Math.round(clampedValue)} mm³/s</div>
			{/if}
		</div>
	</div>
</section>

<style>
	.flow-panel {
		background: var(--color-white);
		border-radius: 19.2px;
		padding: 16px;
		width: 100%;
		height: 100%;
		box-sizing: border-box;
		box-shadow: var(--shadow-panel);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.flow-gauge {
		position: relative;
		height: 100%;
		aspect-ratio: 1 / 1;
		max-width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.circular-progress {
		width: 100%;
		height: 100%;
		transform: rotate(90deg);
	}

	.circle-bg {
		stroke: var(--color-text-subtle);
		stroke-width: 10;
		fill: none;
		stroke-dasharray: none;
		stroke-linecap: round;
	}

	.circle {
		stroke: var(--color-red);
		stroke-width: 14;
		fill: none;
		stroke-linecap: round;
		transition: stroke-dasharray 0.3s ease;
	}

	.gauge-content {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 10px;
		text-align: center;
		pointer-events: none;
	}

	.flow-label {
		font-size: 2rem;
		font-weight: 700;
		color: var(--color-black);
		line-height: 1.1;
		letter-spacing: 0.02em;
	}

	.flow-value {
		font-size: 1.7rem;
		font-weight: 500;
		color: var(--color-text-soft);
		line-height: 1.3;
	}
</style>
