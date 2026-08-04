<script lang="ts">
	import {
		ChevronDown,
		ChevronRight,
		File,
		Folder,
		LoaderCircle,
		Pencil,
		Trash2
	} from 'lucide-svelte';
	import ConfigFileTree from './ConfigFileTree.svelte';
	import type { ConfigTreeNode } from '$lib/services/moonraker-config';

	// Recurses by importing itself: `<svelte:self>` is deprecated in Svelte 5.
	let {
		nodes,
		depth = 0,
		selectedPath,
		loadingPath,
		readOnly = false,
		onSelect,
		onToggle,
		onRename,
		onDelete
	}: {
		nodes: ConfigTreeNode[];
		depth?: number;
		selectedPath: string;
		/** Folder currently being fetched, so its row can show a spinner. */
		loadingPath: string;
		readOnly?: boolean;
		onSelect: (node: ConfigTreeNode) => void;
		onToggle: (node: ConfigTreeNode) => void;
		onRename: (node: ConfigTreeNode) => void;
		onDelete: (node: ConfigTreeNode) => void;
	} = $props();
</script>

<ul class="tree" style="--depth: {depth}">
	{#each nodes as node (node.entry.path)}
		<li>
			<div class="row" class:selected={node.entry.path === selectedPath}>
				<button
					type="button"
					class="entry"
					onclick={() => (node.entry.isDirectory ? onToggle(node) : onSelect(node))}
					title={node.entry.path}
				>
					<span class="twisty">
						{#if node.entry.isDirectory}
							{#if node.entry.path === loadingPath}
								<LoaderCircle class="spin" size={14} />
							{:else if node.expanded}
								<ChevronDown size={14} />
							{:else}
								<ChevronRight size={14} />
							{/if}
						{/if}
					</span>
					<span class="glyph">
						{#if node.entry.isDirectory}
							<Folder size={16} />
						{:else}
							<File size={16} />
						{/if}
					</span>
					<span class="name">{node.entry.name}</span>
				</button>

				{#if !readOnly}
					<span class="row-actions">
						<button
							type="button"
							class="icon-btn"
							onclick={() => onRename(node)}
							aria-label="Rename {node.entry.name}"
							title="Rename"
						>
							<Pencil size={15} />
						</button>
						<button
							type="button"
							class="icon-btn danger"
							onclick={() => onDelete(node)}
							aria-label="Delete {node.entry.name}"
							title="Delete"
						>
							<Trash2 size={15} />
						</button>
					</span>
				{/if}
			</div>

			{#if node.entry.isDirectory && node.expanded && node.children}
				{#if node.children.length === 0}
					<p class="empty" style="--depth: {depth + 1}">Empty</p>
				{:else}
					<ConfigFileTree
						nodes={node.children}
						depth={depth + 1}
						{selectedPath}
						{loadingPath}
						{readOnly}
						{onSelect}
						{onToggle}
						{onRename}
						{onDelete}
					/>
				{/if}
			{/if}
		</li>
	{/each}
</ul>

<style>
	.tree {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.row {
		display: flex;
		align-items: center;
		border-radius: 10px;
		padding-right: 4px;
		padding-left: calc(var(--depth) * 14px);
	}
	.row:hover {
		background: var(--color-background);
	}
	.row.selected {
		background: var(--color-danger-bg);
	}
	.entry {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 6px;
		background: transparent;
		border: none;
		padding: 8px 4px;
		font-size: 0.88rem;
		font-family: inherit;
		color: var(--color-text-muted);
		text-align: left;
		cursor: pointer;
	}
	.row.selected .entry {
		color: var(--color-red);
		font-weight: 700;
	}
	.twisty,
	.glyph {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		flex-shrink: 0;
		color: var(--color-text-subtle);
	}
	.row.selected .glyph {
		color: var(--color-red);
	}
	.name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.row-actions {
		display: flex;
		gap: 2px;
		flex-shrink: 0;
	}
	.icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--color-gray-light);
		cursor: pointer;
	}
	.icon-btn:hover {
		background: var(--color-white);
		color: var(--color-text-muted);
	}
	.icon-btn.danger:hover {
		color: var(--color-red);
	}
	.empty {
		margin: 0;
		padding: 6px 4px 6px calc(var(--depth) * 14px + 26px);
		font-size: 0.8rem;
		color: var(--color-gray-light);
	}
</style>
