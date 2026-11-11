<script lang="ts">
	import SettingsSheet from '$lib/components/SettingsSheet.svelte';
	import { tooltip } from '$lib/actions/tooltip';
	import { Download, FileText, Trash2, LoaderCircle } from 'lucide-svelte';
	import { LOG_FILES, downloadLog, clearLogs, type LogFile } from '$lib/services/moonraker-logs';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';

	let downloadingId = $state<string | null>(null);
	let isClearing = $state(false);
	let showClearConfirm = $state(false);

	async function handleDownload(file: LogFile) {
		if (downloadingId) return;
		downloadingId = file.id;
		try {
			await downloadLog(file);
		} catch {
			// Error toast already reported by downloadLog
		} finally {
			downloadingId = null;
		}
	}

	// I log sono quello che serve all'assistenza dopo un problema: svuotarli
	// per sbaglio li perde, quindi si chiede prima.
	function handleClear() {
		if (isClearing) return;
		showClearConfirm = true;
	}

	async function confirmClear() {
		showClearConfirm = false;
		isClearing = true;
		try {
			await clearLogs();
		} catch {
			// Error toast already reported by clearLogs
		} finally {
			isClearing = false;
		}
	}
</script>

<svelte:head>
	<title>Logs · G2</title>
</svelte:head>

<SettingsSheet title="Logs" size="md">
	<div class="log-list">
		{#each LOG_FILES as file (file.id)}
			<div class="log-row">
				<span class="icon"><FileText /></span>
				<div class="row-text">
					<h2>{file.label}</h2>
					<p>{file.filename}</p>
				</div>
				<button
					type="button"
					class="download-btn"
					onclick={() => handleDownload(file)}
					disabled={downloadingId === file.id}
					aria-label="Download {file.label} log"
					use:tooltip
					title="Download {file.label} log"
				>
					{#if downloadingId === file.id}
						<LoaderCircle class="spin" />
					{:else}
						<Download />
					{/if}
				</button>
			</div>
		{/each}
	</div>

	{#snippet footer()}
		<button type="button" class="btn btn-primary" onclick={handleClear} disabled={isClearing}>
			{#if isClearing}
				<LoaderCircle class="spin" />
			{:else}
				<Trash2 />
			{/if}
			Clear logs
		</button>
	{/snippet}
</SettingsSheet>

<ConfirmModal
	icon={Trash2}
	isOpen={showClearConfirm}
	title="Clear all the logs?"
	message="We'll empty the Klipper, Moonraker and Crowsnest logs."
	details="If support might need them, download them first."
	confirmLabel="Clear logs"
	onConfirm={confirmClear}
	onCancel={() => (showClearConfirm = false)}
/>

<style>
	.log-list {
		display: flex;
		flex-direction: column;
	}
	.log-row {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 14px 4px;
		border-bottom: 1px solid var(--color-surface-sunken);
	}
	.log-row:last-child {
		border-bottom: none;
	}
	.icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		color: var(--color-text-muted);
		flex-shrink: 0;
	}
	.row-text {
		flex: 1;
		min-width: 0;
	}
	.row-text h2 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 700;
	}
	.row-text p {
		margin: 2px 0 0;
		font-size: 0.85rem;
		color: var(--color-text-subtle);
	}
	.download-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 14px;
		background: transparent;
		color: var(--color-text-soft);
		flex-shrink: 0;
	}
	.download-btn:hover:not(:disabled) {
		color: var(--color-red);
	}
	.download-btn:disabled {
		opacity: 0.6;
	}
</style>
