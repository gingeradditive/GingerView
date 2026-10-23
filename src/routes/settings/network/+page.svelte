<script lang="ts">
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import { onMount } from 'svelte';
	import {
		ChevronRight,
		Component,
		EthernetPort,
		Wifi,
		WifiHigh,
		WifiLow,
		WifiZero
	} from 'lucide-svelte';
	import { ServiceError } from '$lib/services/g2-service';
	import {
		connectToWifi,
		fetchNetworkStatus,
		fetchWifiNetworks,
		isSecured,
		rescanWifiNetworks
	} from '$lib/services/network-api';
	import type { NetworkStatus, WifiNetwork } from '$lib/types/network';

	interface NetworkInfo extends WifiNetwork {
		current: boolean;
		signal: 1 | 2 | 3 | 4;
		secured: boolean;
	}

	const STATUS_POLL_INTERVAL_MS = 5000;

	/**
	 * What a failed call means to the person in front of the machine.
	 *
	 * The `WIFI_*` ones are the failed outcomes of the `wifi.connect` job, not
	 * HTTP errors: the printer did try. `SERVICE_UNREACHABLE` is the awkward one —
	 * it is also what a *successful* connection looks like from a browser that was
	 * talking to the printer over the network it just left.
	 *
	 * The mapping is by `code` because that is the stable half of the contract:
	 * G2-Service's own messages are in Italian, and this interface is in English.
	 */
	const SERVICE_MESSAGES: Record<string, string> = {
		WIFI_AUTH_FAILED: 'Wrong password.',
		WIFI_NETWORK_NOT_FOUND: "Can't find that network. Scan again",
		WIFI_TIMEOUT: 'The printer took too long to join. Try once more?',
		CONFLICT: 'Hang on, an attempt is already underway',
		SYSTEM_TOOL_UNAVAILABLE: 'Network management is not available on this printer.',
		NOT_FOUND: 'The printer lost track of the operation. Check the status above.',
		INVALID_INPUT: "The printer didn't accept those details",
		VALIDATION_ERROR: "The printer didn't accept those details",
		INTERNAL_ERROR: 'The printer reported an internal error.',
		SERVICE_UNREACHABLE:
			'We lost the printer! Joining a new network changes its address, so open GingerView at the new one',
		JOB_TIMEOUT: 'This is taking a bit longer than usual. Check back in a moment.'
	};

	let status = $state<NetworkStatus | null>(null);
	let wifiNetworks = $state<WifiNetwork[]>([]);
	let isScanning = $state(false);
	let error = $state('');

	let showPasswordDialog = $state(false);
	let selectedNetwork = $state<NetworkInfo | null>(null);
	let networkPassword = $state('');
	let showPassword = $state(false);
	let connecting = $state(false);
	/** Kept so that an open network, which skips the dialog, still says what it is doing. */
	let connectingSsid = $state('');
	let dialogError = $state('');

	let showHiddenDialog = $state(false);
	let hiddenSSID = $state('');
	let hiddenPassword = $state('');
	let showHiddenPassword = $state(false);

	// The status is unified over Wi-Fi and Ethernet: `adapter` is whichever one is
	// carrying the connection, and `signalInfo` is there only when it is Wi-Fi.
	const isWired = $derived(status?.adapter.type === 'ethernet');
	const isConnected = $derived(status?.adapter.state === 'connected');
	const ipAddress = $derived(status?.ip.ipv4 ?? 'Unknown');
	const currentSsid = $derived(status?.signalInfo?.ssid ?? '');
	const currentSignalBars = $derived(signalBars(status?.signalInfo?.signalStrength ?? 0));

	// Hidden networks come back with an empty SSID, so there is nothing to show
	// and nothing to tap: they are reached through the dialog at the bottom.
	const availableNetworks = $derived(
		wifiNetworks.filter((network) => network.ssid !== '').map(toNetworkInfo)
	);

	function signalBars(strength: number): 1 | 2 | 3 | 4 {
		return Math.max(1, Math.min(4, Math.ceil(strength / 25))) as 1 | 2 | 3 | 4;
	}

	function signalLabel(bars: number) {
		if (bars >= 4) return 'Strong';
		if (bars === 3) return 'Good';
		if (bars === 2) return 'Weak';
		return 'Very Weak';
	}

	function wifiIconFor(bars: number) {
		if (bars >= 4) return Wifi;
		if (bars === 3) return WifiHigh;
		if (bars === 2) return WifiLow;
		return WifiZero;
	}

	function toNetworkInfo(network: WifiNetwork): NetworkInfo {
		return {
			...network,
			current: network.ssid === currentSsid,
			signal: signalBars(network.signalStrength),
			secured: isSecured(network)
		};
	}

	/** Turns a rejection into something worth reading, with its own code first. */
	function describe(err: unknown, fallback: string): string {
		if (err instanceof ServiceError) return SERVICE_MESSAGES[err.code] ?? err.message ?? fallback;
		return fallback;
	}

	/**
	 * Why there is no connection. `interfaces` lists the idle ones too, which is
	 * the only way to tell "no cable" from "cable in, nothing on it" — two
	 * situations that ask different things of whoever is reading.
	 */
	function describeDisconnected(state: NetworkStatus | null): string {
		if (!state) return 'Checking your connection…';
		if (state.adapter.state === 'connecting') return 'Connecting…';

		const ethernet = state.interfaces.find((iface) => iface.type === 'ethernet');
		if (!ethernet || ethernet.state === 'unavailable') {
			return 'No cable plugged in. Pick a Wi-Fi network below';
		}
		return "The cable's plugged in, but didn't get an address";
	}

	const disconnectedReason = $derived(describeDisconnected(status));

	async function updateNetworkStatus() {
		try {
			status = await fetchNetworkStatus();
			error = '';
		} catch (err) {
			error = describe(err, 'Failed to read the network status.');
		}
	}

	/** The last known scan: it answers immediately, so it is what page load uses. */
	async function loadNetworks() {
		try {
			wifiNetworks = await fetchWifiNetworks();
			error = '';
			// A machine that has not scanned since boot has nothing cached, and an
			// empty list would look like "no networks around" instead of "no scan yet".
			if (wifiNetworks.length === 0) await scanNetworks();
		} catch (err) {
			error = describe(err, 'Failed to list the Wi-Fi networks.');
		}
	}

	/** Forces a fresh scan and waits for it — the "Scan" button. */
	async function scanNetworks() {
		try {
			isScanning = true;
			wifiNetworks = await rescanWifiNetworks();
			error = '';
		} catch (err) {
			error = describe(err, 'Failed to scan for networks.');
		} finally {
			isScanning = false;
		}
	}

	onMount(() => {
		updateNetworkStatus();
		loadNetworks();
		// The poll stands down while a connection is running: the machine is
		// changing address, so a failed poll says nothing new and would put an
		// alarming message next to a dialog that is doing exactly what it should.
		const interval = setInterval(() => {
			if (!connecting) updateNetworkStatus();
		}, STATUS_POLL_INTERVAL_MS);
		return () => clearInterval(interval);
	});

	function selectNetwork(network: NetworkInfo) {
		if (network.current) return;
		selectedNetwork = network;
		networkPassword = '';
		showPassword = false;
		dialogError = '';
		if (network.secured) {
			showPasswordDialog = true;
		} else {
			connectToNetwork(network.ssid, '');
		}
	}

	function openHiddenDialog() {
		hiddenSSID = '';
		hiddenPassword = '';
		showHiddenPassword = false;
		dialogError = '';
		showHiddenDialog = true;
	}

	function closeDialogs() {
		showPasswordDialog = false;
		showHiddenDialog = false;
		selectedNetwork = null;
		networkPassword = '';
		hiddenSSID = '';
		hiddenPassword = '';
	}

	/**
	 * Connecting is a job, not a request that answers when it is done: the
	 * printer's address changes on the way, so the reply to the request that
	 * started it would have nowhere to arrive. `connectToWifi()` follows the job
	 * and resolves only once the machine is on the network.
	 */
	async function connectToNetwork(ssid: string, password: string) {
		try {
			connecting = true;
			connectingSsid = ssid;
			dialogError = '';
			error = '';
			await connectToWifi({ ssid, password: password || null });
			closeDialogs();
			await updateNetworkStatus();
			await loadNetworks();
		} catch (err) {
			const message = describe(err, 'Failed to connect to the network.');
			// An open network connects straight from the list, with no dialog to
			// put the message in.
			if (showPasswordDialog || showHiddenDialog) dialogError = message;
			else error = message;
		} finally {
			connecting = false;
			connectingSsid = '';
		}
	}
</script>

<svelte:head>
	<title>Network · G2</title>
</svelte:head>

<section class="network-page">
	<div class="network-card">
		<header class="page-header">
			<span class="header-icon" aria-hidden="true"><Wifi /></span>
			<h1>Network</h1>
		</header>

		<div class="status-banner {!isConnected ? 'disconnected' : isWired ? 'wired' : 'connected'}">
			<span class="banner-icon">
				{#if isWired}
					<EthernetPort />
				{:else}
					{@const SignalIcon = wifiIconFor(isConnected ? currentSignalBars : 4)}
					<SignalIcon />
				{/if}
			</span>
			<div class="banner-text">
				{#if !isConnected}
					<strong>Not connected</strong>
					<span class="ip">{disconnectedReason}</span>
				{:else if isWired}
					<strong>Wired</strong>
					<span class="ip">IP: {ipAddress}</span>
				{:else}
					<strong>{currentSsid || 'Connected'}</strong>
					<span class="ip">IP: {ipAddress}</span>
					<strong class="signal-label">{signalLabel(currentSignalBars)} Signal</strong>
				{/if}
			</div>
		</div>

		{#if error}
			<div class="error-box">{error}</div>
		{/if}

		<!--
			Joining a network can take up to a minute, and an open one is connected
			straight from the list: without this the page would look idle while the
			printer works.
		-->
		{#if connecting && !showPasswordDialog && !showHiddenDialog}
			<div class="info-box">Connecting to {connectingSsid}...</div>
		{/if}

		<div class="network-list">
			{#each availableNetworks as network (network.ssid)}
				{@const SignalIcon = wifiIconFor(network.signal)}
				<button type="button" class="network-row" onclick={() => selectNetwork(network)}>
					<span class="row-icon {network.current ? 'active' : ''}"><SignalIcon /></span>
					<div class="row-text">
						<strong>{network.ssid}</strong>
						<span>{signalLabel(network.signal)}</span>
					</div>
					<span class="chevron"><ChevronRight /></span>
				</button>
			{/each}
		</div>

		<div class="card-footer">
			<div class="scan-row">
				<button type="button" class="scan-btn" onclick={scanNetworks} disabled={isScanning}>
					{isScanning ? 'Scanning…' : 'Scan'}
				</button>
			</div>

			<button type="button" class="network-row hidden-row" onclick={openHiddenDialog}>
				<span class="row-icon"><Component /></span>
				<div class="row-text">
					<strong>Hidden Network</strong>
					<span>Can't see yours? Add it by name</span>
				</div>
				<span class="chevron"><ChevronRight /></span>
			</button>
		</div>
	</div>
</section>

{#if showPasswordDialog && selectedNetwork}
	{@const network = selectedNetwork}
	<Sheet label={`Connect to ${network.ssid}`} onClose={closeDialogs} size="sm">
		{#snippet header()}
			<div class="dialog-header">
				<span class="dialog-icon" aria-hidden="true"><Wifi /></span>
				<div class="dialog-heading">
					<h3 class="sheet-title">{network.ssid}</h3>
					<span class="security-label">{network.security || 'Secured'}</span>
				</div>
			</div>
		{/snippet}

		<label class="sheet-field">
			<span>Password</span>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				type={showPassword ? 'text' : 'password'}
				bind:value={networkPassword}
				autocomplete="off"
				autofocus
				aria-invalid={!!dialogError}
				onkeydown={(e) =>
					e.key === 'Enter' &&
					networkPassword &&
					!connecting &&
					connectToNetwork(network.ssid, networkPassword)}
			/>
		</label>

		<label class="show-password">
			<input type="checkbox" bind:checked={showPassword} />
			<span class="checkbox-box"></span>
			<span class="checkbox-label">Show password</span>
		</label>

		{#if dialogError}
			<p class="sheet-error dialog-error" role="alert">{dialogError}</p>
		{/if}

		{#snippet footer()}
			<button type="button" class="btn btn-secondary" onclick={closeDialogs}>Cancel</button>
			<button
				type="button"
				class="btn btn-primary"
				disabled={!networkPassword || connecting}
				onclick={() => connectToNetwork(network.ssid, networkPassword)}
			>
				{connecting ? 'Connecting…' : 'Connect'}
			</button>
		{/snippet}
	</Sheet>
{/if}

{#if showHiddenDialog}
	<Sheet label="Hidden network" onClose={closeDialogs} size="sm">
		{#snippet header()}
			<div class="dialog-header">
				<span class="dialog-icon" aria-hidden="true"><Wifi /></span>
				<div class="dialog-heading">
					<h3 class="sheet-title">Hidden network</h3>
					<span class="security-label">Not shown in the list</span>
				</div>
			</div>
		{/snippet}

		<div class="fields">
			<label class="sheet-field">
				<span>Network name (SSID)</span>
				<!-- svelte-ignore a11y_autofocus -->
				<input type="text" bind:value={hiddenSSID} autocomplete="off" autofocus />
			</label>

			<label class="sheet-field">
				<span>Password</span>
				<input
					type={showHiddenPassword ? 'text' : 'password'}
					bind:value={hiddenPassword}
					autocomplete="off"
					aria-invalid={!!dialogError}
				/>
			</label>
		</div>

		<label class="show-password">
			<input type="checkbox" bind:checked={showHiddenPassword} />
			<span class="checkbox-box"></span>
			<span class="checkbox-label">Show password</span>
		</label>

		{#if dialogError}
			<p class="sheet-error dialog-error" role="alert">{dialogError}</p>
		{/if}

		{#snippet footer()}
			<button type="button" class="btn btn-secondary" onclick={closeDialogs}>Cancel</button>
			<button
				type="button"
				class="btn btn-primary"
				disabled={!hiddenSSID || !hiddenPassword || connecting}
				onclick={() => connectToNetwork(hiddenSSID, hiddenPassword)}
			>
				{connecting ? 'Connecting…' : 'Connect'}
			</button>
		{/snippet}
	</Sheet>
{/if}

<style>
	.network-page {
		height: 100%;
		padding: 24px 24px calc(112px + var(--safe-bottom));
		box-sizing: border-box;
	}
	.network-card {
		height: 100%;
		background: var(--color-white);
		border-radius: 20px;
		box-shadow: var(--shadow-float);
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		box-sizing: border-box;
	}
	.page-header,
	.status-banner,
	.error-box,
	.info-box {
		flex-shrink: 0;
	}
	.page-header {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.header-icon {
		display: inline-flex;
		color: var(--color-red);
	}
	.header-icon :global(svg) {
		width: 30px;
		height: 30px;
	}
	.page-header h1 {
		margin: 0;
		font-size: 2rem;
		font-weight: 700;
		color: var(--color-text-secondary);
	}
	.status-banner {
		display: flex;
		align-items: center;
		gap: 18px;
		border-radius: 20px;
		padding: 20px 24px;
	}
	.status-banner.connected,
	.status-banner.wired {
		background: var(--color-success-bg);
	}
	.status-banner.disconnected {
		background: var(--color-danger-bg);
	}
	.status-banner .banner-icon {
		display: inline-flex;
		flex-shrink: 0;
	}
	.status-banner.connected .banner-icon,
	.status-banner.wired .banner-icon {
		color: var(--color-success);
	}
	.status-banner.disconnected .banner-icon {
		color: var(--color-red);
	}
	.status-banner .banner-icon :global(svg) {
		width: 40px;
		height: 40px;
	}
	.banner-text {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.banner-text strong {
		font-size: 1.15rem;
		font-weight: 700;
	}
	.status-banner.connected .banner-text strong,
	.status-banner.wired .banner-text strong {
		color: var(--color-success);
	}
	.status-banner.disconnected .banner-text strong {
		color: var(--color-red);
	}
	.banner-text .ip {
		font-size: 0.95rem;
		color: var(--color-text-soft);
	}
	.error-box {
		background: var(--color-danger-bg);
		color: var(--color-red);
		border-radius: 14px;
		padding: 12px 16px;
		font-size: 0.9rem;
	}
	.info-box {
		background: var(--color-background);
		color: var(--color-text-muted);
		border-radius: 14px;
		padding: 12px 16px;
		font-size: 0.9rem;
	}
	.network-list {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.card-footer {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.network-row {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 16px;
		background: var(--color-white);
		border: 1px solid var(--color-border-light);
		border-radius: 16px;
		padding: 14px 18px;
		text-align: left;
	}
	.row-icon {
		display: inline-flex;
		color: var(--color-text-disabled);
		flex-shrink: 0;
	}
	.row-icon.active {
		color: var(--color-red);
	}
	.row-icon :global(svg) {
		width: 26px;
		height: 26px;
	}
	.row-text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.row-text strong {
		font-size: 1.05rem;
		font-weight: 700;
		color: var(--color-black);
	}
	.row-text span {
		font-size: 0.9rem;
		color: var(--color-text-soft);
	}
	.chevron {
		display: inline-flex;
		color: var(--color-gray-light);
		flex-shrink: 0;
	}
	.scan-row {
		display: flex;
		justify-content: flex-end;
	}
	.scan-btn {
		border: 1px solid var(--color-red);
		background: transparent;
		color: var(--color-red);
		border-radius: 14px;
		padding: 12px 28px;
		font-size: 1rem;
		font-weight: 700;
	}
	.scan-btn:disabled {
		opacity: 0.6;
	}
	.dialog-header {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.dialog-heading {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.dialog-heading .sheet-title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.fields {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.dialog-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 12px;
		background: var(--color-danger-bg);
		color: var(--color-red);
		flex-shrink: 0;
	}
	.dialog-icon :global(svg) {
		width: 26px;
		height: 26px;
	}
	.security-label {
		color: var(--color-text-soft);
		font-size: 0.85rem;
	}
	.show-password {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 14px;
		cursor: pointer;
	}
	.show-password input[type='checkbox'] {
		position: absolute;
		opacity: 0;
		width: 20px;
		height: 20px;
		margin: 0;
		cursor: pointer;
	}
	.checkbox-box {
		width: 20px;
		height: 20px;
		border: 2px solid var(--color-red);
		border-radius: 5px;
		flex-shrink: 0;
	}
	.show-password input[type='checkbox']:checked + .checkbox-box {
		background: var(--color-red);
	}
	.checkbox-label {
		color: var(--color-red);
		font-size: 0.95rem;
		font-weight: 600;
	}
	.dialog-error {
		margin-top: 12px;
	}
</style>
