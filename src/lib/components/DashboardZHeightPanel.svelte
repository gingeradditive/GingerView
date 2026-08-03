<script lang="ts">
	import { onMount } from 'svelte';
	import { forgetPollSource, queryPrinterObjects } from '$lib/services/moonraker-poll';

	type ZHeightStatus = {
		print_stats?: { state?: string };
		toolhead?: { position?: number[]; axis_maximum?: number[] };
		gcode_move?: { gcode_position?: number[] };
	};

	const pollSource = 'dashboard-z-height';
	const pollIntervalMs = 1500;
	const totalSections = 10;
	const sectionHeight = 100;

	let currentHeight = $state(0);
	let maxHeight = $state(950);
	let isIdle = $state(true);

	let fillPercentage = $derived(
		maxHeight > 0 ? Math.min(100, (currentHeight / maxHeight) * 100) : 0
	);

	let sections = $derived(
		Array.from({ length: totalSections }, (_, i) => {
			const value = (i + 1) * sectionHeight;
			return {
				mark: value,
				label: value === 1000 ? '1m' : `${value}mm`
			};
		})
	);

	const updateZHeight = async (): Promise<void> => {
		const status = await queryPrinterObjects<ZHeightStatus>(
			pollSource,
			'toolhead=position,axis_maximum&gcode_move=gcode_position&print_stats=state'
		);
		if (!status) return;

		const printState = status.print_stats?.state ?? 'standby';
		isIdle = printState !== 'printing' && printState !== 'paused';

		const toolhead = status.toolhead;
		if (toolhead) {
			if (Array.isArray(toolhead.axis_maximum) && toolhead.axis_maximum.length > 2) {
				maxHeight = toolhead.axis_maximum[2];
			}
		}

		const gcodeMove = status.gcode_move;
		if (
			gcodeMove &&
			Array.isArray(gcodeMove.gcode_position) &&
			gcodeMove.gcode_position.length > 2
		) {
			currentHeight = Math.max(0, gcodeMove.gcode_position[2]);
		} else if (toolhead && Array.isArray(toolhead.position) && toolhead.position.length > 2) {
			currentHeight = Math.max(0, toolhead.position[2]);
		}
	};

	onMount(() => {
		updateZHeight();
		const interval = window.setInterval(updateZHeight, pollIntervalMs);
		return () => {
			window.clearInterval(interval);
			forgetPollSource(pollSource);
		};
	});
</script>

<section class="z-height-panel" aria-label="Z Height">
	<div class="z-progress-container">
		<div class="z-progress-bar">
			<div class="z-progress-fill" style="height: {fillPercentage}%"></div>
			<!-- Section marks and labels -->
			<div class="z-marks">
				<!-- Tacche posizionali: l'indice è la loro identità, non c'è riordino. -->
				{#each sections as _section, i (i)}
					<div class="z-mark" style="bottom: {(i + 1) * 10}%"></div>
				{/each}
			</div>
			<div class="z-labels">
				{#each sections as section, i (i)}
					<div class="z-label-mark" style="bottom: {(i + 1) * 10}%">
						{section.label}
					</div>
				{/each}
			</div>
		</div>
	</div>
	<div class="z-info">
		<span class="z-label">Z HEIGHT</span>
		{#if isIdle}
			<span class="z-value">Infinity and beyond!</span>
			<span class="z-value-sub">Joking just a meter :(</span>
		{:else}
			<span class="z-value">{currentHeight.toFixed(1)} / {maxHeight} mm</span>
		{/if}
	</div>
</section>

<style>
	.z-height-panel {
		background: var(--color-white);
		border-radius: 19.2px;
		padding: 0;
		display: flex;
		align-items: stretch;
		height: 100%;
		box-sizing: border-box;
		box-shadow: var(--shadow-panel);
		overflow: hidden;
	}

	.z-progress-container {
		position: relative;
		width: 80px;
		height: 100%;
		flex-shrink: 0;
	}

	.z-progress-bar {
		position: relative;
		width: 100%;
		height: 100%;
		background: var(--color-white);
		border-radius: 0;
		overflow: hidden;
		border-right: 1px solid var(--color-black-pure);
	}

	.z-progress-fill {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		background: var(--color-red);
		border-radius: 0;
		transition: height 0.3s ease;
	}

	.z-marks {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		pointer-events: none;
	}

	.z-mark {
		position: absolute;
		left: 0;
		right: 50%;
		height: 1px;
		background: var(--color-black-pure);
	}

	.z-labels {
		position: absolute;
		top: -5px;
		right: -45px;
		bottom: -5px;
		pointer-events: none;
	}

	.z-label-mark {
		position: absolute;
		right: 0;
		font-size: 0.7rem;
		color: var(--color-text-soft);
		transform: translateY(50%);
		white-space: nowrap;
	}

	.z-info {
		display: flex;
		flex-direction: column;
		gap: 8px;
		flex: 1;
		padding: 20px;
		justify-content: center;
		align-items: center;
		text-align: center;
	}

	.z-label {
		font-size: 2rem;
		font-weight: 700;
		color: var(--color-black);
	}

	.z-value {
		font-size: 1.7rem;
		color: var(--color-text-soft);
		font-weight: 500;
	}

	.z-value-sub {
		font-size: 1.5rem;
		color: var(--color-text-disabled);
		font-weight: 400;
	}
</style>
