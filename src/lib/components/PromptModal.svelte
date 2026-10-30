<script lang="ts">
	import Sheet from '$lib/components/ui/Sheet.svelte';
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
		hint = '',
		busy = false,
		busyLabel = 'Working…',
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
		/** Una riga sotto il titolo, quando il campo da solo non basta a capire. */
		hint?: string;
		/** Mentre la richiesta è in volo: il pulsante si spegne e mostra `busyLabel`. */
		busy?: boolean;
		busyLabel?: string;
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
		if (busy) return;
		const message = validate?.(draft) ?? '';
		if (message) {
			error = message;
			return;
		}
		onConfirm(draft.trim());
	}
</script>

{#if isOpen}
	<Sheet label={title} onClose={onCancel} size="sm">
		{#snippet header()}
			<h3 class="sheet-title">{title}</h3>
			{#if hint}
				<p class="sheet-subtitle">{hint}</p>
			{/if}
		{/snippet}

		<label class="sheet-field">
			<span>{label}</span>
			<input
				bind:this={input}
				type="text"
				bind:value={draft}
				{placeholder}
				spellcheck="false"
				autocapitalize="off"
				aria-invalid={!!error}
				onkeydown={(e) => e.key === 'Enter' && submit()}
				oninput={() => (error = '')}
			/>
		</label>
		{#if error}
			<p class="sheet-error error" role="alert">{error}</p>
		{/if}

		{#snippet footer()}
			<button type="button" class="btn btn-secondary" onclick={onCancel}>Cancel</button>
			<button type="button" class="btn btn-primary" disabled={busy} onclick={submit}>
				{busy ? busyLabel : confirmLabel}
			</button>
		{/snippet}
	</Sheet>
{/if}

<style>
	.error {
		margin-top: 10px;
	}
</style>
