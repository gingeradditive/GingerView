<script lang="ts">
	import { onMount } from 'svelte';
	import { configService } from '$lib/services/config';
	import { getFileMetadata } from '$lib/services/moonraker-files';

	const pollIntervalMs = 3000;
	const maxPelletKg = 5;

	let usedKg = $state(0);
	let totalKg = $state(maxPelletKg);
	let isIdle = $state(true);
	let remainingKg = $derived(Math.max(0, totalKg - usedKg));
	let percentage = $derived(totalKg > 0 ? (remainingKg / totalKg) * 100 : 0);

	let lastFilename: string | null = null;
	let filamentWeightTotal: number | null = null;

	const getApiUrl = (): string => {
		const config = configService.getKlipperConfig();
		const baseUrl = config.moonrakerApiUrl ?? `http://${config.moonrakerHost}:${config.moonrakerPort}`;
		return baseUrl.replace(/\/$/, '');
	};

	const loadFileWeight = async (filename: string): Promise<void> => {
		if (!filename || filename === lastFilename) return;
		lastFilename = filename;
		try {
			const metadata = await getFileMetadata(filename);
			// filament_weight_total is in grams
			if (metadata.filament_weight_total && metadata.filament_weight_total > 0) {
				filamentWeightTotal = metadata.filament_weight_total;
				totalKg = filamentWeightTotal / 1000;
			} else {
				filamentWeightTotal = null;
				totalKg = maxPelletKg;
			}
		} catch {
			filamentWeightTotal = null;
			totalKg = maxPelletKg;
		}
	};

	const updatePellet = async (): Promise<void> => {
		try {
			const response = await fetch(`${getApiUrl()}/printer/objects/query?print_stats`);
			if (!response.ok) return;

			const payload = await response.json();
			const status = payload?.result?.status;
			if (!status) return;

			const printStats = status.print_stats;
			if (!printStats) return;

			const printState = printStats.state ?? 'standby';
			isIdle = printState !== 'printing' && printState !== 'paused';

			const filename = printStats.filename ?? '';
			if (filename) {
				loadFileWeight(filename);
			} else {
				lastFilename = null;
				filamentWeightTotal = null;
				totalKg = maxPelletKg;
			}

			// filament_used is in mm; approximate weight using ~1.24 g/cm³ PLA density
			// and 1.75mm filament: weight(g) = length(mm) * π * (0.875)² * 1.24 / 1000
			const filamentUsedMm = printStats.filament_used ?? 0;
			const filamentArea = Math.PI * Math.pow(0.875, 2); // mm²
			const densityGPerMm3 = 0.00124; // g/mm³ (1.24 g/cm³)
			usedKg = (filamentUsedMm * filamentArea * densityGPerMm3) / 1000;
		} catch {
			return;
		}
	};

	onMount(() => {
		updatePellet();
		const interval = window.setInterval(updatePellet, pollIntervalMs);
		return () => window.clearInterval(interval);
	});
</script>

<section class="pellet-panel" aria-label="Pellet Level">
	<div class="pellet-visual">
		{#if !isIdle}
			<div class="pellet-fill" style="height: {percentage}%"></div>
		{/if}
		<div class="pellet-text">
			<span class="pellet-label">PELLET</span>
			{#if isIdle}
				<span class="pellet-value">Waiting for<br/>your material!</span>
			{:else}
				<span class="pellet-value">{remainingKg.toFixed(1)}/{totalKg.toFixed(1)} KG</span>
			{/if}
		</div>
	</div>
</section>

<style>
	.pellet-panel {
		background: #ffffff;
		border-radius: 16px;
		padding: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		box-sizing: border-box;
		overflow: hidden;
		position: relative;
		box-shadow: 0px 4px 3px 0px #00000040;
	}

	.pellet-visual {
		width: 100%;
		height: 100%;
		background: #ffffff;
		border-radius: 16px;
		overflow: hidden;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.pellet-fill {
		position: absolute;
		bottom: 0;
		left: 0;
		width: 100%;
		background: #D72E28;
		transition: height 0.3s ease;
		z-index: 1;
	}

	.pellet-text {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		z-index: 2;
		color: #000000;
		text-align: center;
	}

	.pellet-label {
		font-size: 1rem;
		font-weight: 700;
		color: #000000;
	}

	.pellet-value {
		font-size: 0.85rem;
		color: #000000;
		font-weight: 500;
	}
</style>
