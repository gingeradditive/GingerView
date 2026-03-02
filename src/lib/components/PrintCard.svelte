<script lang="ts">
	import type { PrintItem } from '$lib/types/print';
	import { onMount } from 'svelte';
	import { activeContextMenuId } from '$lib/stores/contextMenuStore';
	import { deleteFile, deleteDirectory, moveFile, fetchDirectoriesRecursive } from '$lib/services/moonraker-files';
	import { mdiFolder } from '@mdi/js';

	let { item }: { item: PrintItem } = $props();

	let nameElement: HTMLSpanElement;
	let isOverflowing = $state(false);
	let showContextMenu = $state(false);
	let contextMenuX = $state(0);
	let contextMenuY = $state(0);
	let showMoveModal = $state(false);
	let availableDirs: { name: string; path: string }[] = $state([]);
	let loadingDirs = $state(false);

	// Subscribe to global context menu store
	let activeContextMenuIdValue = $state<string | null>(null);

	onMount(() => {
		if (nameElement) {
			isOverflowing = nameElement.scrollWidth > 250;
		}
		
		// Subscribe to store changes
		const unsubscribe = activeContextMenuId.subscribe((value) => {
			activeContextMenuIdValue = value;
		});
		
		return unsubscribe;
	});

	function handleContextMenu(event: MouseEvent) {
		event.preventDefault();
		
		contextMenuX = event.clientX;
		contextMenuY = event.clientY;
		showContextMenu = true;
		// Set this card as the active context menu globally
		activeContextMenuId.set(item.id);
	}

	async function handleDelete() {
		closeContextMenu();
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
			alert('Delete failed: ' + (e instanceof Error ? e.message : 'Unknown error'));
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
				availableDirs = availableDirs.filter(dir => !dir.path.startsWith(currentPath));
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
			alert('Move failed: ' + (e instanceof Error ? e.message : 'Unknown error'));
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
	<div class="card-inner">
		<div class="image-wrapper">
			{#if item.isDirectory}
				<svg class="folder-icon" width="80" height="80" viewBox="0 0 24 24" fill="#D72E28">
					<path d={mdiFolder} />
				</svg>
			{:else}
				<img
					src={item.imageUrl ?? '/MOCK_THUMBNAIL.png'}
					alt={item.name}
					width="250"
					height="250"
				/>
			{/if}
			<div class="gradient-top"></div>
			<div class="gradient-bottom"></div>
			{#if !item.isDirectory}
				<div class="material-label">{item.material}</div>
				<div class="duration-label">{item.duration}</div>
			{/if}
		</div>
	</div>
	<div class="name-label" class:marquee={isOverflowing}>
		<span class="name-text" bind:this={nameElement}>{item.name}</span>
	</div>
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
		<button class="context-menu-item" role="menuitem" onclick={handleMove}>
			Sposta
		</button>
		<button class="context-menu-item delete" role="menuitem" onclick={handleDelete}>
			{item.isDirectory ? 'Elimina cartella' : 'Elimina stampa'}
		</button>
	</div>
{/if}

{#if showMoveModal}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<div class="modal-overlay" role="dialog" tabindex="0" onclick={() => (showMoveModal = false)} onkeydown={(e) => e.key === 'Escape' && (showMoveModal = false)}>
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<div class="modal-content" role="document" tabindex="0" onclick={(e) => e.stopPropagation()}>
			<h3>Sposta "{item.name}"</h3>
			{#if loadingDirs}
				<p class="modal-loading">Caricamento cartelle...</p>
			{:else}
				<div class="folder-list">
					<button class="folder-option" onclick={() => confirmMove('')}>
						<svg viewBox="0 0 24 24" width="20" height="20"><path d={mdiFolder} fill="#D72E28" /></svg>
						/ (Root)
					</button>
					{#each availableDirs as dir}
						<button class="folder-option" onclick={() => confirmMove(dir.path)}>
							<svg viewBox="0 0 24 24" width="20" height="20"><path d={mdiFolder} fill="#D72E28" /></svg>
							/{dir.path}
						</button>
					{/each}
				</div>
			{/if}
			<button class="modal-cancel" onclick={() => (showMoveModal = false)}>Annulla</button>
		</div>
	</div>
{/if}

<style>
	.print-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		width: 250px;
		cursor: pointer;
	}

	.card-inner {
		background: #FFFFFF;
		border-radius: 20px;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.10);
		width: 100%;
		box-sizing: border-box;
		transition: box-shadow 0.2s;
	}

	.card-inner:hover {
		box-shadow: 0 6px 24px rgba(0, 0, 0, 0.16);
	}

	.image-wrapper {
		width: 250px;
		height: 250px;
		border-radius: 20px;
		overflow: hidden;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #F5F5F5;
	}

	.image-wrapper img {
		width: calc(100% - 40px);
		height: calc(100% - 40px);
		object-fit: cover;
		padding: 20px;
	}

	.folder-icon {
		opacity: 0.85;
	}

	.gradient-top {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 60px;
		background: linear-gradient(to bottom, rgba(255, 255, 255, 0.95), transparent);
		pointer-events: none;
	}

	.gradient-bottom {
		position: absolute;
		bottom: 0;
		left: 0;
		width: 100%;
		height: 60px;
		background: linear-gradient(to top, rgba(255, 255, 255, 0.95), transparent);
		pointer-events: none;
	}

	.material-label {
		position: absolute;
		top: 12px;
		left: 12px;
		font-size: 1.1rem;
		font-weight: 700;
		color: #111111;
		background: transparent;
		padding: 0;
		border-radius: 0;
	}

	.duration-label {
		position: absolute;
		bottom: 12px;
		right: 12px;
		font-size: 1.05rem;
		font-weight: 600;
		color: #111111;
		background: transparent;
		padding: 0;
		border-radius: 0;
	}

	.name-label {
		font-size: 1.25rem;
		font-weight: 600;
		color: #111111;
		text-align: center;
		max-width: 250px;
		overflow: hidden;
		position: relative;
		white-space: nowrap;
	}

	.name-text {
		display: inline-block;
	}

	.marquee .name-text {
		animation: marquee 20s ease-in-out infinite;
	}

	@keyframes marquee {
		0% { transform: translateX(0); }
		83.33% { transform: translateX(calc(-100% + 250px)); }
		100% { transform: translateX(0); }
	}

	.context-menu {
		position: fixed;
		background: #FFFFFF;
		border: 1px solid #C8C8C8;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		z-index: 1000;
		min-width: 150px;
		padding: 4px 0;
	}

	.context-menu-item {
		width: 100%;
		padding: 8px 16px;
		background: none;
		border: none;
		text-align: left;
		cursor: pointer;
		font-size: 0.9rem;
		color: #111111;
		transition: background-color 0.2s;
	}

	.context-menu-item:hover {
		background-color: #F5F5F5;
	}

	.context-menu-item.delete {
		color: #D72E28;
	}

	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.4);
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
		max-height: 60vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
	}

	.modal-content h3 {
		margin: 0 0 16px 0;
		font-size: 1.1rem;
		font-weight: 700;
		color: #111;
	}

	.modal-loading {
		color: #666;
		font-size: 0.9rem;
	}

	.folder-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		overflow-y: auto;
		max-height: 40vh;
		margin-bottom: 16px;
	}

	.folder-option {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		border: none;
		background: none;
		cursor: pointer;
		font-size: 0.9rem;
		color: #111;
		border-radius: 8px;
		text-align: left;
		transition: background-color 0.15s;
	}

	.folder-option:hover {
		background-color: #F5F5F5;
	}

	.modal-cancel {
		align-self: flex-end;
		padding: 8px 20px;
		border: 1px solid #C8C8C8;
		border-radius: 8px;
		background: #fff;
		cursor: pointer;
		font-size: 0.9rem;
		color: #666;
		transition: background-color 0.15s;
	}

	.modal-cancel:hover {
		background-color: #F5F5F5;
	}
</style>
