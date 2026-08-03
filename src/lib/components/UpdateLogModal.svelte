<script lang="ts">
	import { LoaderCircle, CircleCheck, CircleX } from 'lucide-svelte';
	import type { UpdateLogState } from '$lib/types/update';

	// Live output of an update/recovery/rollback. Moonraker streams it over the
	// WebSocket as `notify_update_response`, one line at a time; the page collects
	// those lines and passes them here.
	// The prop is `logState`, not `state`: a local binding called `state` would
	// shadow the `$state` rune inside this component.
	let {
		isOpen,
		title,
		lines,
		logState,
		errorMessage = '',
		successNote = '',
		closeLabel = 'Close',
		onClose
	}: {
		isOpen: boolean;
		title: string;
		lines: string[];
		logState: UpdateLogState;
		errorMessage?: string;
		/** Shown under the output once the operation succeeded (e.g. reload notice). */
		successNote?: string;
		closeLabel?: string;
		onClose: () => void;
	} = $props();

	let logRef = $state<HTMLDivElement | null>(null);

	// Follow the tail of the output as it grows. La lettura di `lines.length` è
	// quella che registra la dipendenza reattiva dell'effect: senza, lo scroll non
	// si aggiorna quando arrivano nuove righe. Non è un'espressione morta.
	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		lines.length;
		if (logRef) logRef.scrollTop = logRef.scrollHeight;
	});
</script>

{#if isOpen}
	<div class="modal-overlay" role="dialog" aria-modal="true" aria-label={title}>
		<div class="modal-content">
			<header class="log-header">
				<h3>{title}</h3>
				<span class="state-pill {logState}">
					{#if logState === 'running'}
						<LoaderCircle class="spin" size={16} />
						Running
					{:else if logState === 'success'}
						<CircleCheck size={16} />
						Done
					{:else}
						<CircleX size={16} />
						Failed
					{/if}
				</span>
			</header>

			<div bind:this={logRef} class="log-output">
				{#each lines as line, index (index)}
					<div class="log-line">{line}</div>
				{/each}
				{#if lines.length === 0}
					<div class="log-line muted">Waiting for output…</div>
				{/if}
			</div>

			{#if logState === 'running'}
				<p class="note">Do not power off the printer until the operation has finished.</p>
			{:else if logState === 'error' && errorMessage}
				<p class="note error">{errorMessage}</p>
			{:else if logState === 'success' && successNote}
				<p class="note">{successNote}</p>
			{/if}

			<div class="log-actions">
				<button type="button" class="close-btn" onclick={onClose} disabled={logState === 'running'}>
					{closeLabel}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: linear-gradient(
			135deg,
			rgba(var(--rgb-gray-mid), 0.3),
			rgba(var(--rgb-gray-mid), 0.22)
		);
		backdrop-filter: blur(12px) saturate(130%);
		-webkit-backdrop-filter: blur(12px) saturate(130%);
		z-index: 2600;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
		box-sizing: border-box;
	}
	.modal-content {
		background: var(--color-white);
		border-radius: 20px;
		padding: 24px;
		width: min(720px, 100%);
		height: min(560px, 100%);
		display: flex;
		flex-direction: column;
		gap: 16px;
		box-shadow: var(--shadow-panel);
		box-sizing: border-box;
	}
	.log-header {
		display: flex;
		align-items: center;
		gap: 14px;
		flex-shrink: 0;
	}
	.log-header h3 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--color-text-secondary);
	}
	.state-pill {
		margin-left: auto;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		border-radius: 999px;
		padding: 8px 16px;
		font-size: 0.9rem;
		font-weight: 600;
		flex-shrink: 0;
	}
	.state-pill.running {
		background: var(--color-warning-bg);
		color: var(--color-warning);
	}
	.state-pill.success {
		background: var(--color-success-bg);
		color: var(--color-success);
	}
	.state-pill.error {
		background: var(--color-danger-bg);
		color: var(--color-red);
	}
	.log-output {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		border: 1px solid var(--color-border-light);
		border-radius: 16px;
		padding: 16px 20px;
		box-sizing: border-box;
		background: var(--color-background);
	}
	.log-line {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.82rem;
		line-height: 1.5;
		color: var(--color-text-secondary);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.log-line.muted {
		color: var(--color-gray-light);
	}
	.note {
		margin: 0;
		font-size: 0.85rem;
		color: var(--color-text-subtle);
		flex-shrink: 0;
	}
	.note.error {
		color: var(--color-red);
		font-weight: 600;
	}
	.log-actions {
		display: flex;
		justify-content: flex-end;
		flex-shrink: 0;
	}
	.close-btn {
		border: none;
		background: var(--color-red);
		color: var(--color-white);
		border-radius: 16px;
		padding: 12px 32px;
		font-size: 1rem;
		font-weight: 700;
		cursor: pointer;
	}
	.close-btn:disabled {
		opacity: 0.55;
		cursor: default;
	}
</style>
