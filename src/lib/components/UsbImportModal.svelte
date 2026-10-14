<script lang="ts">
	import { tooltip } from '$lib/actions/tooltip';
	import {
		mdiChevronLeft,
		mdiChevronRight,
		mdiClose,
		mdiFileDocumentOutline,
		mdiFolder,
		mdiTrayArrowDown,
		mdiUsbFlashDrive
	} from '@mdi/js';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import { subscribeWhileVisible } from '$lib/services/panel-subscription.svelte';
	import { formatBytes } from '$lib/services/moonraker-statistics';
	import {
		describeUsbError,
		fetchUsbDirectory,
		importUsbFile,
		isFileExists
	} from '$lib/services/usb-api';
	import { ServiceError } from '$lib/services/g2-service';
	import { toastActions } from '$lib/stores/toastStore';
	import type { UsbDirectory, UsbFile, UsbImportResult, UsbOnConflict } from '$lib/types/usb';

	// Popup di import dalla chiavetta: si naviga fra le cartelle della chiavetta
	// e un tap su un file lo copia in `destDir`, la cartella che il file manager
	// sta mostrando. Il file finisce in `gcodes` e Moonraker lo indicizza da sé.
	let {
		isOpen,
		destDir,
		mounted,
		onImported,
		onClose
	}: {
		isOpen: boolean;
		/** Relativa a `gcodes`, `''` alla radice. */
		destDir: string;
		/** Dal polling del file manager: se cade a popup aperto, il popup si chiude. */
		mounted: boolean;
		onImported: (result: UsbImportResult) => void;
		onClose: () => void;
	} = $props();

	let usbPath = $state('');
	let listing = $state<UsbDirectory | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);
	/** Il file in copia: blocca tutto il resto del popup finché non finisce. */
	let importing = $state<string | null>(null);
	/** Il file che ha trovato un omonimo nella destinazione, in attesa di una scelta. */
	let conflict = $state<UsbFile | null>(null);
	/** Percorso (relativo a `gcodes`) del file in stampa, `''` se la macchina è ferma. */
	let printingFile = $state('');

	// Navigando in fretta le risposte possono arrivare fuori ordine: vale solo l'ultima.
	let loadToken = 0;

	type PrintStatsStatus = { print_stats?: { state?: string; filename?: string } };

	subscribeWhileVisible<PrintStatsStatus>(
		'usb-import',
		() => 'print_stats',
		(status) => {
			// Come in DashboardJobInfoCard: `filename` resta anche a stampa finita, è lo
			// stato a dire se il file è davvero in uso.
			const state = status.print_stats?.state ?? 'standby';
			const busy = state === 'printing' || state === 'paused';
			printingFile = busy ? (status.print_stats?.filename ?? '') : '';
		},
		() => isOpen
	);

	// A ogni apertura si riparte dalla radice: la chiavetta potrebbe essere un'altra.
	$effect(() => {
		if (isOpen) {
			usbPath = '';
			conflict = null;
			load('');
		}
	});

	$effect(() => {
		if (isOpen && !mounted && !importing) {
			toastActions.info('system', 'USB stick removed', 'The USB stick is no longer connected.');
			onClose();
		}
	});

	async function load(path: string) {
		const token = ++loadToken;
		loading = true;
		error = null;
		try {
			const result = await fetchUsbDirectory(path);
			if (token !== loadToken) return;
			listing = result;
			usbPath = result.path;
		} catch (e) {
			if (token !== loadToken) return;
			if (e instanceof ServiceError && e.code === 'USB_NOT_MOUNTED') {
				toastActions.info('system', 'USB stick removed', describeUsbError(e, ''));
				onClose();
				return;
			}
			listing = null;
			error = describeUsbError(e, 'The USB stick could not be read.');
		} finally {
			if (token === loadToken) loading = false;
		}
	}

	function join(dir: string, name: string): string {
		return dir ? `${dir}/${name}` : name;
	}

	function openDir(name: string) {
		load(join(usbPath, name));
	}

	function goUp() {
		const slash = usbPath.lastIndexOf('/');
		load(slash === -1 ? '' : usbPath.slice(0, slash));
	}

	async function runImport(file: UsbFile, onConflict: UsbOnConflict) {
		conflict = null;
		importing = file.name;
		try {
			const result = await importUsbFile(join(usbPath, file.name), destDir, onConflict);
			toastActions.success('system', 'File imported', `${result.filename} is ready to print.`);
			onImported(result);
			onClose();
		} catch (e) {
			if (isFileExists(e)) {
				conflict = file;
				return;
			}
			toastActions.error(
				'system',
				'Import failed',
				describeUsbError(e, 'The file was not imported.')
			);
		} finally {
			importing = null;
		}
	}

	function close() {
		// Una copia in corso non si interrompe chiudendo: si aspetta che finisca.
		if (!importing) onClose();
	}

	const title = $derived(usbPath ? usbPath.slice(usbPath.lastIndexOf('/') + 1) : 'USB stick');
	const destLabel = $derived(destDir ? destDir.slice(destDir.lastIndexOf('/') + 1) : 'Home');
	const isEmpty = $derived(!!listing && listing.dirs.length === 0 && listing.files.length === 0);
	const conflictIsPrinting = $derived(!!conflict && printingFile === join(destDir, conflict.name));
</script>

{#if isOpen}
	<!-- Una copia in corso non si interrompe: `close` aspetta che finisca. -->
	<Sheet label="Import from USB stick" onClose={close} size="md" panelClass="usb-panel">
		{#snippet header()}
			<div class="usb-header">
				{#if usbPath && !conflict}
					<button
						type="button"
						class="icon-button"
						onclick={goUp}
						disabled={!!importing}
						aria-label="Back"
						use:tooltip
					>
						<svg viewBox="0 0 24 24" width="28" height="28"><path d={mdiChevronLeft} /></svg>
					</button>
				{:else}
					<svg class="usb-icon" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
						<path d={mdiUsbFlashDrive} />
					</svg>
				{/if}
				<div class="usb-heading">
					<h3>{title}</h3>
					<span class="usb-dest">Imports into <strong>{destLabel}</strong></span>
				</div>
				<button
					type="button"
					class="icon-button"
					onclick={close}
					disabled={!!importing}
					aria-label="Close"
					use:tooltip
				>
					<svg viewBox="0 0 24 24" width="28" height="28"><path d={mdiClose} /></svg>
				</button>
			</div>
		{/snippet}

		{#if conflict}
			<div class="conflict">
				<p class="conflict-message">
					<strong>{conflict.name}</strong> already exists in {destLabel}.
				</p>
				{#if conflictIsPrinting}
					<p class="conflict-note">It is being printed right now, so it cannot be replaced.</p>
				{/if}
				<div class="conflict-actions">
					<button type="button" class="btn btn-secondary" onclick={() => (conflict = null)}>
						Cancel
					</button>
					<button
						type="button"
						class="btn btn-secondary"
						disabled={conflictIsPrinting}
						onclick={() => runImport(conflict!, 'overwrite')}
					>
						Overwrite
					</button>
					<button
						type="button"
						class="btn btn-primary"
						onclick={() => runImport(conflict!, 'rename')}
					>
						Keep both
					</button>
				</div>
			</div>
		{:else if loading && !listing}
			<div class="usb-status">Reading the USB stick…</div>
		{:else if error}
			<div class="usb-status error">
				<span>{error}</span>
				<button type="button" class="btn btn-secondary" onclick={() => load(usbPath)}>Retry</button>
			</div>
		{:else if isEmpty}
			<div class="usb-status">No printable files here</div>
		{:else if listing}
			<ul class="usb-list" class:dimmed={loading}>
				{#each listing.dirs as dir (`d:${dir.name}`)}
					<li>
						<button
							type="button"
							class="usb-row"
							onclick={() => openDir(dir.name)}
							disabled={!!importing || loading}
						>
							<svg
								class="row-icon folder"
								viewBox="0 0 24 24"
								width="28"
								height="28"
								aria-hidden="true"
							>
								<path d={mdiFolder} />
							</svg>
							<span class="row-name">{dir.name}</span>
							<svg class="row-trail" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
								<path d={mdiChevronRight} />
							</svg>
						</button>
					</li>
				{/each}
				{#each listing.files as file (`f:${file.name}`)}
					<li>
						<button
							type="button"
							class="usb-row"
							onclick={() => runImport(file, 'fail')}
							disabled={!!importing || loading}
						>
							<svg class="row-icon" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
								<path d={mdiFileDocumentOutline} />
							</svg>
							<span class="row-text">
								<span class="row-name">{file.name.replace(/\.gcode$/i, '')}</span>
								<span class="row-meta">
									{importing === file.name ? 'Importing…' : formatBytes(file.size)}
								</span>
							</span>
							{#if importing === file.name}
								<span class="spinner" aria-hidden="true"></span>
							{:else}
								<svg
									class="row-trail import"
									viewBox="0 0 24 24"
									width="24"
									height="24"
									aria-hidden="true"
								>
									<path d={mdiTrayArrowDown} />
								</svg>
							{/if}
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</Sheet>
{/if}

<style>
	.usb-header {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.usb-icon {
		fill: var(--color-red);
		flex-shrink: 0;
		padding: 8px;
	}

	.usb-heading {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.usb-heading h3 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--color-black);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.usb-dest {
		font-size: 0.8rem;
		color: var(--color-text-soft);
	}

	.icon-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 44px;
		min-height: 44px;
		border: none;
		background: transparent;
		border-radius: 8px;
		cursor: pointer;
		fill: var(--color-text-soft);
		flex-shrink: 0;
	}

	.icon-button:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.usb-list {
		list-style: none;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 4px;
		transition: opacity 0.15s;
	}

	.usb-list.dimmed {
		opacity: 0.5;
	}

	.usb-row {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		min-height: 56px;
		padding: 8px 12px;
		border: none;
		border-radius: 10px;
		background: var(--color-background);
		cursor: pointer;
		text-align: left;
		font: inherit;
		color: var(--color-black);
	}

	.usb-row:disabled {
		cursor: default;
	}

	.usb-row:not(:disabled):active {
		background: var(--color-gray);
	}

	.row-icon {
		fill: var(--color-text-soft);
		flex-shrink: 0;
	}

	.row-icon.folder {
		fill: var(--color-red);
	}

	.row-text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.row-name {
		flex: 1;
		min-width: 0;
		font-size: 0.95rem;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.row-meta {
		font-size: 0.8rem;
		color: var(--color-text-soft);
	}

	.row-trail {
		fill: var(--color-text-disabled);
		flex-shrink: 0;
	}

	.row-trail.import {
		fill: var(--color-red);
	}

	.spinner {
		width: 22px;
		height: 22px;
		border: 3px solid var(--color-gray);
		border-top-color: var(--color-red);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		flex-shrink: 0;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.usb-status {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 40px 16px;
		text-align: center;
		font-size: 1rem;
		color: var(--color-text-subtle);
	}

	.usb-status.error {
		color: var(--color-red);
	}

	.conflict {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 8px 4px;
	}

	.conflict-message {
		margin: 0;
		font-size: 0.95rem;
		color: var(--color-text-muted);
		overflow-wrap: anywhere;
	}

	.conflict-note {
		margin: 0;
		font-size: 0.85rem;
		color: var(--color-text-soft);
		background: var(--color-background);
		border-radius: 8px;
		padding: 10px 14px;
	}

	.conflict-actions {
		display: flex;
		gap: 8px;
	}

	.conflict-actions .btn {
		flex: 1;
		padding: 0 10px;
	}

	:global(.usb-panel) {
		height: min(640px, calc(100dvh - 48px));
	}
</style>
