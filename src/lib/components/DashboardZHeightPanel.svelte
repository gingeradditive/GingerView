<script lang="ts">
	import { onMount } from 'svelte';
	import { configService } from '$lib/services/config';

	const pollIntervalMs = 1500;
	const totalSections = 10;
	const sectionHeight = 100;

	let currentHeight = $state(0);
	let maxHeight = $state(950);
	let isIdle = $state(true);

	let fillPercentage = $derived(maxHeight > 0 ? Math.min(100, (currentHeight / maxHeight) * 100) : 0);

	let sections = $derived(
		Array.from({ length: totalSections }, (_, i) => {
			const value = (i + 1) * sectionHeight;
			return {
				mark: value,
				label: value === 1000 ? '1m' : `${value}mm`
			};
		})
	);

	const getApiUrl = (): string => {
		const config = configService.getKlipperConfig();
		const baseUrl = config.moonrakerApiUrl ?? `http://${config.moonrakerHost}:${config.moonrakerPort}`;
		return baseUrl.replace(/\/$/, '');
	};

	const updateZHeight = async (): Promise<void> => {
		try {
			const response = await fetch(`${getApiUrl()}/printer/objects/query?toolhead=position,axis_maximum&gcode_move=gcode_position&print_stats=state`);
			if (!response.ok) return;

			const payload = await response.json();
			const status = payload?.result?.status;
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
			if (gcodeMove && Array.isArray(gcodeMove.gcode_position) && gcodeMove.gcode_position.length > 2) {
				currentHeight = Math.max(0, gcodeMove.gcode_position[2]);
			} else if (toolhead && Array.isArray(toolhead.position) && toolhead.position.length > 2) {
				currentHeight = Math.max(0, toolhead.position[2]);
			}
		} catch {
			return;
		}
	};

	onMount(() => {
		updateZHeight();
		const interval = window.setInterval(updateZHeight, pollIntervalMs);
		return () => window.clearInterval(interval);
	});
</script>

<section class="z-height-panel" aria-label="Z Height">
	<div class="z-progress-container">
		<div class="z-progress-bar">
			<div class="z-progress-fill" style="height: {fillPercentage}%"></div>
			<!-- Section marks and labels -->
			<div class="z-marks">
				{#each sections as section, i}
					<div class="z-mark" style="bottom: {(i + 1) * 10}%"></div>
				{/each}
			</div>
			<div class="z-labels">
				{#each sections as section, i}
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
		background: #ffffff;
		border-radius: 16px;
		padding: 0;
		display: flex;
		align-items: stretch;
		height: 100%;
		box-sizing: border-box;
		box-shadow: 0px 4px 3px 0px #00000040;
		overflow: hidden;
	}

	.z-progress-container {
		position: relative;
		width: 40px;
		height: 100%;
		flex-shrink: 0;
	}

	.z-progress-bar {
		position: relative;
		width: 100%;
		height: 100%;
		background: #ffffff;
		border-radius: 0;
		overflow: hidden;
		border-right: 1px solid #000000;
	}

	.z-progress-fill {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		background: #D72E28;
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
		background: #000000;
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
		color: #666666;
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
	}

	.z-label {
		font-size: 1rem;
		font-weight: 700;
		color: #111111;
	}

	.z-value {
		font-size: 0.85rem;
		color: #666666;
		font-weight: 500;
	}

	.z-value-sub {
		font-size: 0.75rem;
		color: #999999;
		font-weight: 400;
	}
</style>
