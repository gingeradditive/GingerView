<script lang="ts">
	import { GitBranch, Globe, HardDrive, Package, TriangleAlert } from 'lucide-svelte';
	import type { UpdateItem } from '$lib/types/update';
	import {
		describeItem,
		getItemLabel,
		getItemType,
		getVersionLine
	} from '$lib/services/moonraker-update';

	// Read-only row: name, version and state. Updating happens only through the
	// page's "Update all" button, never per item. The one action that lives here
	// is recovery, and only when Moonraker's flags say the repo is broken — at
	// that point "Update all" cannot fix it on its own.
	let {
		item,
		busy,
		blockedReason,
		onRecover
	}: {
		item: UpdateItem;
		/** An operation is running: every action on every item must be inert. */
		busy: boolean;
		/** Non-empty when actions are unavailable, e.g. while a print is running. */
		blockedReason: string;
		onRecover: (name: string, hard: boolean) => void;
	} = $props();

	let state = $derived(describeItem(item));
	let type = $derived(getItemType(item));
	let label = $derived(getItemLabel(item));
	let versionLine = $derived(getVersionLine(item));
	let actionsDisabled = $derived(busy || blockedReason !== '');

	const typeIcons = {
		system: HardDrive,
		git_repo: GitBranch,
		web: Globe,
		zip: Globe,
		python: Package
	};
	let Icon = $derived(typeIcons[type as keyof typeof typeIcons] ?? Package);
</script>

<div class="item">
	<div class="item-head">
		<span class="icon"><Icon /></span>
		<span class="item-text">
			<span class="item-name">{label}</span>
			<span class="item-version">{versionLine}</span>
		</span>
		<span class="badge {state.badgeTone}">{state.badge}</span>
	</div>

	{#if state.needsRecovery}
		<div class="recovery">
			<p class="recovery-text">
				<TriangleAlert size={16} />
				<span>
					Moonraker reports this repository as <strong>{state.badge.toLowerCase()}</strong> and cannot
					update it. A soft recovery discards local changes with a reset; a hard recovery deletes the
					repository and clones it again.
				</span>
			</p>
			<div class="recovery-actions">
				<button
					type="button"
					class="ghost-btn"
					onclick={() => onRecover(item.name, false)}
					disabled={actionsDisabled}
				>
					Soft recovery
				</button>
				<button
					type="button"
					class="ghost-btn danger"
					onclick={() => onRecover(item.name, true)}
					disabled={actionsDisabled}
				>
					Hard recovery
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.item {
		border-bottom: 1px solid #ececec;
		padding-bottom: 4px;
	}
	.item:last-child {
		border-bottom: none;
		padding-bottom: 0;
	}
	.item-head {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 4px;
	}
	.icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		color: #444444;
		flex-shrink: 0;
	}
	.item-text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.item-name {
		font-size: 1.05rem;
		font-weight: 700;
		color: #111111;
	}
	.item-version {
		font-size: 0.82rem;
		color: #8a8a8a;
		overflow-wrap: anywhere;
	}
	.badge {
		border-radius: 999px;
		padding: 5px 12px;
		font-size: 0.75rem;
		font-weight: 600;
		white-space: nowrap;
		flex-shrink: 0;
	}
	.badge.ok {
		background: #ddf3df;
		color: #1a7f37;
	}
	.badge.pending {
		background: #fdf0d5;
		color: #9a6700;
	}
	.badge.problem {
		background: #f7d9d8;
		color: #d72e28;
	}
	.recovery {
		background: #f5f5f5;
		border-radius: 12px;
		padding: 14px;
		margin: 0 4px 14px 46px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.recovery-text {
		margin: 0;
		display: flex;
		align-items: flex-start;
		gap: 8px;
		font-size: 0.85rem;
		color: #444444;
		line-height: 1.45;
	}
	.recovery-text :global(svg) {
		flex-shrink: 0;
		margin-top: 2px;
		color: #9a6700;
	}
	.recovery-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.ghost-btn {
		border: 1px solid #c8c8c8;
		background: #ffffff;
		color: #444444;
		border-radius: 12px;
		padding: 10px 18px;
		font-size: 0.88rem;
		font-weight: 600;
		cursor: pointer;
	}
	.ghost-btn:hover:not(:disabled) {
		background: #f5f5f5;
	}
	.ghost-btn.danger {
		border-color: #d72e28;
		color: #d72e28;
	}
	.ghost-btn:disabled {
		opacity: 0.55;
		cursor: default;
	}
</style>
