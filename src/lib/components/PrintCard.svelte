<script lang="ts">
	import type { PrintItem } from '$lib/types/print';
	import { onMount } from 'svelte';
	import { activeContextMenuId } from '$lib/stores/contextMenuStore';
	import {
		deleteFile,
		deleteDirectory,
		moveFile,
		fetchDirectoriesRecursive
	} from '$lib/services/moonraker-files';
	import { mdiDotsVertical, mdiFolder } from '@mdi/js';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import { toastActions } from '$lib/stores/toastStore';

	let { item }: { item: PrintItem } = $props();

	let showContextMenu = $state(false);
	let contextMenuX = $state(0);
	let contextMenuY = $state(0);
	let showMoveModal = $state(false);
	let availableDirs: { name: string; path: string }[] = $state([]);
	let loadingDirs = $state(false);
	let showRenameModal = $state(false);
	let newName = $state('');

	// Subscribe to global context menu store
	let activeContextMenuIdValue = $state<string | null>(null);

	onMount(() => {
		// Subscribe to store changes
		const unsubscribe = activeContextMenuId.subscribe((value) => {
			activeContextMenuIdValue = value;
		});

		return unsubscribe;
	});

	// Ingombro del menu, per non aprirlo oltre il bordo dello schermo: tre voci da 44px.
	const MENU_WIDTH = 180;
	const MENU_HEIGHT = 148;

	/** `x`/`y` in pixel dello schermo, come `clientX` o `getBoundingClientRect()`. */
	function openContextMenu(x: number, y: number) {
		// Sui monitor grandi la pagina è zoomata (app.css) e un `left` in CSS px viene
		// moltiplicato: le coordinate dello schermo vanno riportate in CSS px.
		const zoom =
			(document.documentElement as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom ?? 1;
		const maxX = window.innerWidth / zoom - MENU_WIDTH - 8;
		const maxY = window.innerHeight / zoom - MENU_HEIGHT - 8;
		contextMenuX = Math.max(8, Math.min(x / zoom, maxX));
		contextMenuY = Math.max(8, Math.min(y / zoom, maxY));
		showContextMenu = true;
		// Set this card as the active context menu globally
		activeContextMenuId.set(item.id);
	}

	function handleContextMenu(event: MouseEvent) {
		event.preventDefault();
		openContextMenu(event.clientX, event.clientY);
	}

	/** Il pulsante ⋮: su touch il click destro non esiste (iOS non manda `contextmenu`). */
	function handleMenuButton(event: MouseEvent) {
		// Né la card (aprirebbe il dettaglio) né la window (chiuderebbe il menu) devono vederlo.
		event.stopPropagation();
		if (showContextMenu) {
			closeContextMenu();
			return;
		}
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		openContextMenu(rect.left, rect.bottom);
	}

	// Moonraker non ha un cestino: eliminare è definitivo, quindi si chiede prima.
	let showDeleteConfirm = $state(false);

	const describeError = (e: unknown): string => (e instanceof Error ? e.message : 'Unknown error');

	function handleDelete() {
		closeContextMenu();
		showDeleteConfirm = true;
	}

	async function confirmDelete() {
		showDeleteConfirm = false;
		try {
			// Moonraker delete API needs the full path including gcodes/
			const fullPath = `gcodes/${item.filepath}`;
			if (item.isDirectory) {
				await deleteDirectory(fullPath);
			} else {
				await deleteFile(fullPath);
			}
			// Dispatch a custom event so the parent can refresh the list
			if (typeof window !== 'undefined') {
				window.dispatchEvent(new CustomEvent('moonraker-file-deleted'));
			}
		} catch (e) {
			console.error('Delete failed:', e);
			toastActions.error('moonraker', 'Delete failed', describeError(e));
		}
	}

	async function handleMove() {
		closeContextMenu();
		loadingDirs = true;
		showMoveModal = true;
		try {
			availableDirs = await fetchDirectoriesRecursive();
			// Filter out the current directory and its subdirectories to prevent circular moves
			if (item.isDirectory) {
				const currentPath = item.filepath;
				availableDirs = availableDirs.filter((dir) => !dir.path.startsWith(currentPath));
			}
		} catch (e) {
			console.error('Failed to fetch directories:', e);
			availableDirs = [];
		} finally {
			loadingDirs = false;
		}
	}

	async function confirmMove(destDir: string) {
		try {
			const source = `gcodes/${item.filepath}`;
			const dest = destDir ? `gcodes/${destDir}/${item.filename}` : `gcodes/${item.filename}`;
			await moveFile(source, dest);
			showMoveModal = false;
			if (typeof window !== 'undefined') {
				window.dispatchEvent(new CustomEvent('moonraker-file-deleted'));
			}
		} catch (e) {
			console.error('Move failed:', e);
			toastActions.error('moonraker', 'Move failed', describeError(e));
		}
	}

	function handleRename() {
		closeContextMenu();
		// Pre-fill with current name (without extension for files)
		if (item.isDirectory) {
			newName = item.filename;
		} else {
			const dotIndex = item.filename.lastIndexOf('.');
			newName = dotIndex > 0 ? item.filename.substring(0, dotIndex) : item.filename;
		}
		showRenameModal = true;
	}

	async function confirmRename() {
		if (!newName.trim()) return;
		try {
			const source = `gcodes/${item.filepath}`;
			// For files, preserve the extension
			let finalName = newName.trim();
			if (!item.isDirectory) {
				const dotIndex = item.filename.lastIndexOf('.');
				const ext = dotIndex > 0 ? item.filename.substring(dotIndex) : '';
				if (!finalName.endsWith(ext)) {
					finalName += ext;
				}
			}
			// Build dest: same parent directory, new name
			const parentPath = item.filepath.includes('/')
				? item.filepath.substring(0, item.filepath.lastIndexOf('/'))
				: '';
			const dest = parentPath ? `gcodes/${parentPath}/${finalName}` : `gcodes/${finalName}`;
			await moveFile(source, dest);
			showRenameModal = false;
			if (typeof window !== 'undefined') {
				window.dispatchEvent(new CustomEvent('moonraker-file-deleted'));
			}
		} catch (e) {
			console.error('Rename failed:', e);
			toastActions.error('moonraker', 'Rename failed', describeError(e));
		}
	}

	function closeContextMenu() {
		showContextMenu = false;
		if (activeContextMenuIdValue === item.id) {
			activeContextMenuId.set(null);
		}
	}

	function handleClickOutside() {
		closeContextMenu();
	}

	// Close context menu if another one is opened
	$effect(() => {
		if (activeContextMenuIdValue !== null && activeContextMenuIdValue !== item.id) {
			showContextMenu = false;
		}
	});
</script>

<svelte:window onclick={handleClickOutside} />

<div class="print-card" role="button" tabindex="0" oncontextmenu={handleContextMenu}>
	<button
		class="menu-button"
		aria-label="Actions for {item.name}"
		aria-haspopup="menu"
		aria-expanded={showContextMenu}
		onclick={handleMenuButton}
		onkeydown={(e) => e.stopPropagation()}
	>
		<svg viewBox="0 0 24 24" aria-hidden="true"><path d={mdiDotsVertical} /></svg>
	</button>
	{#if item.isDirectory}
		<img class="folder-image" src="/Folder.svg" alt={item.name} width="250" height="250" />
	{:else}
		<div class="card-inner">
			<div class="image-wrapper">
				<img
					src={item.imageUrl ?? '/error-thumbnail.png'}
					alt={item.name}
					width="250"
					height="250"
				/>
				<div class="gradient-top"></div>
				<div class="gradient-bottom"></div>
				<div class="material-label">{item.material}</div>
				<div class="duration-label">{item.duration}</div>
			</div>
		</div>
	{/if}
	<div class="name-label" title={item.name}>{item.name}</div>
</div>

{#if showContextMenu}
	<div
		class="context-menu"
		role="menu"
		tabindex="0"
		style="left: {contextMenuX}px; top: {contextMenuY}px;"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.key === 'Escape' && handleClickOutside()}
	>
		<button class="context-menu-item" role="menuitem" onclick={handleRename}> Rename </button>
		<button class="context-menu-item" role="menuitem" onclick={handleMove}> Move </button>
		<button class="context-menu-item delete" role="menuitem" onclick={handleDelete}>
			{item.isDirectory ? 'Delete folder' : 'Delete print'}
		</button>
	</div>
{/if}

{#if showRenameModal}
	<div
		class="modal-overlay"
		role="dialog"
		tabindex="0"
		onclick={(e) => e.target === e.currentTarget && (showRenameModal = false)}
		onkeydown={(e) => e.key === 'Escape' && (showRenameModal = false)}
	>
		<div class="modal-content">
			<h3>Rename</h3>
			<input
				type="text"
				bind:value={newName}
				placeholder="New name"
				class="rename-input"
				onkeydown={(e) => e.key === 'Enter' && confirmRename()}
			/>
			<div class="modal-actions">
				<button class="modal-confirm" onclick={confirmRename}>Rename</button>
				<button class="modal-cancel" onclick={() => (showRenameModal = false)}>Cancel</button>
			</div>
		</div>
	</div>
{/if}

{#if showMoveModal}
	<div
		class="modal-overlay"
		role="dialog"
		tabindex="0"
		onclick={(e) => e.target === e.currentTarget && (showMoveModal = false)}
		onkeydown={(e) => e.key === 'Escape' && (showMoveModal = false)}
	>
		<div class="modal-content">
			<h3>Move "{item.name}"</h3>
			{#if loadingDirs}
				<p class="modal-loading">Loading folders...</p>
			{:else}
				<div class="folder-list">
					<button class="folder-option" onclick={() => confirmMove('')}>
						<svg viewBox="0 0 24 24" width="20" height="20"
							><path d={mdiFolder} fill="#D72E28" /></svg
						>
						/ (Root)
					</button>
					{#each availableDirs as dir (dir.path)}
						<button class="folder-option" onclick={() => confirmMove(dir.path)}>
							<svg viewBox="0 0 24 24" width="20" height="20"
								><path d={mdiFolder} fill="#D72E28" /></svg
							>
							/{dir.path}
						</button>
					{/each}
				</div>
			{/if}
			<button class="modal-cancel" onclick={() => (showMoveModal = false)}>Cancel</button>
		</div>
	</div>
{/if}

<ConfirmModal
	isOpen={showDeleteConfirm}
	title={item.isDirectory ? 'Delete this folder?' : 'Delete this file?'}
	message={item.isDirectory
		? `"${item.name}" and everything inside it will be deleted from the printer.`
		: `"${item.name}" will be deleted from the printer.`}
	details="This can't be undone."
	confirmLabel="Delete"
	onConfirm={confirmDelete}
	onCancel={() => (showDeleteConfirm = false)}
/>

<style>
	/* La larghezza la decide la griglia di PrintList; tutto il resto è in proporzione alla card
	   (cqw), così la stessa card sta bene a 150px su un telefono e a 300px su un monitor. */
	.print-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		width: 100%;
		cursor: pointer;
		container-type: inline-size;
	}

	.menu-button {
		position: absolute;
		top: 6px;
		right: 6px;
		z-index: 1;
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: none;
		border-radius: 50%;
		background: rgba(var(--rgb-white), 0.9);
		box-shadow: var(--shadow-float);
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.menu-button svg {
		width: 24px;
		height: 24px;
		fill: currentColor;
	}

	/* Col mouse c'è il click destro: il pulsante compare solo passandoci sopra. Su touch resta
	   sempre visibile, perché è l'unica strada per rinominare, spostare o cancellare. */
	@media (hover: hover) {
		.menu-button {
			opacity: 0;
			transition: opacity 0.15s;
		}

		.print-card:hover .menu-button,
		.menu-button:focus-visible,
		.menu-button[aria-expanded='true'] {
			opacity: 1;
		}
	}

	.card-inner {
		background: var(--color-white);
		border-radius: 20px;
		box-shadow: var(--shadow-panel);
		width: 100%;
		box-sizing: border-box;
	}

	.image-wrapper {
		width: 100%;
		aspect-ratio: 1;
		border-radius: 20px;
		overflow: hidden;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-white);
	}

	.image-wrapper img {
		width: calc(100% - 10px);
		height: calc(100% - 10px);
		object-fit: cover;
		padding: 10px;
	}

	.folder-image {
		width: 100%;
		height: auto;
		aspect-ratio: 1;
		padding: 10%;
		object-fit: contain;
	}

	.gradient-top {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 18cqw;
		background: linear-gradient(to bottom, rgba(var(--rgb-white), 0.95), transparent);
		pointer-events: none;
	}

	.gradient-bottom {
		position: absolute;
		bottom: 0;
		left: 0;
		width: 100%;
		height: 18cqw;
		background: linear-gradient(to top, rgba(var(--rgb-white), 0.95), transparent);
		pointer-events: none;
	}

	.material-label {
		position: absolute;
		top: 4cqw;
		left: 4cqw;
		font-size: clamp(0.75rem, 5.5cqw, 1.1rem);
		font-weight: 700;
		color: var(--color-black);
		background: transparent;
		padding: 0;
		border-radius: 0;
	}

	.duration-label {
		position: absolute;
		bottom: 4cqw;
		right: 4cqw;
		font-size: clamp(0.7rem, 5cqw, 1.05rem);
		font-weight: 600;
		color: var(--color-black);
		background: transparent;
		padding: 0;
		border-radius: 0;
	}

	/* Il nome si taglia dove finisce la card, non a 20 caratteri fissi; intero nel tooltip. */
	.name-label {
		width: 100%;
		font-size: clamp(0.85rem, 6cqw, 1.25rem);
		font-weight: 600;
		color: var(--color-black);
		text-align: center;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.context-menu {
		position: fixed;
		background: var(--color-white);
		border: none;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(var(--rgb-black), 0.15);
		z-index: 1000;
		min-width: 150px;
		max-width: 180px;
		padding: 4px 0;
	}

	.context-menu-item {
		width: 100%;
		min-height: 44px;
		padding: 8px 16px;
		background: none;
		border: none;
		text-align: left;
		cursor: pointer;
		font-size: 0.9rem;
		color: var(--color-black);
		transition: background-color 0.2s;
	}

	.context-menu-item:hover {
		background-color: var(--color-background);
	}

	.context-menu-item.delete {
		color: var(--color-red);
	}

	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: linear-gradient(
			135deg,
			rgba(var(--rgb-gray-mid), 0.3),
			rgba(var(--rgb-gray-mid), 0.22)
		);
		backdrop-filter: blur(12px) saturate(130%);
		-webkit-backdrop-filter: blur(12px) saturate(130%);
		z-index: 2000;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.modal-content {
		background: var(--color-white);
		border-radius: 16px;
		padding: 24px;
		/* Percentuali dell'overlay, non vw/vh: vedi lo zoom in app.css. */
		width: min(400px, calc(100% - 32px));
		box-sizing: border-box;
		max-height: 80%;
		display: flex;
		flex-direction: column;
		box-shadow: var(--shadow-panel);
	}

	.modal-content h3 {
		margin: 0 0 16px 0;
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--color-black);
	}

	.modal-loading {
		color: var(--color-text-soft);
		font-size: 0.9rem;
	}

	.folder-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		overflow-y: auto;
		flex: 1;
		min-height: 0;
		margin-bottom: 16px;
	}

	.folder-option {
		display: flex;
		align-items: center;
		min-height: 44px;
		gap: 10px;
		padding: 10px 12px;
		border: none;
		background: none;
		cursor: pointer;
		font-size: 0.9rem;
		color: var(--color-black);
		border-radius: 8px;
		text-align: left;
		transition: background-color 0.15s;
	}

	.folder-option:hover {
		background-color: var(--color-background);
	}

	.modal-cancel {
		align-self: flex-end;
		min-height: 44px;
		padding: 8px 20px;
		border: 1px solid var(--color-gray);
		border-radius: 8px;
		background: var(--color-white);
		cursor: pointer;
		font-size: 0.9rem;
		color: var(--color-text-soft);
		transition: background-color 0.15s;
	}

	.modal-cancel:hover {
		background-color: var(--color-background);
	}

	.rename-input {
		width: 100%;
		padding: 12px;
		border: 1px solid var(--color-gray);
		border-radius: 8px;
		font-size: 0.9rem;
		margin-bottom: 16px;
		box-sizing: border-box;
	}

	.rename-input:focus {
		outline: none;
		border-color: var(--color-red);
	}

	.modal-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}

	.modal-confirm {
		min-height: 44px;
		padding: 8px 20px;
		border: none;
		border-radius: 8px;
		background: var(--color-red);
		color: white;
		cursor: pointer;
		font-size: 0.9rem;
		transition: background-color 0.15s;
	}

	.modal-confirm:hover {
		background: var(--color-red-dark);
	}
</style>
