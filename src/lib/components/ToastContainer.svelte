<script lang="ts">
	import { toasts, toastActions } from '$lib/stores/toastStore';
	import type { Toast, ToastType, ToastSource } from '$lib/stores/toastStore';
	import { X, AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-svelte';

	let detailToast = $state<Toast | null>(null);

	function getIcon(type: ToastType) {
		switch (type) {
			case 'error':
				return AlertCircle;
			case 'warning':
				return AlertTriangle;
			case 'info':
				return Info;
			case 'success':
				return CheckCircle;
		}
	}

	function getSourceLabel(source: ToastSource): string {
		switch (source) {
			case 'klipper':
				return 'Kalico';
			case 'moonraker':
				return 'Moonraker';
			case 'network':
				return 'Network';
			case 'system':
				return 'System';
		}
	}

	function openDetails(toast: Toast) {
		detailToast = toast;
	}

	function closeDetails() {
		detailToast = null;
	}
</script>

<div class="toast-container" aria-live="polite" aria-label="Notifications">
	{#each $toasts as toast (toast.id)}
		{@const Icon = getIcon(toast.type)}
		<div class="toast toast-{toast.type}" role="alert">
			<div class="toast-icon">
				<Icon size={18} />
			</div>
			<div class="toast-body">
				<div class="toast-header">
					<span class="toast-source">{getSourceLabel(toast.source)}</span>
					<strong class="toast-title">{toast.title}</strong>
				</div>
				<p class="toast-message">{toast.message}</p>
			</div>
			<div class="toast-actions">
				{#if toast.details}
					<button
						type="button"
						class="toast-info-btn"
						onclick={() => openDetails(toast)}
						aria-label="Show details"
					>
						<Info size={14} />
					</button>
				{/if}
				{#if toast.dismissible}
					<button
						type="button"
						class="toast-close"
						onclick={() => toastActions.dismiss(toast.id)}
						aria-label="Dismiss notification"
					>
						<X size={14} />
					</button>
				{/if}
			</div>
		</div>
	{/each}
</div>

{#if detailToast}
	<div
		class="detail-overlay"
		role="dialog"
		aria-modal="true"
		aria-labelledby="toast-detail-title"
		tabindex="0"
		onkeydown={(e) => e.key === 'Escape' && closeDetails()}
		onclick={(e) => e.target === e.currentTarget && closeDetails()}
	>
		<div class="detail-modal" role="document">
			<div class="detail-header">
				<div class="detail-header-left">
					{#if detailToast.type === 'error'}
						<span class="detail-icon detail-icon-error"><AlertCircle size={18} /></span>
					{:else if detailToast.type === 'warning'}
						<span class="detail-icon detail-icon-warning"><AlertTriangle size={18} /></span>
					{:else if detailToast.type === 'info'}
						<span class="detail-icon detail-icon-info"><Info size={18} /></span>
					{:else}
						<span class="detail-icon detail-icon-success"><CheckCircle size={18} /></span>
					{/if}
					<div>
						<span class="toast-source">{getSourceLabel(detailToast.source)}</span>
						<h4 id="toast-detail-title">{detailToast.title}</h4>
					</div>
				</div>
				<button type="button" class="toast-close" onclick={closeDetails} aria-label="Close">
					<X size={16} />
				</button>
			</div>
			<div class="detail-body">
				<p class="detail-message">{detailToast.message}</p>
				<pre class="detail-pre">{detailToast.details}</pre>
			</div>
		</div>
	</div>
{/if}

<style>
	.toast-container {
		position: fixed;
		top: 16px;
		right: 16px;
		z-index: 9999;
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-width: 420px;
		width: 100%;
		pointer-events: none;
	}

	.toast {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 12px 14px;
		border-radius: 20px;
		
		background: #FFFFFF;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.10);
		pointer-events: auto;
		animation: toast-slide-in 0.28s ease-out;
		font-family: 'Montserrat', sans-serif;
		transition: box-shadow 0.2s;
	}

	.toast-error {
		border-color: #f5c2c2;
		background: #fef2f2;
	}
	.toast-error:hover {
		box-shadow: 0 6px 24px rgba(215, 46, 40, 0.16);
	}
	.toast-error .toast-icon {
		color: #d72e28;
	}

	.toast-warning {
		border-color: #fde68a;
		background: #fffbeb;
	}
	.toast-warning:hover {
		box-shadow: 0 6px 24px rgba(230, 168, 23, 0.16);
	}
	.toast-warning .toast-icon {
		color: #e6a817;
	}

	.toast-info {
		border-color: #93c5fd;
		background: #eff6ff;
	}
	.toast-info:hover {
		box-shadow: 0 6px 24px rgba(37, 99, 235, 0.16);
	}
	.toast-info .toast-icon {
		color: #2563eb;
	}

	.toast-success {
		border-color: #86efac;
		background: #f0fdf4;
	}
	.toast-success:hover {
		box-shadow: 0 6px 24px rgba(26, 127, 55, 0.16);
	}
	.toast-success .toast-icon {
		color: #1a7f37;
	}

	.toast-icon {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		margin-top: 1px;
	}

	.toast-body {
		flex: 1;
		min-width: 0;
	}

	.toast-header {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 2px;
	}

	.toast-source {
		font-size: 0.68rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: #888;
		background: #f0f0f0;
		padding: 1px 6px;
		border-radius: 4px;
	}

	.toast-title {
		font-size: 0.84rem;
		font-weight: 700;
		color: #111;
	}

	.toast-message {
		margin: 0;
		font-size: 0.78rem;
		color: #555;
		line-height: 1.4;
		word-break: break-word;
	}

	.toast-close {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: #999;
		cursor: pointer;
		padding: 0;
		transition: background-color 0.15s, color 0.15s;
	}

	.toast-close:hover {
		background: rgba(0, 0, 0, 0.06);
		color: #555;
	}

	.toast-actions {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.toast-info-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: #666;
		cursor: pointer;
		padding: 0;
		transition: color 0.15s;
	}

	.toast-info-btn:hover {
		color: #333;
	}

	.detail-overlay {
		position: fixed;
		inset: 0;
		z-index: 10000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
		background: linear-gradient(135deg, rgba(255, 255, 255, 0.35), rgba(245, 245, 245, 0.28));
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
	}

	.detail-modal {
		width: min(540px, calc(100vw - 32px));
		max-height: calc(100vh - 64px);
		background: #FFFFFF;
		
		border-radius: 20px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.10);
		transition: box-shadow 0.2s;
	}

	.detail-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 14px 16px;
		border-bottom: 1px solid #ececec;
		gap: 12px;
	}

	.detail-header-left {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}

	.detail-header-left h4 {
		margin: 2px 0 0;
		font-size: 0.95rem;
		color: #111;
	}

	.detail-icon {
		flex-shrink: 0;
		display: flex;
	}

	.detail-icon-error { color: #d72e28; }
	.detail-icon-warning { color: #e6a817; }
	.detail-icon-info { color: #2563eb; }
	.detail-icon-success { color: #1a7f37; }

	.detail-body {
		padding: 16px;
		overflow-y: auto;
	}

	.detail-message {
		margin: 0 0 12px;
		font-size: 0.85rem;
		color: #555;
		line-height: 1.5;
	}

	.detail-pre {
		margin: 0;
		padding: 12px;
		background: #f8f8f8;
		border: 1px solid #e2e2e2;
		border-radius: 10px;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.8rem;
		line-height: 1.6;
		white-space: pre-wrap;
		word-break: break-word;
		color: #333;
	}

	@keyframes toast-slide-in {
		from {
			opacity: 0;
			transform: translateX(40px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	@media (max-width: 480px) {
		.toast-container {
			right: 12px;
			left: 12px;
			top: 12px;
			max-width: none;
			width: calc(100vw - 24px);
		}

		.toast {
			padding: 10px 12px;
			font-size: 0.9rem;
		}

		.toast-title {
			font-size: 0.8rem;
		}

		.toast-message {
			font-size: 0.75rem;
		}

		.toast-source {
			font-size: 0.65rem;
			padding: 1px 5px;
		}

		.detail-modal {
			width: calc(100vw - 24px);
			margin: 12px;
			border-radius: 16px;
		}

		.detail-header {
			padding: 12px 14px;
		}

		.detail-body {
			padding: 14px;
		}

		.detail-message {
			font-size: 0.8rem;
		}

		.detail-pre {
			font-size: 0.75rem;
			padding: 10px;
			border-radius: 8px;
		}
	}
</style>
