<script lang="ts">
	import type { PrintItem } from '$lib/types/print';
	import { formatEstimatedTime } from '$lib/services/moonraker-files';
	import PrintStartWizard from '$lib/components/PrintStartWizard.svelte';

	let {
		item,
		isOpen,
		onClose
	}: {
		item: PrintItem | null;
		isOpen: boolean;
		onClose: () => void;
	} = $props();

	let showPrintWizard = $state(false);

	function handlePrintClick(): void {
		showPrintWizard = true;
	}

	function cancelPrintWizard(): void {
		showPrintWizard = false;
	}

	function handlePrintStarted(): void {
		showPrintWizard = false;
		onClose();
	}

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
					<img
						src={item.imageUrl ?? '/error-thumbnail.png'}
						alt={item.name}
						width="500"
						height="500"
					/>
					<div class="rotate-overlay">
						<img src="/3DView.svg" alt="3D View" width="40" height="40" />
					</div>
				</div>
			</div>

			<div class="info-pane">
				<div class="desktop-header">
					<h2 class="desktop-title-track">
						<span class:desktop-title-marquee={item.name.length > 30}>
							<span class="desktop-title-text">{item.name}</span>
							{#if item.name.length > 30}
								<span class="desktop-title-text" aria-hidden="true">{item.name}</span>
							{/if}
						</span>
					</h2>
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
					<button class="print-button" type="button" onclick={handlePrintClick}>Print</button>
				</div>
			</div>
		</div>
	</div>

	<PrintStartWizard
		isOpen={showPrintWizard}
		filepath={item.filepath}
		onCancel={cancelPrintWizard}
		onStarted={handlePrintStarted}
	/>
{/if}

<style>
	.details-overlay {
		position: fixed;
		inset: 0;
		background: linear-gradient(
			135deg,
			rgba(var(--rgb-gray-mid), 0.3),
			rgba(var(--rgb-gray-mid), 0.22)
		);
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
		background: var(--color-white);
		border-radius: 27px;
		display: grid;
		grid-template-columns: 1fr 2fr;
		overflow: hidden;
		box-shadow: var(--shadow-panel);
		min-width: 0;
	}

	.preview-pane {
		background: var(--color-white);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
	}

	.preview-image-wrapper {
		position: relative;
		display: inline-block;
	}

	.preview-image-wrapper > img {
		width: 200px;
		max-width: 200px;
		height: auto;
		aspect-ratio: 1 / 1;
		object-fit: contain;
		background: var(--color-white);
	}

	.rotate-overlay {
		position: absolute;
		top: 12px;
		left: 12px;
		width: 40px;
		height: 40px;
		background: rgba(var(--rgb-white), 0.9);
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
		min-width: 0;
	}

	.mobile-header {
		display: none;
	}

	.desktop-header {
		overflow: hidden;
		width: 100%;
		min-width: 0;
	}

	h2 {
		margin: 0;
		font-size: clamp(1.5rem, 2.3vw, 2.2rem);
		color: var(--color-black);
		font-weight: 600;
	}

	.desktop-title-track {
		overflow: hidden;
		white-space: nowrap;
	}

	.desktop-title-track > span {
		display: inline-flex;
		align-items: baseline;
		width: max-content;
	}

	.desktop-title-marquee {
		gap: 32px;
		animation: desktop-title-marquee 14s linear infinite;
	}

	.desktop-title-text {
		flex-shrink: 0;
		white-space: nowrap;
	}

	@keyframes desktop-title-marquee {
		0%,
		10% {
			transform: translateX(0);
		}
		100% {
			transform: translateX(calc(-50% - 16px));
		}
	}

	.subtitle {
		margin: 8px 0 0;
		font-size: 1rem;
		color: var(--color-text-soft);
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
		color: var(--color-text-secondary);
	}

	.actions-row {
		display: flex;
		justify-content: flex-end;
	}

	.print-button {
		border: none;
		background: var(--color-red);
		color: var(--color-white);
		font-size: clamp(1.5rem, 2.3vw, 2.2rem);
		font-weight: 600;
		padding: 14px 56px;
		border-radius: 7px;
		cursor: pointer;
		box-shadow: var(--shadow-panel);
	}

	@media (max-width: 1023.98px) {
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
			background: var(--color-white);
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 24px;
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
