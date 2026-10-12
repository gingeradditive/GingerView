<script lang="ts">
	import { CheckCircle2, XCircle, Ban, RefreshCw } from 'lucide-svelte';
	import type { MoonrakerHistoryJob, HistoryStatus } from '$lib/types/history';
	import {
		getHistoryThumbnailUrl,
		formatFilamentUsed,
		formatHistoryDate
	} from '$lib/services/moonraker-history';
	import { formatEstimatedTime } from '$lib/services/moonraker-files';
	import { ensurePrinterTimezone, printerTimezone } from '$lib/stores/timezoneStore';
	import PrintStartWizard from '$lib/components/PrintStartWizard.svelte';

	let {
		job,
		isOpen,
		onClose,
		onDelete
	}: {
		job: MoonrakerHistoryJob | null;
		isOpen: boolean;
		onClose: () => void;
		onDelete: (job: MoonrakerHistoryJob) => void;
	} = $props();

	let showPrintWizard = $state(false);

	function statusMeta(status: HistoryStatus): {
		label: string;
		icon: typeof CheckCircle2;
		className: string;
	} {
		if (status === 'completed')
			return { label: 'Completed', icon: CheckCircle2, className: 'success' };
		if (status === 'cancelled') return { label: 'Cancelled', icon: Ban, className: 'warning' };
		if (status === 'in_progress')
			return { label: 'In progress', icon: RefreshCw, className: 'info' };
		return { label: 'Error', icon: XCircle, className: 'danger' };
	}

	function handleReprintClick(): void {
		showPrintWizard = true;
	}

	function cancelPrintWizard(): void {
		showPrintWizard = false;
	}

	function handlePrintStarted(): void {
		showPrintWizard = false;
		onClose();
	}

	function handleDeleteClick(): void {
		if (job) onDelete(job);
	}

	ensurePrinterTimezone();
</script>

{#if isOpen && job}
	{@const meta = statusMeta(job.status)}
	<!-- svelte-ignore a11y_click_events_have_key_events,a11y_no_noninteractive_element_interactions -->
	<div class="details-overlay" role="dialog" aria-modal="true" tabindex="-1" onclick={onClose}>
		<!-- svelte-ignore a11y_click_events_have_key_events,a11y_no_noninteractive_element_interactions -->
		<div class="details-modal" role="document" onclick={(e) => e.stopPropagation()}>
			<div class="preview-pane">
				<div class="preview-image-wrapper">
					<img
						src={getHistoryThumbnailUrl(job) ?? '/error-thumbnail.png'}
						alt={job.filename}
						width="500"
						height="500"
					/>
				</div>
			</div>

			<div class="info-pane">
				<div class="header">
					<h2>{job.filename}</h2>
					<span class="status-badge {meta.className}">
						<meta.icon size={14} />
						{meta.label}
					</span>
				</div>

				<div class="stats-grid">
					<div class="stat-card">
						<span class="stat-label">Start</span>
						<span>{formatHistoryDate(job.start_time, $printerTimezone)}</span>
					</div>
					<div class="stat-card">
						<span class="stat-label">Print time</span>
						<span>{formatEstimatedTime(job.print_duration)}</span>
					</div>
					<div class="stat-card">
						<span class="stat-label">Filament</span>
						<span>{formatFilamentUsed(job.filament_used)}</span>
					</div>
				</div>

				<div class="actions-row">
					<button class="delete-button" type="button" onclick={handleDeleteClick}>Delete</button>
					<button
						class="print-button"
						type="button"
						disabled={!job.exists}
						title={job.exists ? undefined : 'File no longer exists'}
						onclick={handleReprintClick}
					>
						Reprint
					</button>
				</div>
			</div>
		</div>
	</div>

	<PrintStartWizard
		isOpen={showPrintWizard}
		filepath={job.filename}
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

	.preview-image-wrapper > img {
		width: 200px;
		max-width: 200px;
		height: auto;
		aspect-ratio: 1 / 1;
		object-fit: contain;
		background: var(--color-white);
	}

	.info-pane {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 40px;
		gap: 28px;
		min-width: 0;
	}

	.header {
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-width: 0;
	}

	h2 {
		margin: 0;
		font-size: clamp(1.3rem, 2vw, 1.8rem);
		color: var(--color-black);
		font-weight: 600;
		overflow-wrap: break-word;
	}

	.status-badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		border-radius: 12px;
		font-size: 0.8rem;
		font-weight: 600;
		width: fit-content;
	}

	.status-badge.success {
		background: var(--color-success-bg);
		color: var(--color-success);
	}

	.status-badge.warning {
		background: var(--color-warning-bg);
		color: var(--color-warning);
	}

	.status-badge.danger {
		background: var(--color-danger-bg);
		color: var(--color-red);
	}

	.status-badge.info {
		background: var(--color-info-bg);
		color: var(--color-info);
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 14px;
	}

	.stat-card {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-weight: 600;
		color: var(--color-text-secondary);
	}

	.stat-label {
		font-size: 0.78rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--color-text-subtle);
	}

	.actions-row {
		display: flex;
		justify-content: flex-end;
		gap: 12px;
	}

	.delete-button {
		border: 1px solid var(--color-gray);
		background: var(--color-white);
		color: var(--color-text-soft);
		font-size: 1rem;
		font-weight: 600;
		padding: 14px 28px;
		border-radius: 7px;
		cursor: pointer;
	}

	.delete-button:hover {
		border-color: var(--color-red);
		color: var(--color-red);
	}

	.print-button {
		border: none;
		background: var(--color-red);
		color: var(--color-white);
		font-size: 1rem;
		font-weight: 600;
		padding: 14px 28px;
		border-radius: 7px;
		cursor: pointer;
		box-shadow: var(--shadow-panel);
	}

	.print-button:disabled {
		background: var(--color-gray);
		cursor: not-allowed;
		box-shadow: none;
	}

	@media (max-width: 1023.98px) {
		.details-modal {
			display: flex;
			flex-direction: column;
			min-height: auto;
			max-height: 90vh;
			overflow-y: auto;
		}

		.info-pane {
			padding: 8px 24px 24px;
			gap: 18px;
		}

		.stats-grid {
			gap: 10px;
		}

		.actions-row {
			flex-direction: column-reverse;
		}

		.delete-button,
		.print-button {
			width: 100%;
		}
	}
</style>
