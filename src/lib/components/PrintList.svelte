<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import PrintCard from './PrintCard.svelte';
	import CurrentDirectory from './CurrentDirectory.svelte';
	import type { PrintItem } from '$lib/types/print';
	import { mdiFolderPlus, mdiUpload, mdiFolder } from '@mdi/js';
	import {
		fetchDirectory,
		getThumbnailUrl,
		formatEstimatedTime,
		uploadFile,
		getFileMetadata,
		getFilamentType,
		extractThumbnailFromGcode,
		getErrorThumbnailUrl,
		createDirectory
	} from '$lib/services/moonraker-files';
	import { currentDirPath, navigateToDir } from '$lib/stores/directoryStore';

	const PAGE_SIZE = 20;

	let fileInput: HTMLInputElement;
	let allItems: PrintItem[] = $state([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let dirPath = '';
	let showCreateFolderModal = $state(false);
	let folderName = $state('');
	let visibleCount = PAGE_SIZE;

	const unsubscribe = currentDirPath.subscribe((value) => {
		dirPath = value;
		loadDirectory();
	});

	async function loadDirectory() {
		loading = true;
		error = null;
		allItems = [];
		visibleCount = PAGE_SIZE;

		try {
			const moonrakerPath = dirPath ? `gcodes/${dirPath}` : 'gcodes';
			const result = await fetchDirectory(moonrakerPath);

			const dirItems: PrintItem[] = result.dirs
				.filter(d => !d.dirname.startsWith('.'))
				.map((d) => ({
					id: `dir-${d.dirname}`,
					name: d.dirname,
					material: '',
					duration: '',
					filename: d.dirname,
					filepath: dirPath ? `${dirPath}/${d.dirname}` : d.dirname,
					modified: d.modified,
					size: d.size,
					isDirectory: true
				}));

			// Fetch metadata for all files to get filament information and thumbnails
			const fileMetadataPromises = result.files.map(async (f) => {
				try {
					const metadata = await getFileMetadata(f.filename, dirPath ? `gcodes/${dirPath}` : 'gcodes');
					
					// Try to get thumbnail from multiple sources
					let thumbnailUrl = getThumbnailUrl(f, dirPath ? `gcodes/${dirPath}` : 'gcodes');
					
					// If no thumbnail from Moonraker, try to extract from G-code
					if (!thumbnailUrl) {
						const extractedThumbnail = await extractThumbnailFromGcode(f.filename, dirPath ? `gcodes/${dirPath}` : 'gcodes');
						if (extractedThumbnail) {
							thumbnailUrl = extractedThumbnail;
						}
					}
					
					// If still no thumbnail, use error thumbnail
					if (!thumbnailUrl) {
						thumbnailUrl = getErrorThumbnailUrl();
					}
					
					return {
						id: `file-${f.filename}`,
						name: f.filename.replace(/\.gcode$/i, ''),
						material: getFilamentType(metadata),
						duration: formatEstimatedTime(metadata.estimated_time),
						imageUrl: thumbnailUrl,
						filename: f.filename,
						filepath: dirPath ? `${dirPath}/${f.filename}` : f.filename,
						modified: f.modified,
						size: f.size,
						isDirectory: false
					};
				} catch (e) {
					// Fallback to basic file info if metadata fetch fails
					console.warn(`Failed to fetch metadata for ${f.filename}:`, e);
					
					// Still try to get thumbnail from G-code even if metadata fails
					let thumbnailUrl = getThumbnailUrl(f, dirPath ? `gcodes/${dirPath}` : 'gcodes');
					if (!thumbnailUrl) {
						const extractedThumbnail = await extractThumbnailFromGcode(f.filename, dirPath ? `gcodes/${dirPath}` : 'gcodes');
						if (extractedThumbnail) {
							thumbnailUrl = extractedThumbnail;
						}
					}
					if (!thumbnailUrl) {
						thumbnailUrl = getErrorThumbnailUrl();
					}
					
					return {
						id: `file-${f.filename}`,
						name: f.filename.replace(/\.gcode$/i, ''),
						material: f.slicer ?? '',
						duration: formatEstimatedTime(f.estimated_time),
						imageUrl: thumbnailUrl,
						filename: f.filename,
						filepath: dirPath ? `${dirPath}/${f.filename}` : f.filename,
						modified: f.modified,
						size: f.size,
						isDirectory: false
					};
				}
			});

			const fileItems = await Promise.all(fileMetadataPromises);

			allItems = [...dirItems, ...fileItems];
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load files';
			console.error('Error loading directory:', e);
		} finally {
			loading = false;
		}
	}

	function handleFileUpload() {
		fileInput?.click();
	}

	async function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		
		if (file && file.name.toLowerCase().endsWith('.gcode')) {
			try {
				await uploadFile(file, dirPath ? `gcodes/${dirPath}` : 'gcodes');
				await loadDirectory();
			} catch (e) {
				console.error('Upload failed:', e);
				alert('Upload failed: ' + (e instanceof Error ? e.message : 'Unknown error'));
			}
		} else if (file) {
			alert('Per favore seleziona un file .gcode');
		}
		// Reset input so re-selecting same file triggers change
		if (target) target.value = '';
	}

	function handleItemClick(item: PrintItem) {
		if (item.isDirectory) {
			navigateToDir(item.filename);
		}
	}

	async function handleCreateFolder() {
		if (!folderName.trim()) return;
		
		try {
			const fullPath = dirPath ? `gcodes/${dirPath}/${folderName}` : `gcodes/${folderName}`;
			await createDirectory(fullPath);
			showCreateFolderModal = false;
			folderName = '';
			await loadDirectory();
		} catch (e) {
			console.error('Create folder failed:', e);
			alert('Create folder failed: ' + (e instanceof Error ? e.message : 'Unknown error'));
		}
	}

	const visiblePrints = $derived(() => allItems.slice(0, visibleCount));
	const hasMore = $derived(() => visibleCount < allItems.length);

	let sentinel: HTMLElement;
	let observer: IntersectionObserver;

	function loadMore() {
		if (hasMore()) {
			visibleCount = Math.min(visibleCount + PAGE_SIZE, allItems.length);
		}
	}

	function handleFileDeleted() {
		loadDirectory();
	}

	onMount(() => {
		observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) loadMore();
			},
			{ rootMargin: '200px' }
		);
		if (sentinel) observer.observe(sentinel);
		
		// Only add window event listeners in browser environment
		if (typeof window !== 'undefined') {
			window.addEventListener('moonraker-file-deleted', handleFileDeleted);
		}
	});

	onDestroy(() => {
		observer?.disconnect();
		unsubscribe();
		
		// Only remove window event listeners in browser environment
		if (typeof window !== 'undefined') {
			window.removeEventListener('moonraker-file-deleted', handleFileDeleted);
		}
	});
</script>

<div class="print-list-page">
	<div class="page-header">
		<CurrentDirectory />
		<div class="actions">
			<button class="action-button" onclick={() => (showCreateFolderModal = true)} aria-label="Crea cartella">
				<svg viewBox="0 0 24 24" width="40" height="40"><path d={mdiFolderPlus} fill="#D72E28" /></svg>
			</button>
			<button class="action-button" onclick={() => fileInput.click()} aria-label="Upload file">
				<svg viewBox="0 0 24 24" width="40" height="40"><path d={mdiUpload} fill="#D72E28" /></svg>
			</button>
		</div>
		<input 
			type="file" 
			bind:this={fileInput} 
			accept=".gcode" 
			onchange={handleFileSelect} 
			style="display: none" 
		/>
	</div>

	{#if showCreateFolderModal}
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<div class="modal-overlay" role="dialog" tabindex="0" onclick={() => (showCreateFolderModal = false)} onkeydown={(e) => e.key === 'Escape' && (showCreateFolderModal = false)}>
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<div class="modal-content" role="document" tabindex="0" onclick={(e) => e.stopPropagation()}>
				<h3>Crea nuova cartella</h3>
				<input 
					type="text" 
					bind:value={folderName} 
					placeholder="Nome cartella" 
					class="folder-input"
					onkeydown={(e) => e.key === 'Enter' && handleCreateFolder()}
					autofocus
				/>
				<div class="modal-actions">
					<button class="modal-confirm" onclick={handleCreateFolder}>Crea</button>
					<button class="modal-cancel" onclick={() => (showCreateFolderModal = false)}>Annulla</button>
				</div>
			</div>
		</div>
	{/if}

	{#if loading}
		<div class="status-message">Loading...</div>
	{:else if error}
		<div class="status-message error">{error}</div>
	{:else if allItems.length === 0}
		<div class="status-message">No files found</div>
	{:else}
		<div class="grid">
			{#each visiblePrints() as item (item.id)}
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<div onclick={() => handleItemClick(item)} role="button" tabindex="0">
					<PrintCard {item} />
				</div>
			{/each}
		</div>

		{#if hasMore()}
			<div bind:this={sentinel} class="sentinel"></div>
		{/if}
	{/if}
</div>

<style>
	.print-list-page {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 12px;
	}

	.actions {
		display: flex;
		gap: 12px;
		align-items: center;
	}

	.action-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 4px;
		background: transparent;
		border: none;
		cursor: pointer;
		transition: opacity 0.2s;
	}

	.action-button:hover {
		opacity: 0.7;
	}

	.grid {
		display: flex;
		flex-wrap: wrap;
		gap: 24px;
		justify-content: center;
	}

	.status-message {
		text-align: center;
		padding: 48px 16px;
		font-size: 1.1rem;
		color: #888;
		font-family: 'Montserrat', sans-serif;
	}

	.status-message.error {
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
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
	}

	.modal-content h3 {
		margin: 0 0 16px 0;
		font-size: 1.1rem;
		font-weight: 700;
		color: #111;
	}

	.folder-input {
		width: 100%;
		padding: 12px;
		border: 1px solid #C8C8C8;
		border-radius: 8px;
		font-size: 0.9rem;
		margin-bottom: 16px;
		box-sizing: border-box;
	}

	.folder-input:focus {
		outline: none;
		border-color: #D72E28;
	}

	.modal-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}

	.modal-confirm {
		padding: 8px 20px;
		border: none;
		border-radius: 8px;
		background: #D72E28;
		color: white;
		cursor: pointer;
		font-size: 0.9rem;
		transition: background-color 0.15s;
	}

	.modal-confirm:hover {
		background: #B82520;
	}

	.modal-cancel {
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
