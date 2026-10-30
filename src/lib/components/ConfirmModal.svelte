<script lang="ts">
	import { OctagonAlert, TriangleAlert, Info, type Icon as LucideIcon } from 'lucide-svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';

	// Generic confirmation dialog, for the operations that must never run on a
	// stray tap (delete, stop, recovery). `tone` picks colour and default icon:
	// `danger` for what can't be undone, `warning` for what interrupts something,
	// `info` for the rest. `icon` replaces the default with the action's own
	// (a bin for Delete, a power button for Switch off).
	let {
		isOpen,
		title,
		message,
		details = '',
		confirmLabel = 'Confirm',
		tone = 'danger',
		icon,
		onConfirm,
		onCancel
	}: {
		isOpen: boolean;
		title: string;
		message: string;
		details?: string;
		confirmLabel?: string;
		tone?: 'danger' | 'warning' | 'info';
		icon?: typeof LucideIcon;
		onConfirm: () => void;
		onCancel: () => void;
	} = $props();

	const defaultIcons = { danger: OctagonAlert, warning: TriangleAlert, info: Info };
	const ToneIcon = $derived(icon ?? defaultIcons[tone]);
</script>

{#if isOpen}
	<!--
		Sheet is portalled: the dock (`+layout.svelte`) is centred with
		`transform: translateX(-50%)`, which makes it a containing block for its
		`position: fixed` descendants, so the emergency stop's dialog would be laid
		out against the dock instead of the viewport — see `portal.ts`.
	-->
	<Sheet label={title} onClose={onCancel} size="sm">
		<div class="content">
			<span class="badge {tone}" aria-hidden="true">
				<ToneIcon size={28} />
			</span>
			<h3 class="sheet-title">{title}</h3>
			<p class="message">{message}</p>
			{#if details}
				<p class="details">{details}</p>
			{/if}
		</div>

		{#snippet footer()}
			<button type="button" class="btn btn-secondary" onclick={onCancel}>Cancel</button>
			<button
				type="button"
				class="btn"
				class:btn-danger={tone === 'danger'}
				class:btn-primary={tone !== 'danger'}
				onclick={onConfirm}
			>
				{confirmLabel}
			</button>
		{/snippet}
	</Sheet>
{/if}

<style>
	.content {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding-top: 8px;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 60px;
		height: 60px;
		margin-bottom: 14px;
		border-radius: 50%;
	}

	.badge.danger {
		background: var(--color-danger-bg);
		color: var(--color-red);
	}

	.badge.warning {
		background: var(--color-warning-bg);
		color: var(--color-warning);
	}

	.badge.info {
		background: var(--color-info-bg);
		color: var(--color-info);
	}

	.message {
		margin: 8px 0 0;
		font-size: 0.95rem;
		line-height: 1.45;
		color: var(--color-text-muted);
	}

	.details {
		width: 100%;
		box-sizing: border-box;
		margin: 14px 0 0;
		padding: 10px 14px;
		border-radius: 10px;
		background: var(--color-background);
		font-size: 0.85rem;
		line-height: 1.4;
		color: var(--color-text-soft);
	}
</style>
