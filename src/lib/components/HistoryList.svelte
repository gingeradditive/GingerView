<script lang="ts">
	import { onMount } from 'svelte';
	import { CheckCircle2, XCircle, Ban, Trash2, RefreshCw } from 'lucide-svelte';
	import type { MoonrakerHistoryJob, HistoryStatus } from '$lib/types/history';
	import {
		fetchHistoryList,
		deleteHistoryJob,
		deleteAllHistory,
		getHistoryThumbnailUrl,
		formatFilamentUsed,
		formatHistoryDate
	} from '$lib/services/moonraker-history';
	import { formatEstimatedTime } from '$lib/services/moonraker-files';
	import { ensurePrinterTimezone, printerTimezone } from '$lib/stores/timezoneStore';
	import ConfirmModal from './ConfirmModal.svelte';
	import HistoryDetailsPopup from './HistoryDetailsPopup.svelte';

	const PAGE_SIZE = 20;

	type FilterTab = 'all' | 'completed' | 'cancelled' | 'error';

	const TABS: { id: FilterTab; label: string }[] = [
		{ id: 'all', label: 'All' },
		{ id: 'completed', label: 'Completed' },
		{ id: 'cancelled', label: 'Cancelled' },
		{ id: 'error', label: 'Error' }
	];

	// Ogni stato di Moonraker finisce in una delle tre categorie che l'utente vede:
	// solo `in_progress` non appartiene a nessuna (una stampa in corso non è ancora storia).
	const ERROR_STATUSES: HistoryStatus[] = [
		'error',
		'klippy_shutdown',
		'klippy_disconnect',
		'interrupted',
		'server_exit'
	];

	function tabOf(status: HistoryStatus): FilterTab | null {
		if (status === 'completed') return 'completed';
		if (status === 'cancelled') return 'cancelled';
		if (ERROR_STATUSES.includes(status)) return 'error';
		return null;
	}

	let jobs: MoonrakerHistoryJob[] = $state([]);
	let loading = $state(true);
	let loadingMore = $state(false);
	let error: string | null = $state(null);
	let nextStart = 0;
	let exhausted = $state(false);
	let activeTab: FilterTab = $state('all');

	let selectedJob: MoonrakerHistoryJob | null = $state(null);
	let showDetails = $state(false);
	let jobPendingDelete: MoonrakerHistoryJob | null = $state(null);
	let showClearAllConfirm = $state(false);

	const filteredJobs = $derived(
		activeTab === 'all' ? jobs : jobs.filter((j) => tabOf(j.status) === activeTab)
	);

	async function loadFirstPage() {
		loading = true;
		error = null;
		jobs = [];
		nextStart = 0;
		exhausted = false;
		try {
			const result = await fetchHistoryList(PAGE_SIZE, 0);
			jobs = result.jobs;
			nextStart = result.jobs.length;
			exhausted = result.jobs.length >= result.count;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load history';
		} finally {
			loading = false;
		}
	}

	async function loadMore() {
		if (loadingMore || exhausted) return;
		loadingMore = true;
		try {
			const result = await fetchHistoryList(PAGE_SIZE, nextStart);
			jobs = [...jobs, ...result.jobs];
			nextStart += result.jobs.length;
			exhausted = result.jobs.length === 0 || nextStart >= result.count;
		} catch (e) {
			console.error('Failed to load more history:', e);
		} finally {
			loadingMore = false;
		}
	}

	let sentinel = $state<HTMLElement | undefined>();

	$effect(() => {
		const node = sentinel;
		if (!node) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) loadMore();
			},
			{ rootMargin: '200px' }
		);
		observer.observe(node);
		return () => observer.disconnect();
	});

	function openDetails(job: MoonrakerHistoryJob) {
		selectedJob = job;
		showDetails = true;
	}

	function closeDetails() {
		showDetails = false;
	}

	function requestDelete(job: MoonrakerHistoryJob, event?: Event) {
		event?.stopPropagation();
		jobPendingDelete = job;
	}

	async function confirmDelete() {
		if (!jobPendingDelete) return;
		const job = jobPendingDelete;
		jobPendingDelete = null;
		try {
			await deleteHistoryJob(job.job_id);
			jobs = jobs.filter((j) => j.job_id !== job.job_id);
			if (selectedJob?.job_id === job.job_id) {
				showDetails = false;
			}
		} catch (e) {
			console.error('Failed to delete history entry:', e);
		}
	}

	async function confirmClearAll() {
		showClearAllConfirm = false;
		try {
			await deleteAllHistory();
			await loadFirstPage();
		} catch (e) {
			console.error('Failed to clear history:', e);
		}
	}

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

	onMount(() => {
		ensurePrinterTimezone();
		loadFirstPage();
	});
</script>

<section class="history-page">
	<div class="history-card">
		<header class="history-header">
			<h1>History</h1>
			<button
				type="button"
				class="clear-button"
				disabled={jobs.length === 0}
				onclick={() => (showClearAllConfirm = true)}
			>
				<Trash2 size={18} />
				<span>Clear history</span>
			</button>
		</header>

		<div class="tabs" role="tablist">
			{#each TABS as tab (tab.id)}
				<button
					type="button"
					role="tab"
					aria-selected={activeTab === tab.id}
					class="tab"
					class:active={activeTab === tab.id}
					onclick={() => (activeTab = tab.id)}
				>
					{tab.label}
				</button>
			{/each}
		</div>

		<div class="list-area">
			{#if loading}
				<div class="status-message">Loading...</div>
			{:else if error}
				<div class="status-message error">{error}</div>
			{:else if filteredJobs.length === 0}
				<div class="status-message">No prints found</div>
			{:else}
				<div class="table">
					<div class="row header">
						<span class="col thumb"></span>
						<span class="col name">Name</span>
						<span class="col status">Status</span>
						<span class="col date">Start</span>
						<span class="col duration">Duration</span>
						<span class="col filament">Filament</span>
						<span class="col actions"></span>
					</div>
					{#each filteredJobs as job (job.job_id)}
						{@const meta = statusMeta(job.status)}
						<div
							class="row item"
							role="button"
							tabindex="0"
							onclick={() => openDetails(job)}
							onkeydown={(e) =>
								(e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openDetails(job))}
						>
							<span class="col thumb">
								<img
									src={getHistoryThumbnailUrl(job) ?? '/error-thumbnail.png'}
									alt=""
									width="40"
									height="40"
								/>
							</span>
							<span class="col main">
								<span class="col name" title={job.filename}>{job.filename}</span>
								<span class="col status">
									<span class="status-badge {meta.className}">
										<meta.icon size={14} />
										{meta.label}
									</span>
								</span>
								<span class="meta-line">
									<span class="col date">{formatHistoryDate(job.start_time, $printerTimezone)}</span
									>
									<span class="col duration">{formatEstimatedTime(job.print_duration)}</span>
									<span class="col filament">{formatFilamentUsed(job.filament_used)}</span>
								</span>
							</span>
							<span class="col actions">
								<button
									type="button"
									class="delete-button"
									aria-label="Delete entry"
									onclick={(e) => requestDelete(job, e)}
								>
									<Trash2 size={16} />
								</button>
							</span>
						</div>
					{/each}
				</div>

				{#if !exhausted}
					<div bind:this={sentinel} class="sentinel"></div>
				{/if}
				{#if loadingMore}
					<div class="status-message">Loading more...</div>
				{/if}
			{/if}
		</div>
	</div>
</section>

<HistoryDetailsPopup
	job={selectedJob}
	isOpen={showDetails}
	onClose={closeDetails}
	onDelete={(job) => requestDelete(job)}
/>

<ConfirmModal
	isOpen={jobPendingDelete !== null}
	title="Delete this entry?"
	message={jobPendingDelete ? `"${jobPendingDelete.filename}" will be removed from history.` : ''}
	confirmLabel="Delete"
	onConfirm={confirmDelete}
	onCancel={() => (jobPendingDelete = null)}
/>

<ConfirmModal
	isOpen={showClearAllConfirm}
	title="Clear print history?"
	message="All entries will be permanently removed. This cannot be undone."
	confirmLabel="Clear all"
	onConfirm={confirmClearAll}
	onCancel={() => (showClearAllConfirm = false)}
/>

<style>
	.history-page {
		height: 100%;
		padding: 24px 24px 112px;
		box-sizing: border-box;
	}

	.history-card {
		height: 100%;
		background: var(--color-white);
		border-radius: 20px;
		box-shadow: var(--shadow-float);
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		box-sizing: border-box;
		min-height: 0;
	}

	.history-header {
		display: flex;
		align-items: center;
		gap: 14px;
		flex-shrink: 0;
	}

	.history-header h1 {
		margin: 0;
		font-size: 2rem;
		font-weight: 700;
		color: var(--color-text-secondary);
	}

	.clear-button {
		margin-left: auto;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		border: none;
		border-radius: 999px;
		background: var(--color-danger-bg);
		color: var(--color-red);
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		flex-shrink: 0;
	}

	.clear-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.tabs {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		flex-shrink: 0;
	}

	.tab {
		padding: 8px 16px;
		border: none;
		border-radius: 20px;
		background: var(--color-background);
		color: var(--color-text-soft);
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
	}

	.tab.active {
		background: var(--color-red);
		color: var(--color-white);
	}

	.list-area {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		border: 1px solid var(--color-border-light);
		border-radius: 16px;
		box-sizing: border-box;
	}

	.table {
		display: flex;
		flex-direction: column;
	}

	.row.header {
		display: grid;
		grid-template-columns: 48px 2fr 140px 140px 100px 100px 44px;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		text-align: left;
		font-size: 0.78rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--color-text-subtle);
		position: sticky;
		top: 0;
		background: var(--color-white);
		border-bottom: 1px solid var(--color-border-light);
	}

	.row.item {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 10px 16px;
		text-align: left;
		border: none;
		background: transparent;
		border-top: 1px solid var(--color-surface-sunken);
		cursor: pointer;
		font: inherit;
		color: inherit;
	}

	.table .row.item:first-child {
		border-top: none;
	}

	.row.item:hover {
		background: var(--color-background);
	}

	.col {
		min-width: 0;
	}

	.col.thumb {
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}

	.col.thumb img {
		width: 40px;
		height: 40px;
		object-fit: cover;
		border-radius: 8px;
		background: var(--color-background);
	}

	.col.main {
		flex: 1;
		min-width: 0;
		display: grid;
		grid-template-columns: 2fr 140px 140px 100px 100px;
		align-items: center;
		gap: 12px;
	}

	.col.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 600;
		color: var(--color-black);
	}

	.meta-line {
		display: contents;
	}

	.col.date,
	.col.duration,
	.col.filament {
		font-size: 0.85rem;
		color: var(--color-text-soft);
	}

	.status-badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		border-radius: 12px;
		font-size: 0.78rem;
		font-weight: 600;
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

	.col.actions {
		display: flex;
		justify-content: flex-end;
		flex-shrink: 0;
	}

	.delete-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--color-text-subtle);
		cursor: pointer;
	}

	.delete-button:hover {
		background: var(--color-danger-bg);
		color: var(--color-red);
	}

	.status-message {
		text-align: center;
		padding: 48px 16px;
		font-size: 1.1rem;
		color: var(--color-text-subtle);
	}

	.status-message.error {
		color: var(--color-red);
	}

	.sentinel {
		height: 1px;
	}

	@media (max-width: 767.98px) {
		.row.header {
			display: none;
		}

		.col.main {
			display: flex;
			flex-direction: column;
			align-items: flex-start;
			gap: 4px;
		}

		.col.name {
			white-space: normal;
			max-width: 100%;
		}

		.meta-line {
			display: flex;
			flex-wrap: wrap;
			gap: 0 6px;
		}

		.col.date::after,
		.col.duration::after {
			content: '·';
			margin-left: 6px;
			color: var(--color-text-subtle);
		}
	}
</style>
