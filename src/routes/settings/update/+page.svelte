<script lang="ts">
	import { onMount } from 'svelte';
	import { CloudDownload, LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import UpdateItemRow from '$lib/components/UpdateItemRow.svelte';
	import UpdateLogModal from '$lib/components/UpdateLogModal.svelte';
	import { getMoonrakerApiUrl } from '$lib/services/config';
	import {
		connectUpdateSocket,
		describeItem,
		fetchUpdateStatus,
		fetchUpdateStatusQuietly,
		isSelfUpdate,
		refreshUpdateStatus,
		sortItems,
		startRecover,
		startUpgrade
	} from '$lib/services/moonraker-update';
	import { toastActions } from '$lib/stores/toastStore';
	import type { UpdateLogState, UpdateStatus } from '$lib/types/update';

	const printStatePollMs = 5000;
	/** How often the page re-checks `busy` after losing the request, and for how long. */
	const busyPollMs = 3000;
	const busyPollTimeoutMs = 30 * 60 * 1000;
	/** Seconds left on screen before the page reloads itself after a self-update. */
	const reloadCountdownSeconds = 5;

	let status = $state<UpdateStatus | null>(null);
	let loadError = $state('');
	let isLoading = $state(true);
	let isRefreshing = $state(false);
	let printState = $state('');

	// Operation in flight (update all / recovery) and its live output.
	let isOperationRunning = $state(false);
	let logOpen = $state(false);
	let logTitle = $state('');
	let logLines = $state<string[]>([]);
	let logState = $state<UpdateLogState>('running');
	let logError = $state('');
	let lastLoggedApp = '';
	let completedApps = new Set<string>();

	// Set when the operation updated GingerView itself: the files nginx serves have
	// changed, but this tab is still running the bundle loaded before the update.
	let selfUpdated = $state(false);
	let reloadIn = $state(0);
	let reloadTimer: ReturnType<typeof setInterval> | null = null;

	let confirmState = $state<{
		title: string;
		message: string;
		details: string;
		confirmLabel: string;
		run: () => void;
	} | null>(null);

	let items = $derived(status ? sortItems(status.version_info) : []);
	let updatesAvailable = $derived(
		items.filter((item) => describeItem(item).updateAvailable).length
	);
	let blockedReason = $derived(
		printState === 'printing'
			? 'A print is running. Updates are disabled until it finishes.'
			: printState === 'paused'
				? 'A print is paused. Finish or cancel it before updating.'
				: ''
	);
	let actionsDisabled = $derived(isOperationRunning || blockedReason !== '' || isRefreshing);
	let headerBadge = $derived(
		isOperationRunning
			? { text: 'Updating…', tone: 'pending' }
			: updatesAvailable > 0
				? {
						text: `${updatesAvailable} update${updatesAvailable === 1 ? '' : 's'} available`,
						tone: 'pending'
					}
				: { text: 'Up to date', tone: 'ok' }
	);

	onMount(() => {
		loadStatus();
		updatePrintState();

		const printTimer = window.setInterval(updatePrintState, printStatePollMs);
		const disconnect = connectUpdateSocket({
			onResponse: (payload) => {
				if (payload.complete) completedApps.add(payload.application);
				appendLog(payload.application, payload.message);
			},
			onRefreshed: (fresh) => {
				// Moonraker refreshed on its own (or another client asked it to).
				if (!isOperationRunning) status = fresh;
			}
		});

		return () => {
			window.clearInterval(printTimer);
			if (reloadTimer) clearInterval(reloadTimer);
			disconnect();
		};
	});

	async function loadStatus() {
		isLoading = true;
		loadError = '';
		try {
			status = await fetchUpdateStatus();
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Failed to read update status';
		} finally {
			isLoading = false;
		}
	}

	async function updatePrintState() {
		try {
			const res = await fetch(`${getMoonrakerApiUrl()}/printer/objects/query?print_stats`);
			if (!res.ok) return;
			const json = await res.json();
			printState = json.result?.status?.print_stats?.state ?? '';
		} catch {
			// Same as the dashboard panels: a failed poll leaves the last value in place.
		}
	}

	async function handleRefresh() {
		if (actionsDisabled) return;
		isRefreshing = true;
		try {
			status = await refreshUpdateStatus();
			toastActions.success('moonraker', 'Update check complete', 'Version information refreshed');
		} catch {
			// Error toast already reported by refreshUpdateStatus
		} finally {
			isRefreshing = false;
		}
	}

	function appendLog(application: string, message: string) {
		const text = (message ?? '').replace(/\s+$/, '');
		if (application && application !== lastLoggedApp) {
			lastLoggedApp = application;
			logLines = [...logLines, `--- ${application} ---`];
		}
		if (!text) return;
		logLines = [...logLines, text];
	}

	/**
	 * Runs a long operation, showing its live output.
	 *
	 * Moonraker only answers the request once the operation is over, which can be
	 * many minutes for an OS upgrade — longer than the proxy is willing to wait.
	 * A failed request is therefore not proof of a failed update: if the update
	 * manager still reports `busy`, the page keeps following it until it settles
	 * instead of claiming an error that did not happen.
	 */
	async function runOperation(title: string, action: () => Promise<void>) {
		logTitle = title;
		logLines = [];
		logState = 'running';
		logError = '';
		lastLoggedApp = '';
		completedApps = new Set();
		selfUpdated = false;
		logOpen = true;
		isOperationRunning = true;

		try {
			await action();
			logState = 'success';
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Operation failed';
			const stillBusy = await waitWhileBusy();
			if (stillBusy === 'finished' && completedApps.size > 0) {
				logLines = [
					...logLines,
					'--- Connection to Moonraker was interrupted, but the operation completed on the printer. ---'
				];
				logState = 'success';
			} else if (stillBusy === 'finished') {
				logState = 'error';
				logError =
					'Lost the connection to Moonraker while the operation was running. Check the output above.';
			} else {
				logState = 'error';
				logError = message;
				toastActions.error('moonraker', 'Update failed', message);
			}
		} finally {
			isOperationRunning = false;
			if (logState === 'success' && [...completedApps].some(isSelfUpdate)) {
				// GingerView updated itself: re-reading the status would only refresh
				// numbers inside a bundle that is already obsolete. Reload instead.
				selfUpdated = true;
				startReloadCountdown();
			} else {
				await reloadStatusAfterOperation();
			}
		}
	}

	/**
	 * After GingerView updates itself the tab keeps running the old bundle, so the
	 * page reloads on its own. `index.html` is served with `no-store` (see the nginx
	 * site written by `script/install.sh`), so a plain reload really does fetch the
	 * new entry point and, through it, the new hashed assets.
	 *
	 * The countdown is there so the reload does not wipe the log out from under
	 * someone still reading it; closing the modal reloads immediately.
	 */
	function startReloadCountdown() {
		if (reloadTimer) clearInterval(reloadTimer);
		reloadIn = reloadCountdownSeconds;
		reloadTimer = setInterval(() => {
			reloadIn -= 1;
			if (reloadIn <= 0) reloadNow();
		}, 1000);
	}

	function reloadNow() {
		if (reloadTimer) clearInterval(reloadTimer);
		reloadTimer = null;
		window.location.reload();
	}

	function handleLogClose() {
		if (selfUpdated) {
			reloadNow();
			return;
		}
		logOpen = false;
	}

	/**
	 * Updating Moonraker or Klipper restarts the service that has just been
	 * updated, so the first status request after an operation often lands while
	 * the host is still coming back up. Retry a few times before giving up and
	 * leaving the stale values on screen.
	 */
	async function reloadStatusAfterOperation() {
		for (let attempt = 0; attempt < 3; attempt += 1) {
			const fresh = await fetchUpdateStatusQuietly();
			if (fresh) {
				status = fresh;
				return;
			}
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}
	}

	/**
	 * Returns `'finished'` when an operation was still running and has now ended,
	 * `'idle'` when nothing was running in the first place — meaning the request
	 * really did fail.
	 */
	async function waitWhileBusy(): Promise<'finished' | 'idle'> {
		const current = await fetchUpdateStatusQuietly();
		if (!current?.busy) return 'idle';

		const deadline = Date.now() + busyPollTimeoutMs;
		while (Date.now() < deadline) {
			await new Promise((resolve) => setTimeout(resolve, busyPollMs));
			const next = await fetchUpdateStatusQuietly();
			if (next && !next.busy) return 'finished';
		}
		return 'finished';
	}

	function handleUpdateAll() {
		if (actionsDisabled || updatesAvailable === 0) return;
		runOperation('Updating all', () => startUpgrade());
	}

	function handleRecover(name: string, hard: boolean) {
		if (actionsDisabled) return;
		confirmState = {
			title: hard ? 'Hard recovery' : 'Soft recovery',
			message: hard
				? `Delete the ${name} repository and clone it again?`
				: `Reset the ${name} repository, discarding local changes?`,
			details: hard
				? 'Everything that is not in the remote repository is lost, including any local configuration kept inside it.'
				: 'Local modifications to tracked files are discarded.',
			confirmLabel: hard ? 'Hard recover' : 'Soft recover',
			run: () =>
				runOperation(`${hard ? 'Hard' : 'Soft'} recovery of ${name}`, () =>
					startRecover(name, hard)
				)
		};
	}

	function confirmPendingAction() {
		const pending = confirmState;
		confirmState = null;
		pending?.run();
	}

	function formatResetTime(unixSeconds: number): string {
		if (!unixSeconds) return '';
		return new Date(unixSeconds * 1000).toLocaleTimeString();
	}
</script>

<section class="update-page">
	<div class="update-card">
		<header class="update-header">
			<h1>Update</h1>
			<span class="status-pill {headerBadge.tone}">
				<span class="dot"></span>
				{headerBadge.text}
			</span>
		</header>

		{#if blockedReason}
			<div class="banner">
				<TriangleAlert size={18} />
				<span>{blockedReason}</span>
			</div>
		{/if}

		<div class="item-list">
			{#if isLoading}
				<p class="placeholder">Loading update status…</p>
			{:else if loadError}
				<div class="load-error">
					<p>{loadError}</p>
					<button type="button" class="ghost-btn" onclick={loadStatus}>Retry</button>
				</div>
			{:else if items.length === 0}
				<p class="placeholder">
					No updatable components are configured. Add them to the <code>[update_manager]</code>
					section of <code>moonraker.conf</code>.
				</p>
			{:else}
				{#each items as item (item.name)}
					<UpdateItemRow
						{item}
						busy={isOperationRunning}
						{blockedReason}
						onRecover={handleRecover}
					/>
				{/each}
			{/if}
		</div>

		{#if status && status.github_rate_limit > 0}
			<p class="rate-limit">
				GitHub requests remaining: {status.github_requests_remaining}/{status.github_rate_limit}
				{#if status.github_limit_reset_time}
					· resets at {formatResetTime(status.github_limit_reset_time)}
				{/if}
			</p>
		{/if}

		<div class="actions-row">
			<button
				type="button"
				class="ghost-btn"
				onclick={handleRefresh}
				disabled={actionsDisabled || isLoading}
			>
				{#if isRefreshing}
					<LoaderCircle class="spin" size={18} />
				{:else}
					<RefreshCw size={18} />
				{/if}
				Check for updates
			</button>
			<button
				type="button"
				class="update-all-btn"
				onclick={handleUpdateAll}
				disabled={actionsDisabled || updatesAvailable === 0}
			>
				<CloudDownload size={18} />
				Update all
			</button>
		</div>
	</div>
</section>

<UpdateLogModal
	isOpen={logOpen}
	title={logTitle}
	lines={logLines}
	{logState}
	errorMessage={logError}
	successNote={selfUpdated
		? `GingerView was updated: reloading the interface in ${reloadIn}s…`
		: ''}
	closeLabel={selfUpdated ? 'Reload now' : 'Close'}
	onClose={handleLogClose}
/>

<ConfirmModal
	isOpen={confirmState !== null}
	title={confirmState?.title ?? ''}
	message={confirmState?.message ?? ''}
	details={confirmState?.details ?? ''}
	confirmLabel={confirmState?.confirmLabel ?? 'Confirm'}
	onConfirm={confirmPendingAction}
	onCancel={() => (confirmState = null)}
/>

<style>
	.update-page {
		height: 100%;
		padding: 24px 24px 112px;
		box-sizing: border-box;
	}
	.update-card {
		height: 100%;
		background: #ffffff;
		border-radius: 20px;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		box-sizing: border-box;
	}
	.update-header {
		display: flex;
		align-items: center;
		gap: 14px;
		flex-shrink: 0;
	}
	.update-header h1 {
		margin: 0;
		font-size: 2rem;
		font-weight: 700;
		color: #222222;
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
		background: #ddf3df;
		color: #1a7f37;
	}
	.status-pill.pending {
		background: #fdf0d5;
		color: #9a6700;
	}
	.banner {
		display: flex;
		align-items: center;
		gap: 10px;
		background: #fdf0d5;
		color: #9a6700;
		border-radius: 12px;
		padding: 12px 14px;
		font-size: 0.88rem;
		font-weight: 600;
		flex-shrink: 0;
	}
	.item-list {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		border: 1px solid #e2e2e2;
		border-radius: 16px;
		padding: 4px 20px;
		box-sizing: border-box;
	}
	.placeholder {
		margin: 20px 0;
		color: #8a8a8a;
		font-size: 0.9rem;
	}
	.placeholder code {
		background: #f5f5f5;
		border-radius: 6px;
		padding: 1px 6px;
		font-size: 0.85em;
	}
	.load-error {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 12px;
		margin: 20px 0;
	}
	.load-error p {
		margin: 0;
		color: #d72e28;
		font-size: 0.9rem;
	}
	.rate-limit {
		margin: 0;
		font-size: 0.78rem;
		color: #b5b5b5;
		flex-shrink: 0;
	}
	.actions-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-shrink: 0;
	}
	.ghost-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		border: 1px solid #c8c8c8;
		background: #ffffff;
		color: #444444;
		border-radius: 16px;
		padding: 12px 20px;
		font-size: 0.95rem;
		font-weight: 600;
		cursor: pointer;
	}
	.ghost-btn:hover:not(:disabled) {
		background: #f5f5f5;
	}
	.ghost-btn:disabled {
		opacity: 0.55;
		cursor: default;
	}
	.update-all-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		border: none;
		background: #d72e28;
		color: #ffffff;
		border-radius: 16px;
		padding: 12px 28px;
		font-size: 1rem;
		font-weight: 700;
		cursor: pointer;
	}
	.update-all-btn:disabled {
		opacity: 0.55;
		cursor: default;
	}
	@media (max-width: 767.98px) {
		.update-page {
			padding: 16px 16px 112px;
		}
		.update-card {
			padding: 18px;
		}
		.actions-row {
			flex-direction: column-reverse;
			align-items: stretch;
		}
		.ghost-btn,
		.update-all-btn {
			justify-content: center;
		}
	}
</style>
