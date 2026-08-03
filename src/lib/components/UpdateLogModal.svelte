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
		onClose
	}: {
		isOpen: boolean;
		title: string;
		lines: string[];
		logState: UpdateLogState;
		errorMessage?: string;
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
			{/if}

			<div class="log-actions">
				<button type="button" class="close-btn" onclick={onClose} disabled={logState === 'running'}>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: linear-gradient(135deg, rgba(100, 100, 100, 0.3), rgba(100, 100, 100, 0.22));
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
		background: #ffffff;
		border-radius: 20px;
		padding: 24px;
		width: min(720px, 100%);
		height: min(560px, 100%);
		display: flex;
		flex-direction: column;
		gap: 16px;
		box-shadow: 0px 4px 3px 0px #00000040;
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
		color: #222222;
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
		background: #fdf0d5;
		color: #9a6700;
	}
	.state-pill.success {
		background: #ddf3df;
		color: #1a7f37;
	}
	.state-pill.error {
		background: #f7d9d8;
		color: #d72e28;
	}
	.log-output {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		border: 1px solid #e2e2e2;
		border-radius: 16px;
		padding: 16px 20px;
		box-sizing: border-box;
		background: #fafafa;
	}
	.log-line {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.82rem;
		line-height: 1.5;
		color: #2e2e2e;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.log-line.muted {
		color: #b5b5b5;
	}
	.note {
		margin: 0;
		font-size: 0.85rem;
		color: #8a8a8a;
		flex-shrink: 0;
	}
	.note.error {
		color: #d72e28;
		font-weight: 600;
	}
	.log-actions {
		display: flex;
		justify-content: flex-end;
		flex-shrink: 0;
	}
	.close-btn {
		border: none;
		background: #d72e28;
		color: #ffffff;
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
	:global(.spin) {
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
