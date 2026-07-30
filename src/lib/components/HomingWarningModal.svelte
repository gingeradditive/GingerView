<script lang="ts">
	import { mdiAlertCircleOutline } from '@mdi/js';

	let {
		isOpen,
		onConfirm,
		onCancel
	}: {
		isOpen: boolean;
		onConfirm: () => void;
		onCancel: () => void;
	} = $props();

	// Embla applies a `transform` to the carousel track for its slide animation,
	// which creates a new containing block for any `position: fixed` descendant.
	// Moving the overlay to <body> keeps it anchored to the real viewport instead
	// of being clipped/mispositioned relative to the carousel.
	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				node.remove();
			}
		};
	}
</script>

{#if isOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events,a11y_no_noninteractive_element_interactions -->
	<div
		class="modal-overlay"
		role="dialog"
		aria-modal="true"
		aria-label="Confirm before homing"
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
			<h3>Before you continue</h3>
			<ul class="checklist">
				<li>Check that the nozzle is clean</li>
				<li>Check that the bed is clear</li>
			</ul>
			<div class="modal-actions">
				<button class="modal-cancel" onclick={onCancel}>Cancel</button>
				<button class="modal-confirm" onclick={onConfirm}>Confirm</button>
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
		z-index: 2000;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.modal-content {
		background: #fff;
		border-radius: 16px;
		padding: 24px;
		min-width: 300px;
		max-width: 400px;
		display: flex;
		flex-direction: column;
		align-items: center;
		box-shadow: 0px 4px 3px 0px #00000040;
	}

	.warning-icon {
		margin-bottom: 8px;
	}

	.modal-content h3 {
		margin: 0 0 16px 0;
		font-size: 1.1rem;
		font-weight: 700;
		color: #111;
		text-align: center;
	}

	.checklist {
		margin: 0 0 20px 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 10px;
		width: 100%;
	}

	.checklist li {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 0.95rem;
		color: #333;
		background: #f5f5f5;
		border-radius: 8px;
		padding: 10px 14px;
	}

	.checklist li::before {
		content: '';
		flex-shrink: 0;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #d72e28;
	}

	.modal-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
		width: 100%;
	}

	.modal-cancel {
		padding: 8px 20px;
		border: 1px solid #c8c8c8;
		border-radius: 8px;
		background: #fff;
		cursor: pointer;
		font-size: 0.9rem;
		color: #666;
	}

	.modal-cancel:hover {
		background-color: #f5f5f5;
	}

	.modal-confirm {
		padding: 8px 20px;
		border: none;
		border-radius: 8px;
		background: #d72e28;
		color: white;
		cursor: pointer;
		font-size: 0.9rem;
		transition: background-color 0.15s;
	}

	.modal-confirm:hover {
		background: #b82520;
	}
</style>
