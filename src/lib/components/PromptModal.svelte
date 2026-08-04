<script lang="ts">
	// Single-input dialog, the counterpart of ConfirmModal for the actions that need
	// a name rather than a yes/no (new file, new folder, rename). Validation is the
	// caller's, passed back through `validate` so the message appears under the
	// field instead of as a toast after the fact.
	let {
		isOpen,
		title,
		label,
		value = '',
		placeholder = '',
		confirmLabel = 'Confirm',
		validate,
		onConfirm,
		onCancel
	}: {
		isOpen: boolean;
		title: string;
		label: string;
		value?: string;
		placeholder?: string;
		confirmLabel?: string;
		validate?: (value: string) => string;
		onConfirm: (value: string) => void;
		onCancel: () => void;
	} = $props();

	let draft = $state('');
	let error = $state('');
	let input = $state<HTMLInputElement | null>(null);

	// Re-seed every time the dialog opens: the same instance serves all three
	// actions, so a stale draft would leak from one into the next.
	$effect(() => {
		if (isOpen) {
			draft = value;
			error = '';
			input?.focus();
			input?.select();
		}
	});

	function submit() {
		const message = validate?.(draft) ?? '';
		if (message) {
			error = message;
			return;
		}
		onConfirm(draft.trim());
	}
</script>

{#if isOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events,a11y_no_noninteractive_element_interactions -->
	<div
		class="modal-overlay"
		role="dialog"
		aria-modal="true"
		aria-label={title}
		tabindex="-1"
		onclick={onCancel}
		onkeydown={(e) => e.key === 'Escape' && onCancel()}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events,a11y_no_noninteractive_element_interactions -->
		<div class="modal-content" role="document" onclick={(e) => e.stopPropagation()}>
			<h3>{title}</h3>
			<label class="field">
				<span>{label}</span>
				<input
					bind:this={input}
					type="text"
					bind:value={draft}
					{placeholder}
					spellcheck="false"
					autocapitalize="off"
					onkeydown={(e) => e.key === 'Enter' && submit()}
					oninput={() => (error = '')}
				/>
			</label>
			{#if error}
				<p class="error">{error}</p>
			{/if}
			<div class="modal-actions">
				<button type="button" class="modal-cancel" onclick={onCancel}>Cancel</button>
				<button type="button" class="modal-confirm" onclick={submit}>{confirmLabel}</button>
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
		z-index: 3000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
		box-sizing: border-box;
	}
	.modal-content {
		background: var(--color-white);
		border-radius: 16px;
		padding: 24px;
		min-width: 300px;
		max-width: 420px;
		width: 100%;
		display: flex;
		flex-direction: column;
		box-shadow: var(--shadow-panel);
		box-sizing: border-box;
	}
	.modal-content h3 {
		margin: 0 0 16px;
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--color-black);
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.field span {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-text-soft);
	}
	.field input {
		border: 1px solid var(--color-gray);
		border-radius: 10px;
		padding: 10px 12px;
		font-size: 0.95rem;
		font-family: inherit;
		color: var(--color-black);
	}
	.field input:focus {
		outline: none;
		border-color: var(--color-red);
	}
	.error {
		margin: 8px 0 0;
		font-size: 0.82rem;
		color: var(--color-red);
	}
	.modal-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
		margin-top: 20px;
	}
	.modal-cancel {
		padding: 8px 20px;
		border: 1px solid var(--color-gray);
		border-radius: 8px;
		background: var(--color-white);
		cursor: pointer;
		font-size: 0.9rem;
		color: var(--color-text-soft);
	}
	.modal-cancel:hover {
		background-color: var(--color-background);
	}
	.modal-confirm {
		padding: 8px 20px;
		border: none;
		border-radius: 8px;
		background: var(--color-red);
		color: var(--color-white);
		cursor: pointer;
		font-size: 0.9rem;
		transition: background-color 0.15s;
	}
	.modal-confirm:hover {
		background: var(--color-red-dark);
	}
</style>
