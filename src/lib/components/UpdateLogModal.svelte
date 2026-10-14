<script lang="ts">
	import Sheet from '$lib/components/ui/Sheet.svelte';
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
	<!-- Finché gira non si chiude: niente Escape, niente tocco fuori. -->
	<Sheet
		label={title}
		onClose={logState === 'running' ? undefined : onClose}
		dismissible={false}
		size="lg"
		panelClass="update-log-panel"
	>
		{#snippet header()}
			<div class="log-header">
				<h3 class="sheet-title">{title}</h3>
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
			</div>
		{/snippet}

		<div class="log-body">
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
				<p class="sheet-error">{errorMessage}</p>
			{:else if logState === 'success' && successNote}
				<p class="note">{successNote}</p>
			{/if}
		</div>

		{#snippet footer()}
			<button
				type="button"
				class="btn btn-primary"
				onclick={onClose}
				disabled={logState === 'running'}
			>
				{closeLabel}
			</button>
		{/snippet}
	</Sheet>
{/if}

<style>
	:global(.update-log-panel) {
		height: min(600px, calc(100dvh - 48px));
	}

	@media (max-width: 767.98px) {
		:global(.update-log-panel) {
			height: calc(100dvh - 24px);
		}
	}

	.log-header {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.state-pill {
		margin-left: auto;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		border-radius: 999px;
		padding: 6px 14px;
		font-size: 0.85rem;
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

	.log-body {
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.log-output {
		flex: 1;
		min-height: 120px;
		overflow-y: auto;
		border: 1px solid var(--color-border-light);
		border-radius: 14px;
		padding: 14px 16px;
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
</style>
