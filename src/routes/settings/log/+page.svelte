<script lang="ts">
	import { Download, FileText, Trash2, LoaderCircle } from 'lucide-svelte';
	import { LOG_FILES, downloadLog, clearLogs, type LogFile } from '$lib/services/moonraker-logs';

	let downloadingId = $state<string | null>(null);
	let isClearing = $state(false);

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

	async function handleClear() {
		if (isClearing) return;
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

<section class="logs-page">
	<div class="logs-card">
		<header class="logs-header">
			<h1>Logs</h1>
		</header>

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

		<div class="actions-row">
			<button type="button" class="clear-btn" onclick={handleClear} disabled={isClearing}>
				{#if isClearing}
					<LoaderCircle class="spin" />
				{:else}
					<Trash2 />
				{/if}
				Clear logs
			</button>
		</div>
	</div>
</section>

<style>
	.logs-page {
		height: 100%;
		padding: 24px 24px 112px;
		box-sizing: border-box;
	}
	.logs-card {
		height: 100%;
		background: var(--color-white);
		border-radius: 20px;
		box-shadow: var(--shadow-float);
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		box-sizing: border-box;
	}
	.logs-header {
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}
	.logs-header h1 {
		margin: 0;
		font-size: 2rem;
		font-weight: 700;
		color: var(--color-text-secondary);
	}
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
	.actions-row {
		display: flex;
		justify-content: flex-end;
		flex-shrink: 0;
		margin-top: auto;
	}
	.clear-btn {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		border: none;
		background: var(--color-red);
		color: var(--color-white);
		border-radius: 16px;
		padding: 12px 24px;
		font-size: 1rem;
		font-weight: 700;
	}
	.clear-btn:disabled {
		opacity: 0.55;
	}
</style>
