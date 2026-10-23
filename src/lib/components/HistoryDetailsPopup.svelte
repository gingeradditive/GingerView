<script lang="ts">
	import {
		CheckCircle2,
		XCircle,
		Ban,
		RefreshCw,
		CalendarClock,
		Trash2,
		RotateCcw
	} from 'lucide-svelte';
	import type { MoonrakerHistoryJob, HistoryStatus } from '$lib/types/history';
	import {
		getHistoryThumbnailUrl,
		formatFilamentUsed,
		formatHistoryDate
	} from '$lib/services/moonraker-history';
	import { formatEstimatedTime } from '$lib/services/moonraker-files';
	import { ensurePrinterTimezone, printerTimezone } from '$lib/stores/timezoneStore';
	import PrintStartWizard from '$lib/components/PrintStartWizard.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import StatTile from '$lib/components/ui/StatTile.svelte';

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
	{@const thumbnail = getHistoryThumbnailUrl(job)}
	<Sheet label={job.filename} {onClose} showClose size="lg">
		{#snippet header()}
			<h2 class="sheet-title name">{job.filename}</h2>
			<span class="status-badge {meta.className}">
				<meta.icon size={14} />
				{meta.label}
			</span>
		{/snippet}

		<div class="layout">
			<div class="preview">
				<img
					src={thumbnail ?? '/error-thumbnail.png'}
					alt={job.filename}
					width="500"
					height="500"
				/>
			</div>

			<div class="stats">
				<StatTile
					label="Started"
					value={formatHistoryDate(job.start_time, $printerTimezone)}
					icon={CalendarClock}
				/>
				<StatTile
					label="Print time"
					value={formatEstimatedTime(job.print_duration)}
					iconSrc="/PrintTime.svg"
				/>
				<StatTile
					label="Material used"
					value={formatFilamentUsed(job.filament_used)}
					iconSrc="/Weight.svg"
				/>
			</div>
		</div>

		{#if !job.exists}
			<p class="missing">That file isn't on the printer anymore.</p>
		{/if}

		{#snippet footer()}
			<button class="btn btn-secondary delete" type="button" onclick={handleDeleteClick}>
				<Trash2 size={18} />
				Delete
			</button>
			<button
				class="btn btn-primary"
				type="button"
				disabled={!job.exists}
				onclick={handleReprintClick}
			>
				<RotateCcw size={18} />
				Print again
			</button>
		{/snippet}
	</Sheet>

	<PrintStartWizard
		isOpen={showPrintWizard}
		filepath={job.filename}
		thumbnailUrl={thumbnail}
		onCancel={cancelPrintWizard}
		onStarted={handlePrintStarted}
	/>
{/if}

<style>
	.name {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		overflow-wrap: anywhere;
	}

	.status-badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-top: 8px;
		padding: 4px 10px;
		border-radius: 999px;
		font-size: 0.8rem;
		font-weight: 700;
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

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
		gap: 20px;
	}

	/* Come nel dettaglio stampa: la miniatura è alta quanto i valori accanto. */
	.preview {
		position: relative;
		min-height: 0;
		border-radius: 18px;
		background: var(--color-surface-soft);
	}

	.preview img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.stats {
		display: grid;
		grid-template-columns: 1fr;
		gap: 10px;
	}

	.missing {
		margin: 14px 0 0;
		padding: 10px 12px;
		border-radius: 10px;
		background: var(--color-warning-bg);
		color: var(--color-warning);
		font-size: 0.85rem;
		font-weight: 600;
	}

	.delete {
		color: var(--color-red);
	}

	@media (max-width: 767.98px) {
		.layout {
			grid-template-columns: 1fr;
			gap: 14px;
		}

		/* In colonna non c'è niente accanto da cui prendere l'altezza. */
		.preview {
			height: 200px;
		}

		.stats {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 8px;
		}
	}
</style>
