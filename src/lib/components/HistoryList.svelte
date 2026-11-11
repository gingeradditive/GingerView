<script lang="ts">
	import SettingsSheet from '$lib/components/SettingsSheet.svelte';
	import { tooltip } from '$lib/actions/tooltip';
	import { onMount } from 'svelte';
	import { Check, Hourglass, Info, Minus, Trash2, X } from 'lucide-svelte';
	import type { MoonrakerHistoryJob, HistoryStatus } from '$lib/types/history';
	import {
		fetchHistoryList,
		deleteHistoryJob,
		deleteAllHistory,
		getHistoryThumbnailUrl,
		formatHistoryDateParts
	} from '$lib/services/moonraker-history';
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
		icon: typeof Check;
		className: string;
	} {
		if (status === 'completed') return { label: 'Completed', icon: Check, className: 'success' };
		if (status === 'cancelled') return { label: 'Cancelled', icon: Minus, className: 'warning' };
		if (status === 'in_progress')
			return { label: 'In progress', icon: Hourglass, className: 'info' };
		return { label: 'Error', icon: X, className: 'danger' };
	}

	onMount(() => {
		ensurePrinterTimezone();
		loadFirstPage();
	});
</script>

<SettingsSheet title="History" size="lg" tall>
	<!-- I filtri a sinistra, Clear history sulla stessa riga a destra. -->
	<div class="toolbar">
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
		<button
			type="button"
			class="clear-button"
			disabled={jobs.length === 0}
			onclick={() => (showClearAllConfirm = true)}
		>
			<Trash2 size={18} aria-hidden="true" />
			<span class="clear-label">Clear history</span>
		</button>
	</div>

	<div class="list-area">
		{#if loading}
			<div class="status-message">Just a sec…</div>
		{:else if error}
			<div class="status-message error">{error}</div>
		{:else if filteredJobs.length === 0}
			<div class="status-message">No prints here yet. Time to make something!</div>
		{:else}
			<div class="table">
				<div class="row header">
					<span class="col status"><span class="sr-only">Status</span></span>
					<span class="col thumb"></span>
					<span class="col name">Name</span>
					<span class="col date">Started</span>
					<span class="col actions"></span>
				</div>
				{#each filteredJobs as job (job.job_id)}
					{@const meta = statusMeta(job.status)}
					{@const started = formatHistoryDateParts(job.start_time, $printerTimezone)}
					<div
						class="row item"
						role="button"
						tabindex="0"
						onclick={() => openDetails(job)}
						onkeydown={(e) =>
							(e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openDetails(job))}
					>
						<!-- Lo stato è solo icona e colore: il nome per esteso nel tooltip e per i lettori. -->
						<span class="col status {meta.className}" use:tooltip={meta.label}>
							<meta.icon size={14} strokeWidth={3} aria-hidden="true" />
							<span class="sr-only">{meta.label}</span>
						</span>
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
							<span class="col date">
								<span class="day">{started.day}</span>
								<span class="time">{started.time}</span>
							</span>
						</span>
						<span class="col actions">
							<!-- Durata, materiale ed eliminazione stanno nei dettagli: (i) li apre come il tocco sulla riga. -->
							<button
								type="button"
								class="info-button"
								aria-label="Details"
								use:tooltip
								onclick={(e) => (e.stopPropagation(), openDetails(job))}
							>
								<Info size={20} />
							</button>
						</span>
					</div>
				{/each}
			</div>

			{#if !exhausted}
				<div bind:this={sentinel} class="sentinel"></div>
			{/if}
			{#if loadingMore}
				<div class="status-message">Loading more…</div>
			{/if}
		{/if}
	</div>
</SettingsSheet>

<HistoryDetailsPopup
	job={selectedJob}
	isOpen={showDetails}
	onClose={closeDetails}
	onDelete={(job) => requestDelete(job)}
/>

<ConfirmModal
	icon={Trash2}
	isOpen={jobPendingDelete !== null}
	title="Delete this entry?"
	message={jobPendingDelete ? `"${jobPendingDelete.filename}" will be removed from history.` : ''}
	confirmLabel="Delete"
	onConfirm={confirmDelete}
	onCancel={() => (jobPendingDelete = null)}
/>

<ConfirmModal
	icon={Trash2}
	isOpen={showClearAllConfirm}
	title="Clear your print history?"
	message="All entries will be permanently removed. This can't be undone."
	confirmLabel="Clear all"
	onConfirm={confirmClearAll}
	onCancel={() => (showClearAllConfirm = false)}
/>

<style>
	.clear-button {
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

	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-shrink: 0;
	}

	.tabs {
		flex: 1;
		min-width: 0;
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

	/* Intestazione e righe sulla stessa griglia, così le colonne restano in colonna.
	   Stato, anteprima, nome, data, dettagli. La colonna dello stato è 5px più larga del tondo:
	   lo stacca dall'anteprima. */
	.table {
		--history-columns: 29px 48px minmax(0, 1fr) 120px 44px;
		display: flex;
		flex-direction: column;
	}

	.row.header {
		display: grid;
		grid-template-columns: var(--history-columns);
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
		display: grid;
		grid-template-columns: var(--history-columns);
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
		display: contents;
	}

	/* Lo stato: un tondo col fondo tenue e il simbolo pieno, come i vecchi badge senza testo. */
	.row.item .col.status {
		display: flex;
		align-items: center;
		justify-content: center;
		justify-self: start;
		width: 24px;
		height: 24px;
		border-radius: 50%;
	}

	.col.status.success {
		background: var(--color-success-bg);
		color: var(--color-success);
	}

	.col.status.warning {
		background: var(--color-warning-bg);
		color: var(--color-warning);
	}

	.col.status.danger {
		background: var(--color-danger-bg);
		color: var(--color-red);
	}

	.col.status.info {
		background: var(--color-info-bg);
		color: var(--color-info);
	}

	/* Started centrata: intestazione e valori. */
	.row.header .col.date {
		text-align: center;
	}

	.row.item .col.date {
		display: flex;
		flex-direction: column;
		align-items: center;
		line-height: 1.3;
	}

	.row.item .col.date .time {
		color: var(--color-text-subtle);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.row.item .col.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 600;
		color: var(--color-black);
	}

	.row.item .col.date {
		font-size: 0.85rem;
		color: var(--color-text-soft);
	}

	.col.actions {
		display: flex;
		justify-content: flex-end;
		flex-shrink: 0;
	}

	.info-button {
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

	.info-button:hover {
		background: var(--color-background);
		color: var(--color-text-muted);
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

		/* Sul telefono non sta accanto ai filtri: resta il cestino, il nome lo leggono i lettori. */
		.clear-button {
			padding: 8px;
			width: 36px;
			height: 36px;
			justify-content: center;
		}

		/* Chip un po' più strette; se non bastano scorrono di lato invece di andare a capo. */
		.tabs {
			flex-wrap: nowrap;
			gap: 4px;
			overflow-x: auto;
			scrollbar-width: none;
		}

		.tab {
			padding: 8px 10px;
			flex-shrink: 0;
		}

		.clear-button {
			flex-shrink: 0;
			margin-left: -4px;
		}

		.clear-label {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip: rect(0, 0, 0, 0);
			white-space: nowrap;
		}

		.row.item {
			grid-template-columns: 29px 40px minmax(0, 1fr) 32px;
		}

		/* Sul telefono la data torna su una riga, sotto il nome. */
		.row.item .col.date {
			flex-direction: row;
			align-items: baseline;
			gap: 4px;
			line-height: inherit;
		}

		.col.main {
			display: flex;
			flex-direction: column;
			align-items: flex-start;
			gap: 4px;
		}

		.row.item .col.name {
			white-space: normal;
			max-width: 100%;
		}
	}
</style>
