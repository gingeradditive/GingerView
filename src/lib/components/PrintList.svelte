<script lang="ts">
	import { modal } from '$lib/actions/modal';
	import { tooltip } from '$lib/actions/tooltip';
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
	import { toastActions } from '$lib/stores/toastStore';
	import { activeContextMenuId } from '$lib/stores/contextMenuStore';

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

	// Ogni caricamento prende un numero: se nel frattempo ne è partito un altro
	// (cambio cartella, refresh da notifica) il suo risultato è vecchio e si scarta.
	// Dichiarato prima di `subscribe`, che chiama subito `loadDirectory()`: dopo,
	// la prima chiamata lo troverebbe non ancora inizializzato (ReferenceError).
	let loadSeq = 0;

	const unsubscribe = currentDirPath.subscribe((value) => {
		dirPath = value;
		loadDirectory();
	});

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

	const describeError = (e: unknown): string => (e instanceof Error ? e.message : 'Unknown error');

	// Un G-code di pellet pesa decine di MB: senza un segno il pulsante sembra
	// non aver fatto niente, e un secondo tocco ripartiva con un altro upload.
	let uploading = $state(false);
	let creatingFolder = $state(false);

	async function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];

		if (file && file.name.toLowerCase().endsWith('.gcode')) {
			uploading = true;
			try {
				await uploadFile(file, dirPath ? `gcodes/${dirPath}` : 'gcodes');
				toastActions.info('moonraker', 'Upload complete', file.name);
				await loadDirectory({ quiet: true });
			} catch (e) {
				console.error('Upload failed:', e);
				toastActions.error('moonraker', 'Upload failed', describeError(e));
			} finally {
				uploading = false;
			}
		} else if (file) {
			toastActions.warning('moonraker', 'Not a G-code file', 'Choose a .gcode file to upload.');
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
		if (!folderName.trim() || creatingFolder) return;

		creatingFolder = true;
		try {
			const fullPath = dirPath ? `gcodes/${dirPath}/${folderName}` : `gcodes/${folderName}`;
			await createDirectory(fullPath);
			showCreateFolderModal = false;
			folderName = '';
			await loadDirectory();
		} catch (e) {
			console.error('Create folder failed:', e);
			toastActions.error('moonraker', 'Create folder failed', describeError(e));
		} finally {
			creatingFolder = false;
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

	// Tasto destro su un punto vuoto della pagina: le stesse azioni dei pulsanti in alto
	// (upload, nuova cartella, USB), come in un file manager. Sulle card c'è già il loro
	// menu, sui pulsanti e sui campi resta quello del browser.
	const BACKGROUND_MENU_ID = 'filelist-background';
	const BG_MENU_WIDTH = 200;
	const BG_MENU_ITEM_HEIGHT = 44;
	let backgroundMenu = $state<{ x: number; y: number } | null>(null);

	function handleBackgroundContextMenu(event: MouseEvent) {
		if (event.defaultPrevented) return; // una card ha già aperto il suo menu
		const target = event.target as HTMLElement | null;
		if (target?.closest('button, a, input, textarea, select, [role="menu"]')) return;
		event.preventDefault();
		// Sui monitor grandi la pagina è zoomata (app.css), come in PrintCard.
		const zoom =
			(document.documentElement as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom ?? 1;
		const items = usbMounted ? 3 : 2;
		const maxX = window.innerWidth / zoom - BG_MENU_WIDTH - 8;
		const maxY = window.innerHeight / zoom - items * BG_MENU_ITEM_HEIGHT - 16;
		backgroundMenu = {
			x: Math.max(8, Math.min(event.clientX / zoom, maxX)),
			y: Math.max(8, Math.min(event.clientY / zoom, maxY))
		};
		// Chiude il menu di una card eventualmente aperto.
		activeContextMenuId.set(BACKGROUND_MENU_ID);
	}

	function closeBackgroundMenu() {
		if (!backgroundMenu) return;
		backgroundMenu = null;
		if ($activeContextMenuId === BACKGROUND_MENU_ID) activeContextMenuId.set(null);
	}

	// Un'altra card apre il suo menu: questo si chiude.
	$effect(() => {
		if ($activeContextMenuId !== BACKGROUND_MENU_ID) backgroundMenu = null;
	});

	function backgroundAction(action: () => void) {
		closeBackgroundMenu();
		action();
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

<svelte:window
	onclick={closeBackgroundMenu}
	onkeydown={(e) => e.key === 'Escape' && closeBackgroundMenu()}
	onscroll={closeBackgroundMenu}
/>

<div class="print-list-page" oncontextmenu={handleBackgroundContextMenu} role="presentation">
	<div class="page-header">
		<CurrentDirectory />
		<div class="actions">
			{#if usbMounted}
				<button
					class="action-button usb-button"
					onclick={() => (showUsbModal = true)}
					aria-label="Import from USB stick"
					use:tooltip
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
				use:tooltip
			>
				<svg viewBox="0 0 24 24" width="40" height="40"
					><path d={mdiFolderPlus} fill="#D72E28" /></svg
				>
			</button>
			<button
				class="action-button"
				class:busy={uploading}
				onclick={() => fileInput.click()}
				aria-label={uploading ? 'Uploading…' : 'Upload file'}
				use:tooltip
				aria-busy={uploading}
				disabled={uploading}
			>
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
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="modal-overlay"
			role="dialog"
			tabindex="0"
			onclick={(e) => e.target === e.currentTarget && (showCreateFolderModal = false)}
			use:modal={{ onClose: () => (showCreateFolderModal = false) }}
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
					<button class="modal-confirm" onclick={handleCreateFolder} disabled={creatingFolder}
						>{creatingFolder ? 'Creating…' : 'Create'}</button
					>
					<button class="modal-cancel" onclick={() => (showCreateFolderModal = false)}
						>Cancel</button
					>
				</div>
			</div>
		</div>
	{/if}

	{#if loading}
		<div class="status-message">Loading…</div>
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

{#if backgroundMenu}
	<div
		class="context-menu"
		role="menu"
		aria-label="Files"
		style="left: {backgroundMenu.x}px; top: {backgroundMenu.y}px;"
	>
		<button
			class="context-menu-item"
			role="menuitem"
			disabled={uploading}
			onclick={() => backgroundAction(() => fileInput.click())}
		>
			<svg viewBox="0 0 24 24" aria-hidden="true"><path d={mdiUpload} /></svg>
			Upload file
		</button>
		<button
			class="context-menu-item"
			role="menuitem"
			onclick={() => backgroundAction(() => (showCreateFolderModal = true))}
		>
			<svg viewBox="0 0 24 24" aria-hidden="true"><path d={mdiFolderPlus} /></svg>
			New folder
		</button>
		{#if usbMounted}
			<button
				class="context-menu-item"
				role="menuitem"
				onclick={() => backgroundAction(() => (showUsbModal = true))}
			>
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d={mdiUsbFlashDrive} /></svg>
				Import from USB
			</button>
		{/if}
	</div>
{/if}

<style>
	/* Riempie tutta l'area della pagina, così il tasto destro funziona anche sotto
	   all'ultima card, non solo dove c'è contenuto. */
	.print-list-page {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	/* Menu del tasto destro sullo sfondo: stessa forma di quello delle card (PrintCard). */
	.context-menu {
		position: fixed;
		z-index: 1000;
		min-width: 180px;
		max-width: 220px;
		padding: 4px 0;
		background: var(--color-white);
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(var(--rgb-black), 0.15);
	}

	.context-menu-item {
		width: 100%;
		min-height: 44px;
		padding: 8px 16px;
		display: flex;
		align-items: center;
		gap: 10px;
		background: none;
		border: none;
		text-align: left;
		cursor: pointer;
		font-size: 0.9rem;
		color: var(--color-black);
		transition: background-color 0.2s;
	}

	.context-menu-item:hover:not(:disabled) {
		background-color: var(--color-background);
	}

	.context-menu-item:disabled {
		cursor: default;
		opacity: 0.5;
	}

	.context-menu-item svg {
		width: 20px;
		height: 20px;
		fill: var(--color-red);
		flex-shrink: 0;
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

	.action-button:disabled {
		cursor: default;
	}

	/* Upload in corso: la freccia pulsa finché Moonraker non ha il file. */
	.action-button.busy svg {
		animation: upload-pulse 1s ease-in-out infinite;
	}

	@keyframes upload-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.35;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.action-button.busy svg {
			animation: none;
			opacity: 0.5;
		}
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
		font-family: var(--font-sans);
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
		font-family: var(--font-sans);
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
