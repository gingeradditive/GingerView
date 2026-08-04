<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Download,
		FilePlus,
		FolderPlus,
		LoaderCircle,
		RefreshCw,
		RotateCcw,
		Save,
		TriangleAlert,
		Upload
	} from 'lucide-svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import ConfigFileTree from '$lib/components/ConfigFileTree.svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import PromptModal from '$lib/components/PromptModal.svelte';
	import {
		CONFIG_EDITOR_ENABLED,
		CONFIG_ROOT,
		downloadConfigFile,
		fetchConfigDirectory,
		findTreeNode,
		isEditableConfigFile,
		readConfigFile,
		suggestedRestartFor,
		toTreeNodes,
		validateEntryName,
		writeConfigFile,
		type ConfigTreeNode
	} from '$lib/services/moonraker-config';
	import {
		RESTART_TARGETS,
		fetchPrinterInfo,
		fetchPrintState,
		requestRestart,
		waitForKlipperReady,
		type RestartTarget
	} from '$lib/services/moonraker-printer';
	import {
		createDirectory,
		deleteDirectory,
		deleteFile,
		moveFile
	} from '$lib/services/moonraker-files';
	import { toastActions } from '$lib/stores/toastStore';

	const printerInfoPollMs = 5000;
	/** Past this the editor stops being pleasant; download the file instead. */
	const maxEditableBytes = 1024 * 1024;

	let tree = $state<ConfigTreeNode[]>([]);
	let writable = $state(true);
	let isLoading = $state(true);
	let loadError = $state('');
	let loadingPath = $state('');

	/** Where new files, new folders and uploads land. */
	let activeDir = $state(CONFIG_ROOT);
	let selectedPath = $state('');
	let content = $state('');
	let savedContent = $state('');
	let isOpening = $state(false);
	let isSaving = $state(false);

	let restartTarget = $state<RestartTarget>('firmware');
	let isRestarting = $state(false);
	let printerState = $state('');
	let printState = $state('');
	/** Restart the last save asks for, shown as a banner until acted on. */
	let pendingRestart = $state<RestartTarget | null>(null);

	let fileInput = $state<HTMLInputElement | null>(null);

	let promptState = $state<{
		title: string;
		label: string;
		value: string;
		placeholder: string;
		confirmLabel: string;
		run: (value: string) => void;
	} | null>(null);

	let confirmState = $state<{
		title: string;
		message: string;
		details: string;
		confirmLabel: string;
		run: () => void;
	} | null>(null);

	let isDirty = $derived(selectedPath !== '' && content !== savedContent);
	let lineCount = $derived(content === '' ? 0 : content.split('\n').length);
	let statePill = $derived(
		printerState === 'ready'
			? { text: 'Klipper ready', tone: 'ok' }
			: printerState === ''
				? { text: 'Klipper unreachable', tone: 'problem' }
				: {
						text: `Klipper ${printerState}`,
						tone: printerState === 'startup' ? 'pending' : 'problem'
					}
	);
	let busy = $derived(isSaving || isRestarting || isOpening);
	/**
	 * A restart mid-print aborts the job, and nothing upstream stops it: Klipper
	 * accepts `FIRMWARE_RESTART` while printing. Same guard the update page uses.
	 */
	let restartBlockedReason = $derived(
		printState === 'printing'
			? 'A print is running. Restarting would abort it, so restarts are disabled.'
			: printState === 'paused'
				? 'A print is paused. Finish or cancel it before restarting.'
				: ''
	);
	let restartDisabled = $derived(isRestarting || restartBlockedReason !== '');

	onMount(() => {
		if (!CONFIG_EDITOR_ENABLED) return;

		loadRoot();
		updatePrinterState();
		const timer = window.setInterval(updatePrinterState, printerInfoPollMs);

		window.addEventListener('keydown', handleGlobalKeydown);
		return () => {
			window.clearInterval(timer);
			window.removeEventListener('keydown', handleGlobalKeydown);
		};
	});

	async function updatePrinterState() {
		// Mid-restart the request fails by design, and the pill already says so;
		// a failed poll simply reports "unreachable" rather than clearing the page.
		const info = await fetchPrinterInfo();
		printerState = info?.state ?? '';
		printState = await fetchPrintState();
	}

	async function loadRoot() {
		isLoading = true;
		loadError = '';
		try {
			const dir = await fetchConfigDirectory(CONFIG_ROOT);
			tree = toTreeNodes(dir.entries);
			writable = dir.writable;
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Failed to list config files';
		} finally {
			isLoading = false;
		}
	}

	async function toggleFolder(node: ConfigTreeNode) {
		activeDir = node.entry.path;

		if (node.expanded) {
			node.expanded = false;
			return;
		}
		if (node.children === null) {
			await loadChildren(node);
		}
		node.expanded = true;
	}

	async function loadChildren(node: ConfigTreeNode) {
		loadingPath = node.entry.path;
		try {
			const dir = await fetchConfigDirectory(node.entry.path);
			node.children = toTreeNodes(dir.entries);
		} catch {
			// Toast already raised by fetchConfigDirectory; leave the folder unopened.
			node.children = null;
		} finally {
			loadingPath = '';
		}
	}

	/** Re-reads a folder after a change. `config` itself means the whole tree. */
	async function refreshDir(path: string) {
		if (path === CONFIG_ROOT) {
			const dir = await fetchConfigDirectory(CONFIG_ROOT);
			tree = toTreeNodes(dir.entries);
			writable = dir.writable;
			return;
		}
		const node = findTreeNode(tree, path);
		if (!node) {
			await refreshDir(CONFIG_ROOT);
			return;
		}
		await loadChildren(node);
		node.expanded = true;
	}

	function parentOf(path: string): string {
		const slash = path.lastIndexOf('/');
		return slash <= 0 ? CONFIG_ROOT : path.slice(0, slash);
	}

	/** Runs `action`, asking first when the open file has unsaved edits. */
	function guardUnsaved(action: () => void) {
		if (!isDirty) {
			action();
			return;
		}
		confirmState = {
			title: 'Discard changes?',
			message: `${selectedPath.slice(selectedPath.lastIndexOf('/') + 1)} has unsaved changes.`,
			details: 'The edits made since the last save are lost.',
			confirmLabel: 'Discard',
			run: action
		};
	}

	function selectFile(node: ConfigTreeNode) {
		guardUnsaved(() => openFile(node.entry.path, node.entry.size));
	}

	async function openFile(path: string, size: number) {
		const name = path.slice(path.lastIndexOf('/') + 1);
		if (!isEditableConfigFile(name)) {
			toastActions.warning(
				'moonraker',
				'Not a text file',
				`${name} cannot be edited here. Download it instead.`
			);
			return;
		}
		if (size > maxEditableBytes) {
			toastActions.warning(
				'moonraker',
				'File too large',
				`${name} is larger than 1 MB. Download it instead of editing it here.`
			);
			return;
		}

		isOpening = true;
		try {
			const text = await readConfigFile(path);
			selectedPath = path;
			activeDir = parentOf(path);
			content = text;
			savedContent = text;
			pendingRestart = null;
		} catch {
			// Toast already raised by readConfigFile.
		} finally {
			isOpening = false;
		}
	}

	async function save(): Promise<boolean> {
		if (!selectedPath || isSaving) return false;
		isSaving = true;
		try {
			await writeConfigFile(selectedPath, content);
			savedContent = content;
			toastActions.success(
				'moonraker',
				'Saved',
				selectedPath.slice(selectedPath.lastIndexOf('/') + 1)
			);
			// The suggestion, not the action: a config change only takes effect on
			// restart, but deciding when to restart is the operator's.
			pendingRestart = suggestedRestartFor(selectedPath);
			return true;
		} catch {
			return false;
		} finally {
			isSaving = false;
		}
	}

	async function saveAndRestart() {
		const target = suggestedRestartFor(selectedPath) ?? restartTarget;
		if (await save()) await runRestart(target);
	}

	async function runRestart(target: RestartTarget) {
		if (restartDisabled) return;
		const { label } = RESTART_TARGETS[target];

		isRestarting = true;
		pendingRestart = null;
		printerState = 'startup';
		toastActions.info('klipper', label, 'Restart requested, waiting for the printer…');

		try {
			await requestRestart(target);
			const info = await waitForKlipperReady();

			if (!info) {
				toastActions.error(
					'klipper',
					label,
					'The printer did not answer after the restart. Check the console.'
				);
			} else if (info.state === 'ready') {
				toastActions.success('klipper', label, 'The printer is ready again');
			} else {
				// This is where a broken config surfaces: Klippy comes back in `error`
				// with the parse failure in `state_message`.
				toastActions.error(
					'klipper',
					`${label} — ${info.state}`,
					info.stateMessage || 'The printer did not come back ready',
					12000
				);
			}
			printerState = info?.state ?? '';
		} finally {
			isRestarting = false;
		}
	}

	function confirmRestart(target: RestartTarget) {
		if (restartDisabled) return;
		const { label, description } = RESTART_TARGETS[target];
		confirmState = {
			title: label,
			message: description,
			details: 'The printer is unavailable for a few seconds while it comes back up.',
			confirmLabel: label,
			run: () => runRestart(target)
		};
	}

	function promptNewFile() {
		promptState = {
			title: 'New file',
			label: `Created in ${activeDir}`,
			value: '',
			placeholder: 'macros.cfg',
			confirmLabel: 'Create',
			run: async (name) => {
				const path = `${activeDir}/${name}`;
				try {
					await writeConfigFile(path, '');
					await refreshDir(activeDir);
					await openFile(path, 0);
				} catch {
					// Toast already raised by writeConfigFile.
				}
			}
		};
	}

	function promptNewFolder() {
		promptState = {
			title: 'New folder',
			label: `Created in ${activeDir}`,
			value: '',
			placeholder: 'macros',
			confirmLabel: 'Create',
			run: async (name) => {
				try {
					await createDirectory(`${activeDir}/${name}`);
					await refreshDir(activeDir);
				} catch {
					// Toast already raised by createDirectory.
				}
			}
		};
	}

	function promptRename(node: ConfigTreeNode) {
		const { path, name, isDirectory } = node.entry;
		promptState = {
			title: isDirectory ? 'Rename folder' : 'Rename file',
			label: 'New name',
			value: name,
			placeholder: name,
			confirmLabel: 'Rename',
			run: async (newName) => {
				if (newName === name) return;
				const dest = `${parentOf(path)}/${newName}`;
				try {
					// Renaming is moving to a different name in the same folder, as far
					// as Moonraker is concerned.
					await moveFile(path, dest);
					await refreshDir(parentOf(path));
					if (selectedPath === path) selectedPath = dest;
				} catch {
					// Toast already raised by moveFile.
				}
			}
		};
	}

	function promptDelete(node: ConfigTreeNode) {
		const { path, name, isDirectory } = node.entry;
		confirmState = {
			title: isDirectory ? 'Delete folder' : 'Delete file',
			message: `Delete ${name}?`,
			details: isDirectory
				? 'The folder and everything inside it are removed from the printer.'
				: 'The file is removed from the printer. This cannot be undone.',
			confirmLabel: 'Delete',
			run: async () => {
				try {
					if (isDirectory) {
						await deleteDirectory(path);
					} else {
						await deleteFile(path);
					}
					if (selectedPath === path || selectedPath.startsWith(`${path}/`)) closeFile();
					await refreshDir(parentOf(path));
				} catch {
					// Toast already raised by the delete helpers.
				}
			}
		};
	}

	function closeFile() {
		selectedPath = '';
		content = '';
		savedContent = '';
		pendingRestart = null;
	}

	async function handleUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;

		try {
			await writeConfigFile(`${activeDir}/${file.name}`, await file.text());
			toastActions.success('moonraker', 'Uploaded', file.name);
			await refreshDir(activeDir);
		} catch {
			// Toast already raised by writeConfigFile.
		}
	}

	function handleGlobalKeydown(event: KeyboardEvent) {
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
			event.preventDefault();
			if (writable && isDirty) save();
		}
	}

	function runPrompt(value: string) {
		const pending = promptState;
		promptState = null;
		pending?.run(value);
	}

	function runConfirm() {
		const pending = confirmState;
		confirmState = null;
		pending?.run();
	}
</script>

<section class="config-page">
	<div class="config-card">
		<header class="config-header">
			<h1>Config editor</h1>
			<span class="dev-badge">Development</span>
			<span class="status-pill {statePill.tone}">
				<span class="dot"></span>
				{statePill.text}
			</span>
		</header>

		{#if !CONFIG_EDITOR_ENABLED}
			<p class="placeholder">
				The config editor is disabled on this machine. Edit the printer configuration over SSH.
			</p>
		{:else}
			<div class="toolbar">
				<button type="button" class="ghost-btn" onclick={loadRoot} disabled={isLoading || busy}>
					{#if isLoading}
						<LoaderCircle class="spin" size={16} />
					{:else}
						<RefreshCw size={16} />
					{/if}
					Reload
				</button>
				{#if writable}
					<button type="button" class="ghost-btn" onclick={promptNewFile} disabled={busy}>
						<FilePlus size={16} />
						New file
					</button>
					<button type="button" class="ghost-btn" onclick={promptNewFolder} disabled={busy}>
						<FolderPlus size={16} />
						New folder
					</button>
					<button
						type="button"
						class="ghost-btn"
						onclick={() => fileInput?.click()}
						disabled={busy}
					>
						<Upload size={16} />
						Upload
					</button>
				{/if}

				<span class="toolbar-spacer"></span>

				<select class="restart-select" bind:value={restartTarget} disabled={restartDisabled}>
					{#each Object.entries(RESTART_TARGETS) as [key, info] (key)}
						<option value={key}>{info.label}</option>
					{/each}
				</select>
				<button
					type="button"
					class="restart-btn"
					onclick={() => confirmRestart(restartTarget)}
					disabled={restartDisabled}
					title={restartBlockedReason || RESTART_TARGETS[restartTarget].description}
				>
					{#if isRestarting}
						<LoaderCircle class="spin" size={16} />
					{:else}
						<RotateCcw size={16} />
					{/if}
					Restart
				</button>
			</div>

			{#if restartBlockedReason}
				<div class="banner warn">
					<TriangleAlert size={18} />
					<span>{restartBlockedReason}</span>
				</div>
			{/if}

			{#if !writable}
				<div class="banner warn">
					<TriangleAlert size={18} />
					<span>
						Moonraker serves the config folder read-only. Files can be opened and downloaded but not
						saved.
					</span>
				</div>
			{/if}

			{#if pendingRestart}
				<div class="banner suggest">
					<TriangleAlert size={18} />
					<span>
						Saved. The change takes effect after a {RESTART_TARGETS[
							pendingRestart
						].label.toLowerCase()}.
					</span>
					<button
						type="button"
						class="banner-btn"
						onclick={() => pendingRestart && confirmRestart(pendingRestart)}
						disabled={restartDisabled}
					>
						{RESTART_TARGETS[pendingRestart].label}
					</button>
					<button type="button" class="banner-dismiss" onclick={() => (pendingRestart = null)}>
						Later
					</button>
				</div>
			{/if}

			<div class="split">
				<aside class="tree-pane">
					<div class="pane-head">
						<span class="pane-title">{CONFIG_ROOT}</span>
					</div>
					<div class="tree-scroll">
						{#if isLoading}
							<p class="placeholder">Loading config files…</p>
						{:else if loadError}
							<div class="load-error">
								<p>{loadError}</p>
								<button type="button" class="ghost-btn" onclick={loadRoot}>Retry</button>
							</div>
						{:else if tree.length === 0}
							<p class="placeholder">The config folder is empty.</p>
						{:else}
							<ConfigFileTree
								nodes={tree}
								{selectedPath}
								{loadingPath}
								readOnly={!writable}
								onSelect={selectFile}
								onToggle={toggleFolder}
								onRename={promptRename}
								onDelete={promptDelete}
							/>
						{/if}
					</div>
				</aside>

				<div class="editor-pane">
					{#if !selectedPath}
						<p class="placeholder">Pick a file on the left to edit it.</p>
					{:else}
						<div class="pane-head">
							<span class="file-path" title={selectedPath}>
								{selectedPath}
								{#if isDirty}<span class="dirty" title="Unsaved changes">●</span>{/if}
							</span>
							<span class="line-count">{lineCount} lines</span>
							<button
								type="button"
								class="icon-btn"
								onclick={() => downloadConfigFile(selectedPath)}
								aria-label="Download file"
								title="Download"
							>
								<Download size={16} />
							</button>
						</div>

						<CodeEditor bind:value={content} path={selectedPath} readOnly={!writable} />

						<div class="editor-actions">
							<button
								type="button"
								class="ghost-btn"
								onclick={() => guardUnsaved(() => openFile(selectedPath, 0))}
								disabled={busy}
							>
								Revert
							</button>
							<span class="toolbar-spacer"></span>
							<button
								type="button"
								class="ghost-btn"
								onclick={save}
								disabled={!writable || !isDirty || busy}
							>
								{#if isSaving}
									<LoaderCircle class="spin" size={16} />
								{:else}
									<Save size={16} />
								{/if}
								Save
							</button>
							<button
								type="button"
								class="save-restart-btn"
								onclick={saveAndRestart}
								disabled={!writable || !isDirty || busy || restartDisabled}
								title={restartBlockedReason}
							>
								<RotateCcw size={16} />
								Save &amp; restart
							</button>
						</div>
					{/if}
				</div>
			</div>

			<input
				bind:this={fileInput}
				type="file"
				accept=".cfg,.conf,.json,.md,.txt"
				onchange={handleUpload}
				style="display: none"
			/>
		{/if}
	</div>
</section>

<PromptModal
	isOpen={promptState !== null}
	title={promptState?.title ?? ''}
	label={promptState?.label ?? ''}
	value={promptState?.value ?? ''}
	placeholder={promptState?.placeholder ?? ''}
	confirmLabel={promptState?.confirmLabel ?? 'Confirm'}
	validate={validateEntryName}
	onConfirm={runPrompt}
	onCancel={() => (promptState = null)}
/>

<ConfirmModal
	isOpen={confirmState !== null}
	title={confirmState?.title ?? ''}
	message={confirmState?.message ?? ''}
	details={confirmState?.details ?? ''}
	confirmLabel={confirmState?.confirmLabel ?? 'Confirm'}
	onConfirm={runConfirm}
	onCancel={() => (confirmState = null)}
/>

<style>
	.config-page {
		height: 100%;
		padding: 24px 24px 112px;
		box-sizing: border-box;
	}
	.config-card {
		height: 100%;
		background: var(--color-white);
		border-radius: 20px;
		box-shadow: var(--shadow-float);
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 14px;
		box-sizing: border-box;
	}
	.config-header {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-shrink: 0;
	}
	.config-header h1 {
		margin: 0;
		font-size: 2rem;
		font-weight: 700;
		color: var(--color-text-secondary);
	}
	.dev-badge {
		border-radius: 999px;
		padding: 4px 12px;
		background: var(--color-surface-sunken);
		color: var(--color-text-soft);
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.status-pill {
		margin-left: auto;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		border-radius: 999px;
		padding: 8px 16px;
		font-size: 0.9rem;
		font-weight: 600;
		white-space: nowrap;
	}
	.status-pill .dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: currentColor;
	}
	.status-pill.ok {
		background: var(--color-success-bg);
		color: var(--color-success);
	}
	.status-pill.pending {
		background: var(--color-warning-bg);
		color: var(--color-warning);
	}
	.status-pill.problem {
		background: var(--color-danger-bg);
		color: var(--color-red-dark);
	}
	.toolbar {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		flex-shrink: 0;
	}
	.toolbar-spacer {
		flex: 1;
	}
	.banner {
		display: flex;
		align-items: center;
		gap: 10px;
		border-radius: 12px;
		padding: 10px 14px;
		font-size: 0.86rem;
		font-weight: 600;
		flex-shrink: 0;
	}
	.banner.warn {
		background: var(--color-danger-bg);
		color: var(--color-red-dark);
	}
	.banner.suggest {
		background: var(--color-warning-bg);
		color: var(--color-warning);
	}
	.banner span {
		flex: 1;
	}
	.banner-btn {
		border: none;
		background: var(--color-red);
		color: var(--color-white);
		border-radius: 12px;
		padding: 8px 16px;
		font-size: 0.85rem;
		font-weight: 700;
		cursor: pointer;
		flex-shrink: 0;
	}
	.banner-btn:disabled {
		opacity: 0.55;
		cursor: default;
	}
	.banner-dismiss {
		border: none;
		background: transparent;
		color: inherit;
		font-size: 0.85rem;
		font-weight: 700;
		text-decoration: underline;
		cursor: pointer;
		flex-shrink: 0;
	}
	.split {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 280px 1fr;
		gap: 14px;
	}
	.tree-pane,
	.editor-pane {
		border: 1px solid var(--color-border-light);
		border-radius: 16px;
		display: flex;
		flex-direction: column;
		min-height: 0;
		min-width: 0;
		box-sizing: border-box;
		overflow: hidden;
	}
	.pane-head {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		border-bottom: 1px solid var(--color-surface-sunken);
		flex-shrink: 0;
	}
	.pane-title {
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--color-text-subtle);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.tree-scroll {
		flex: 1;
		min-height: 0;
		overflow: auto;
		padding: 6px;
	}
	.file-path {
		flex: 1;
		min-width: 0;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.82rem;
		color: var(--color-text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.dirty {
		color: var(--color-red);
		margin-left: 6px;
	}
	.line-count {
		font-size: 0.75rem;
		color: var(--color-gray-light);
		flex-shrink: 0;
	}
	.editor-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		border-top: 1px solid var(--color-surface-sunken);
		flex-shrink: 0;
	}
	.ghost-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		border: 1px solid var(--color-gray);
		background: var(--color-white);
		color: var(--color-text-muted);
		border-radius: 14px;
		padding: 9px 16px;
		font-size: 0.88rem;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
	}
	.ghost-btn:hover:not(:disabled) {
		background: var(--color-background);
	}
	.ghost-btn:disabled {
		opacity: 0.55;
		cursor: default;
	}
	.restart-select {
		border: 1px solid var(--color-gray);
		border-radius: 14px;
		padding: 9px 12px;
		font-size: 0.88rem;
		font-weight: 600;
		font-family: inherit;
		color: var(--color-text-muted);
		background: var(--color-white);
		cursor: pointer;
	}
	.restart-btn,
	.save-restart-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		border: none;
		background: var(--color-red);
		color: var(--color-white);
		border-radius: 14px;
		padding: 9px 20px;
		font-size: 0.9rem;
		font-weight: 700;
		font-family: inherit;
		cursor: pointer;
	}
	.restart-btn:disabled,
	.save-restart-btn:disabled {
		opacity: 0.55;
		cursor: default;
	}
	.icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border: none;
		border-radius: 10px;
		background: transparent;
		color: var(--color-text-subtle);
		cursor: pointer;
		flex-shrink: 0;
	}
	.icon-btn:hover {
		background: var(--color-background);
		color: var(--color-red);
	}
	.placeholder {
		margin: 20px 12px;
		color: var(--color-text-subtle);
		font-size: 0.9rem;
	}
	.load-error {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 12px;
		margin: 16px 12px;
	}
	.load-error p {
		margin: 0;
		color: var(--color-red);
		font-size: 0.9rem;
	}
	@media (max-width: 1023.98px) {
		/* Two panes side by side stop working well before the phone breakpoint: the tree
		   goes on top with a capped height and the editor keeps the rest. */
		.split {
			grid-template-columns: 1fr;
			grid-template-rows: minmax(120px, 30%) 1fr;
		}
	}
	@media (max-width: 767.98px) {
		.config-page {
			padding: 16px 16px 112px;
		}
		.config-card {
			padding: 16px;
		}
	}
</style>
