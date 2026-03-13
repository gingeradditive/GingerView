<script lang="ts">
	import type { PrintItem } from '$lib/types/print';
	import { formatEstimatedTime } from '$lib/services/moonraker-files';

	let {
		item,
		isOpen,
		onClose
	}: {
		item: PrintItem | null;
		isOpen: boolean;
		onClose: () => void;
	} = $props();

	function formatNozzleDiameter(value?: number): string {
		if (value == null || value <= 0) return '--';
		return `${value}mm`;
	}

	function formatFilamentWeight(value?: number): string {
		if (value == null || value <= 0) return '--';
		return `${Math.round(value)}g`;
	}

	function getDurationValue(file: PrintItem): string {
		return formatEstimatedTime(file.lastPrintDuration ?? file.printTime);
	}
</script>

{#if isOpen && item}
	<!-- svelte-ignore a11y_click_events_have_key_events,a11y_no_noninteractive_element_interactions -->
	<div class="details-overlay" role="dialog" aria-modal="true" tabindex="-1" onclick={onClose}>
		<!-- svelte-ignore a11y_click_events_have_key_events,a11y_no_noninteractive_element_interactions -->
		<div class="details-modal" role="document" onclick={(e) => e.stopPropagation()}>
			<div class="mobile-header">
				<h2>{item.name}</h2>
				<p class="subtitle">{item.filamentName || item.material || '--'}</p>
			</div>

			<div class="preview-pane">
				<div class="preview-image-wrapper">
					<img src={item.imageUrl ?? '/error-thumbnail.png'} alt={item.name} width="500" height="500" />
					<div class="rotate-overlay">
						<img src="/3DView.svg" alt="3D View" width="40" height="40" />
					</div>
				</div>
			</div>

			<div class="info-pane">
				<div class="desktop-header">
					<h2>{item.name}</h2>
					<p class="subtitle">{item.filamentName || item.material || '--'}</p>
				</div>

				<div class="stats-grid">
					<div class="stat-card">
						<img src="/PrintTime.svg" alt="Print duration" width="36" height="36" />
						<span>{getDurationValue(item)}</span>
					</div>
					<div class="stat-card">
						<img src="/Weight.svg" alt="Filament weight" width="36" height="36" />
						<span>{formatFilamentWeight(item.filamentWeight)}</span>
					</div>
					<div class="stat-card">
						<img src="/Nozzle.svg" alt="Nozzle diameter" width="36" height="36" />
						<span>{formatNozzleDiameter(item.nozzleDiameter)}</span>
					</div>
					<div class="stat-card">
						<img src="/Material.svg" alt="Filament type" width="36" height="36" />
						<span>{item.filamentType || item.material || '--'}</span>
					</div>
				</div>

				<div class="actions-row">
					<button class="print-button" type="button">Print</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.details-overlay {
		position: fixed;
		inset: 0;
		background: linear-gradient(135deg, rgba(255, 255, 255, 0.3), rgba(240, 244, 248, 0.22));
		backdrop-filter: blur(12px) saturate(130%);
		-webkit-backdrop-filter: blur(12px) saturate(130%);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 3000;
		padding: 24px;
	}

	.details-modal {
		width: min(800px, 100%);
		min-height: 400px;
		background: #ffffff;
		border-radius: 54px;
		display: grid;
		grid-template-columns: 1fr 2fr;
		overflow: hidden;
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.2);
	}

	.preview-pane {
		background: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
	}

	.preview-image-wrapper {
		position: relative;
		display: inline-block;
	}

	.preview-image-wrapper img {
		width: 100%;
		max-width: 500px;
		height: auto;
		aspect-ratio: 1 / 1;
		object-fit: contain;
		background: #fff;
	}

	.rotate-overlay {
		position: absolute;
		top: 12px;
		left: 12px;
		width: 40px;
		height: 40px;
		background: rgba(255, 255, 255, 0.9);
		border-radius: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		backdrop-filter: blur(4px);
		padding: 4px;
	}

	.info-pane {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 40px;
		gap: 28px;
	}

	.mobile-header {
		display: none;
	}

	h2 {
		margin: 0;
		font-size: clamp(1.5rem, 2.3vw, 2.2rem);
		color: #111;
		font-weight: 600;
	}

	.subtitle {
		margin: 8px 0 0;
		font-size: 1rem;
		color: #666;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 14px;
	}

	.stat-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		font-weight: 600;
		color: #222;
	}

	.actions-row {
		display: flex;
		justify-content: flex-end;
	}

	.print-button {
		border: none;
		background: #d72e28;
		color: #fff;
		font-size: clamp(1.5rem, 2.3vw, 2.2rem);
		font-weight: 600;
		padding: 14px 56px;
		border-radius: 14px;
		cursor: pointer;
		transition: background-color 0.15s, box-shadow 0.15s;
		box-shadow: 0px 4px 4px 0px #00000040;
	}

	.print-button:hover {
		background: #b82520;
	}

	@media (max-width: 980px) {
		.details-modal {
			display: flex;
			flex-direction: column;
			min-height: auto;
			max-height: 90vh;
			overflow-y: auto;
		}

		.mobile-header {
			display: block;
			padding: 24px 24px 0;
		}

		.desktop-header {
			display: none;
		}

		.preview-pane {
			padding: 16px 24px;
		}

		.preview-image-wrapper img {
			max-width: 250px;
		}

		.info-pane {
			padding: 8px 24px 24px;
			gap: 18px;
		}

		.stats-grid {
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: 8px;
		}

		.stat-card {
			gap: 6px;
			font-size: 0.78rem;
		}

		.stat-card span {
			white-space: nowrap;
		}

		.stat-card img {
			width: 24px;
			height: 24px;
		}

		.actions-row {
			justify-content: stretch;
		}

		.print-button {
			width: 100%;
		}
	}
</style>
