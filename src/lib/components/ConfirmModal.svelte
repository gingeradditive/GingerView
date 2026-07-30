<script lang="ts">
	import { mdiAlertCircleOutline } from '@mdi/js';
	import { portal } from '$lib/actions/portal';

	// Generic confirmation dialog, styled after HomingWarningModal. Used by the
	// update page for the destructive operations (recovery, rollback), which must
	// never run on a stray tap.
	let {
		isOpen,
		title,
		message,
		details = '',
		confirmLabel = 'Confirm',
		onConfirm,
		onCancel
	}: {
		isOpen: boolean;
		title: string;
		message: string;
		details?: string;
		confirmLabel?: string;
		onConfirm: () => void;
		onCancel: () => void;
	} = $props();
</script>

{#if isOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events,a11y_no_noninteractive_element_interactions -->
	<!--
		Portalled unconditionally: the dock (`+layout.svelte`) is centred with
		`transform: translateX(-50%)`, which makes it a containing block for its
		`position: fixed` descendants, so the emergency stop's dialog would be laid
		out against the dock instead of the viewport. Same reason the carousel
		modals do it — see `portal.ts`.
	-->
	<div
		class="modal-overlay"
		role="dialog"
		aria-modal="true"
		aria-label={title}
		tabindex="-1"
		use:portal
		onclick={onCancel}
		onkeydown={(e) => e.key === 'Escape' && onCancel()}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events,a11y_no_noninteractive_element_interactions -->
		<div class="modal-content" role="document" onclick={(e) => e.stopPropagation()}>
			<svg class="warning-icon" viewBox="0 0 24 24" width="40" height="40" aria-hidden="true">
				<path d={mdiAlertCircleOutline} fill="#D72E28" />
			</svg>
			<h3>{title}</h3>
			<p class="message">{message}</p>
			{#if details}
				<p class="details">{details}</p>
			{/if}
			<div class="modal-actions">
				<button type="button" class="modal-cancel" onclick={onCancel}>Cancel</button>
				<button type="button" class="modal-confirm" onclick={onConfirm}>{confirmLabel}</button>
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
		z-index: 3000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
		box-sizing: border-box;
	}
	.modal-content {
		background: #ffffff;
		border-radius: 16px;
		padding: 24px;
		min-width: 300px;
		max-width: 420px;
		display: flex;
		flex-direction: column;
		align-items: center;
		box-shadow: 0px 4px 3px 0px #00000040;
	}
	.warning-icon {
		margin-bottom: 8px;
	}
	.modal-content h3 {
		margin: 0 0 12px;
		font-size: 1.1rem;
		font-weight: 700;
		color: #111111;
		text-align: center;
	}
	.message {
		margin: 0 0 12px;
		font-size: 0.95rem;
		color: #333333;
		text-align: center;
	}
	.details {
		margin: 0 0 20px;
		font-size: 0.85rem;
		color: #6e6e6e;
		text-align: center;
		background: #f5f5f5;
		border-radius: 8px;
		padding: 10px 14px;
		width: 100%;
		box-sizing: border-box;
	}
	.modal-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
		width: 100%;
		margin-top: 8px;
	}
	.modal-cancel {
		padding: 8px 20px;
		border: 1px solid #c8c8c8;
		border-radius: 8px;
		background: #ffffff;
		cursor: pointer;
		font-size: 0.9rem;
		color: #666666;
	}
	.modal-cancel:hover {
		background-color: #f5f5f5;
	}
	.modal-confirm {
		padding: 8px 20px;
		border: none;
		border-radius: 8px;
		background: #d72e28;
		color: #ffffff;
		cursor: pointer;
		font-size: 0.9rem;
		transition: background-color 0.15s;
	}
	.modal-confirm:hover {
		background: #b82520;
	}
</style>
