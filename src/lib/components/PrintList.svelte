<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import PrintCard from './PrintCard.svelte';
	import PrintDetailsPopup from './PrintDetailsPopup.svelte';
	import CurrentDirectory from './CurrentDirectory.svelte';
	import UsbImportModal from './UsbImportModal.svelte';
	import type { PrintItem } from '$lib/types/print';
	import { mdiFolderPlus, mdiUpload, mdiUsbFlashDrive } from '@mdi/js';
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
	import { fetchUsbStatus } from '$lib/services/usb-api';
	import { gcodesChanged } from '$lib/services/moonraker-notifier';

	const PAGE_SIZE = 20;
	// G2-Service non ha un canale push: la presenza della chiavetta si chiede a intervalli.
	const USB_POLL_MS = 3000;

	let fileInput: HTMLInputElement;
	let allItems: PrintItem[] = $state([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let dirPath = $state('');
	let showCreateFolderModal = $state(false);
	let folderName = $state('');
	let visibleCount = PAGE_SIZE;
	let showPrintDetailsModal = $state(false);
	let selectedPrint = $state<PrintItem | null>(null);
	let usbMounted = $state(false);
	let showUsbModal = $state(false);
	let usbPollTimer: ReturnType<typeof setInterval> | undefined;

	const unsubscribe = currentDirPath.subscribe((value) => {
		dirPath = value;
		loadDirectory();
	});

	// Ogni caricamento prende un numero: se nel frattempo ne è partito un altro
	// (cambio cartella, refresh da notifica) il suo risultato è vecchio e si scarta.
	let loadSeq = 0;

	// `quiet`: aggiorna la lista senza svuotarla né mostrare il caricamento, per i
	// refresh in background (file arrivato da GingerSlicer) mentre la si guarda.
	async function loadDirectory({ quiet = false }: { quiet?: boolean } = {}) {
		const seq = ++loadSeq;
		if (!quiet) {
			loading = true;
			error = null;
			allItems = [];
			visibleCount = PAGE_SIZE;
		}

		try {
			const moonrakerPath = dirPath ? `gcodes/${dirPath}` : 'gcodes';
			const result = await fetchDirectory(moonrakerPath);

			const dirItems: PrintItem[] = result.dirs
				// `media` è il vecchio symlink alla chiavetta delle immagini G2-OS precedenti: la
				// chiavetta ora si usa dal pulsante USB, non come cartella.
				.filter((d) => !d.dirname.startsWith('.') && !(dirPath === '' && d.dirname === 'media'))
				.map((d) => ({
					id: `dir-${d.dirname}`,
					name: d.dirname,
					material: '',
					duration: '',
					filamentName: '',
					filamentType: '',
					filamentWeight: undefined,
					nozzleDiameter: undefined,
					lastPrintDuration: undefined,
					printTime: undefined,
					filename: d.dirname,
					filepath: dirPath ? `${dirPath}/${d.dirname}` : d.dirname,
					modified: d.modified,
					size: d.size,
					isDirectory: true
				}));

			// Fetch metadata for all files to get filament information and thumbnails
			const fileMetadataPromises = result.files.map(async (f) => {
				try {
					const metadata = await getFileMetadata(
						f.filename,
						dirPath ? `gcodes/${dirPath}` : 'gcodes'
					);

					// Try to get thumbnail from multiple sources
					let thumbnailUrl = getThumbnailUrl(f, dirPath ? `gcodes/${dirPath}` : 'gcodes');

					// If no thumbnail from Moonraker, try to extract from G-code
					if (!thumbnailUrl) {
						const extractedThumbnail = await extractThumbnailFromGcode(
							f.filename,
							dirPath ? `gcodes/${dirPath}` : 'gcodes'
						);
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
						filamentName: metadata.filament_name,
						filamentType: metadata.filament_type ?? getFilamentType(metadata),
						filamentWeight: metadata.filament_weight_total,
						nozzleDiameter: metadata.nozzle_diameter,
						lastPrintDuration: metadata.last_print_duration,
						printTime: metadata.print_time ?? metadata.estimated_time,
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
						const extractedThumbnail = await extractThumbnailFromGcode(
							f.filename,
							dirPath ? `gcodes/${dirPath}` : 'gcodes'
						);
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
						filamentName: '',
						filamentType: f.slicer ?? '',
						filamentWeight: undefined,
						nozzleDiameter: undefined,
						lastPrintDuration: f.last_print_duration,
						printTime: f.print_time ?? f.estimated_time,
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

			if (seq !== loadSeq) return;
			allItems = [...dirItems, ...fileItems];
			error = null;
		} catch (e) {
			if (seq !== loadSeq) return;
			// Un refresh silenzioso fallito lascia la lista che c'era.
			if (!quiet) error = e instanceof Error ? e.message : 'Failed to load files';
			console.error('Error loading directory:', e);
		} finally {
			if (seq === loadSeq) loading = false;
		}
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
			alert('Please select a .gcode file');
		}
		// Reset input so re-selecting same file triggers change
		if (target) target.value = '';
	}

	function handleItemClick(item: PrintItem) {
		if (item.isDirectory) {
			navigateToDir(item.filename);
			return;
		}

		selectedPrint = item;
		showPrintDetailsModal = true;
	}

	function closePrintDetailsModal() {
		showPrintDetailsModal = false;
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

	let sentinel = $state<HTMLElement | undefined>();

	function loadMore() {
		if (hasMore()) {
			visibleCount = Math.min(visibleCount + PAGE_SIZE, allItems.length);
		}
	}

	// Il sentinel esiste solo quando ci sono altri elementi da caricare: va osservato
	// ogni volta che compare, non una sola volta al mount.
	$effect(() => {
		const node = sentinel;
		if (!node) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) loadMore();
			},
			{ rootMargin: '200px' }
		);
		observer.observe(node);

		return () => observer.disconnect();
	});

	function focusOnMount(node: HTMLInputElement) {
		node.focus();
	}

	function handleFileDeleted() {
		loadDirectory();
	}

	// Moonraker avvisa a ogni modifica in gcodes, anche quelle fatte da qui (che
	// ricaricano già da sole): si ricarica solo se tocca la cartella aperta, e una
	// volta sola per raffica (l'upload di GingerSlicer ne manda più d'una).
	const GCODES_REFRESH_DEBOUNCE_MS = 500;
	let gcodesRefreshTimer: ReturnType<typeof setTimeout> | undefined;

	const unsubscribeGcodes = gcodesChanged.subscribe((change) => {
		if (!change) return;
		if (change.dirs && !change.dirs.includes(dirPath)) return;
		clearTimeout(gcodesRefreshTimer);
		gcodesRefreshTimer = setTimeout(
			() => loadDirectory({ quiet: true }),
			GCODES_REFRESH_DEBOUNCE_MS
		);
	});

	async function pollUsb() {
		try {
			usbMounted = (await fetchUsbStatus()).mounted;
		} catch {
			// Servizio giù o immagine senza l'endpoint: niente pulsante, e niente toast a ogni giro.
			usbMounted = false;
		}
	}

	onMount(() => {
		pollUsb();
		usbPollTimer = setInterval(pollUsb, USB_POLL_MS);

		// Only add window event listeners in browser environment
		if (typeof window !== 'undefined') {
			window.addEventListener('moonraker-file-deleted', handleFileDeleted);
		}
	});

	onDestroy(() => {
		unsubscribe();
		unsubscribeGcodes();
		clearTimeout(gcodesRefreshTimer);
		clearInterval(usbPollTimer);

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
			{#if usbMounted}
				<button
					class="action-button usb-button"
					onclick={() => (showUsbModal = true)}
					aria-label="Import from USB stick"
				>
					<svg viewBox="0 0 24 24" width="40" height="40"
						><path d={mdiUsbFlashDrive} fill="#D72E28" /></svg
					>
				</button>
			{/if}
			<button
				class="action-button"
				onclick={() => (showCreateFolderModal = true)}
				aria-label="Create folder"
			>
				<svg viewBox="0 0 24 24" width="40" height="40"
					><path d={mdiFolderPlus} fill="#D72E28" /></svg
				>
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
		<div
			class="modal-overlay"
			role="dialog"
			tabindex="0"
			onclick={(e) => e.target === e.currentTarget && (showCreateFolderModal = false)}
			onkeydown={(e) => e.key === 'Escape' && (showCreateFolderModal = false)}
		>
			<div class="modal-content">
				<h3>Create new folder</h3>
				<input
					type="text"
					bind:value={folderName}
					placeholder="Folder name"
					class="folder-input"
					onkeydown={(e) => e.key === 'Enter' && handleCreateFolder()}
					use:focusOnMount
				/>
				<div class="modal-actions">
					<button class="modal-confirm" onclick={handleCreateFolder}>Create</button>
					<button class="modal-cancel" onclick={() => (showCreateFolderModal = false)}
						>Cancel</button
					>
				</div>
			</div>
		</div>
	{/if}

	{#if loading}
		<div class="status-message">Loading...</div>
	{:else if error}
		<div class="status-message error">{error}</div>
	{:else if allItems.length === 0}
		<div class="empty-state">
			{#if !dirPath}
				<span class="empty-title">Nothing to print… yet!</span>
				<span class="empty-sub">
					{usbMounted
						? 'Upload a G-code or import one from your USB stick'
						: 'Upload a G-code to get started'}
				</span>
			{:else}
				<span class="empty-title">This folder is empty</span>
				<span class="empty-sub">Feed me some G-code!</span>
			{/if}
		</div>
	{:else}
		<div class="grid">
			{#each visiblePrints() as item (item.id)}
				<div
					onclick={() => handleItemClick(item)}
					onkeydown={(e) =>
						(e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), handleItemClick(item))}
					role="button"
					tabindex="0"
				>
					<PrintCard {item} />
				</div>
			{/each}
		</div>

		{#if hasMore()}
			<div bind:this={sentinel} class="sentinel"></div>
		{/if}
	{/if}

	<UsbImportModal
		isOpen={showUsbModal}
		destDir={dirPath}
		mounted={usbMounted}
		onImported={() => loadDirectory()}
		onClose={() => (showUsbModal = false)}
	/>

	<PrintDetailsPopup
		item={selectedPrint}
		isOpen={showPrintDetailsModal}
		onClose={closePrintDetailsModal}
	/>
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
	}

	/* Colonne quante ne stanno, card che si allargano a riempire la riga e ultima riga allineata
	   alle altre. Due colonne anche sul telefono più stretto (360px). */
	.grid {
		--card-min: 260px;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(var(--card-min), 100%), 1fr));
		gap: 24px;
	}

	@media (max-width: 767.98px) {
		.grid {
			--card-min: 140px;
			gap: 16px 12px;
		}
	}

	.status-message {
		text-align: center;
		padding: 48px 16px;
		font-size: 1.1rem;
		color: var(--color-text-subtle);
		font-family: 'Montserrat', sans-serif;
	}

	.status-message.error {
		color: var(--color-red);
	}

	/* Stesso tono dei pannelli della dashboard a riposo ("Ready to Print!", "Let me extrude!"). */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		/* Lo spazio sotto l'intestazione, così le scritte stanno a metà schermo. */
		min-height: 60vh;
		padding: 0 16px;
		text-align: center;
		font-family: 'Montserrat', sans-serif;
	}

	.empty-title {
		font-size: min(2rem, 8vw);
		font-weight: 600;
		line-height: 1.1;
		color: var(--color-text-secondary);
	}

	.empty-sub {
		font-size: min(1.2rem, 5vw);
		color: var(--color-white);
	}

	.usb-button {
		animation: usb-in 0.25s ease-out;
	}

	@keyframes usb-in {
		from {
			opacity: 0;
			transform: scale(0.6);
		}
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
		width: min(400px, calc(100% - 32px));
		box-sizing: border-box;
		box-shadow: var(--shadow-panel);
	}

	.modal-content h3 {
		margin: 0 0 16px 0;
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--color-black);
	}

	.folder-input {
		width: 100%;
		padding: 12px;
		border: 1px solid var(--color-gray);
		border-radius: 8px;
		font-size: 0.9rem;
		margin-bottom: 16px;
		box-sizing: border-box;
	}

	.folder-input:focus {
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
	}

	.modal-cancel {
		min-height: 44px;
		padding: 8px 20px;
		border: 1px solid var(--color-gray);
		border-radius: 8px;
		background: var(--color-white);
		cursor: pointer;
		font-size: 0.9rem;
		color: var(--color-text-soft);
	}
</style>
