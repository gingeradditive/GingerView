<script lang="ts">
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
		WIFI_NETWORK_NOT_FOUND: 'Network not found. Scan again and retry.',
		WIFI_TIMEOUT: 'The printer could not join the network in time.',
		CONFLICT: 'Another connection is already being attempted.',
		SYSTEM_TOOL_UNAVAILABLE: 'Network management is not available on this printer.',
		NOT_FOUND: 'The printer lost track of the operation. Check the status above.',
		INVALID_INPUT: 'The printer rejected those network details.',
		VALIDATION_ERROR: 'The printer rejected those network details.',
		INTERNAL_ERROR: 'The printer reported an internal error.',
		SERVICE_UNREACHABLE:
			'The printer stopped answering. Joining a network changes its address: reopen GingerView at the new one.',
		JOB_TIMEOUT: 'The printer is taking longer than expected. Check this page again in a moment.'
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
		if (!state) return 'Reading the network status...';
		if (state.adapter.state === 'connecting') return 'Connecting...';

		const ethernet = state.interfaces.find((iface) => iface.type === 'ethernet');
		if (!ethernet || ethernet.state === 'unavailable') {
			return 'No cable plugged in — pick a network below.';
		}
		return 'The cable is plugged in but did not get an address.';
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
					<strong>Disconnected</strong>
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
					{isScanning ? 'Scanning...' : 'Scan'}
				</button>
			</div>

			<button type="button" class="network-row hidden-row" onclick={openHiddenDialog}>
				<span class="row-icon"><Component /></span>
				<div class="row-text">
					<strong>Hidden Network</strong>
					<span>Connect to a network not in the list</span>
				</div>
				<span class="chevron"><ChevronRight /></span>
			</button>
		</div>
	</div>
</section>

{#if showPasswordDialog && selectedNetwork}
	{@const network = selectedNetwork}
	<div
		class="overlay"
		role="dialog"
		aria-modal="true"
		aria-labelledby="connect-dialog-title"
		tabindex="0"
		onkeydown={(e) => e.key === 'Escape' && closeDialogs()}
		onclick={(e) => e.target === e.currentTarget && closeDialogs()}
	>
		<div class="dialog" role="document">
			<div class="dialog-header">
				<span class="dialog-icon" aria-hidden="true"><Wifi /></span>
				<h2 id="connect-dialog-title">{network.ssid}</h2>
				<span class="security-label">{network.security || 'Secured'}</span>
			</div>

			<label class="field-label" for="wifi-password">Enter password</label>
			<input
				id="wifi-password"
				type={showPassword ? 'text' : 'password'}
				bind:value={networkPassword}
				placeholder=""
			/>

			<label class="show-password">
				<input type="checkbox" bind:checked={showPassword} />
				<span class="checkbox-box"></span>
				<span class="checkbox-label">Show password</span>
			</label>

			{#if dialogError}
				<p class="dialog-error">{dialogError}</p>
			{/if}

			<div class="dialog-actions">
				<button type="button" class="btn cancel" onclick={closeDialogs}>Cancel</button>
				<button
					type="button"
					class="btn confirm"
					disabled={!networkPassword || connecting}
					onclick={() => connectToNetwork(network.ssid, networkPassword)}
				>
					{connecting ? 'Connecting...' : 'Connect'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showHiddenDialog}
	<div
		class="overlay"
		role="dialog"
		aria-modal="true"
		aria-labelledby="hidden-dialog-title"
		tabindex="0"
		onkeydown={(e) => e.key === 'Escape' && closeDialogs()}
		onclick={(e) => e.target === e.currentTarget && closeDialogs()}
	>
		<div class="dialog" role="document">
			<div class="dialog-header">
				<span class="dialog-icon" aria-hidden="true"><Wifi /></span>
				<h2 id="hidden-dialog-title">Hidden Wifi</h2>
			</div>

			<label class="field-label" for="hidden-ssid">SSID</label>
			<input id="hidden-ssid" type="text" bind:value={hiddenSSID} placeholder="" />

			<label class="field-label" for="hidden-password">Password</label>
			<input
				id="hidden-password"
				type={showHiddenPassword ? 'text' : 'password'}
				bind:value={hiddenPassword}
				placeholder=""
			/>

			<label class="show-password">
				<input type="checkbox" bind:checked={showHiddenPassword} />
				<span class="checkbox-box"></span>
				<span class="checkbox-label">Show password</span>
			</label>

			{#if dialogError}
				<p class="dialog-error">{dialogError}</p>
			{/if}

			<div class="dialog-actions">
				<button type="button" class="btn cancel" onclick={closeDialogs}>Cancel</button>
				<button
					type="button"
					class="btn confirm"
					disabled={!hiddenSSID || !hiddenPassword || connecting}
					onclick={() => connectToNetwork(hiddenSSID, hiddenPassword)}
				>
					{connecting ? 'Connecting...' : 'Connect'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.network-page {
		height: 100%;
		padding: 24px 24px 112px;
		box-sizing: border-box;
	}
	.network-card {
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
		color: #d72e28;
	}
	.header-icon :global(svg) {
		width: 30px;
		height: 30px;
	}
	.page-header h1 {
		margin: 0;
		font-size: 2rem;
		font-weight: 700;
		color: #222222;
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
		background: #dff5e1;
	}
	.status-banner.disconnected {
		background: #f9dcdb;
	}
	.status-banner .banner-icon {
		display: inline-flex;
		flex-shrink: 0;
	}
	.status-banner.connected .banner-icon,
	.status-banner.wired .banner-icon {
		color: #2f9e44;
	}
	.status-banner.disconnected .banner-icon {
		color: #d72e28;
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
		color: #2f9e44;
	}
	.status-banner.disconnected .banner-text strong {
		color: #d72e28;
	}
	.banner-text .ip {
		font-size: 0.95rem;
		color: #6e6e6e;
	}
	.error-box {
		background: #f9dcdb;
		color: #d72e28;
		border-radius: 14px;
		padding: 12px 16px;
		font-size: 0.9rem;
	}
	.info-box {
		background: #f1f1f1;
		color: #444444;
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
		background: #ffffff;
		border: 1px solid #e2e2e2;
		border-radius: 16px;
		padding: 14px 18px;
		text-align: left;
	}
	.row-icon {
		display: inline-flex;
		color: #9a9a9a;
		flex-shrink: 0;
	}
	.row-icon.active {
		color: #d72e28;
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
		color: #111111;
	}
	.row-text span {
		font-size: 0.9rem;
		color: #6e6e6e;
	}
	.chevron {
		display: inline-flex;
		color: #b5b5b5;
		flex-shrink: 0;
	}
	.scan-row {
		display: flex;
		justify-content: flex-end;
	}
	.scan-btn {
		border: 1px solid #d72e28;
		background: transparent;
		color: #d72e28;
		border-radius: 14px;
		padding: 12px 28px;
		font-size: 1rem;
		font-weight: 700;
	}
	.scan-btn:disabled {
		opacity: 0.6;
	}
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 2300;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
		background: rgba(60, 60, 60, 0.45);
		backdrop-filter: blur(10px);
	}
	.dialog {
		width: min(420px, calc(100vw - 32px));
		background: #ffffff;
		border-radius: 20px;
		padding: 24px;
		box-sizing: border-box;
	}
	.dialog-header {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 20px;
	}
	.dialog-icon {
		display: inline-flex;
		color: #d72e28;
		flex-shrink: 0;
	}
	.dialog-icon :global(svg) {
		width: 26px;
		height: 26px;
	}
	.dialog-header h2 {
		margin: 0;
		font-size: 1.4rem;
		font-weight: 700;
		flex: 1;
		min-width: 0;
	}
	.security-label {
		color: #9a9a9a;
		font-size: 0.9rem;
		flex-shrink: 0;
	}
	.field-label {
		display: block;
		font-size: 0.9rem;
		font-weight: 600;
		margin: 12px 0 6px;
	}
	.dialog input[type='text'],
	.dialog input[type='password'] {
		width: 100%;
		box-sizing: border-box;
		border: 1px solid #e2e2e2;
		border-radius: 14px;
		padding: 12px 14px;
		font-size: 0.95rem;
		outline: none;
		font-family: inherit;
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
		border: 2px solid #d72e28;
		border-radius: 5px;
		flex-shrink: 0;
	}
	.show-password input[type='checkbox']:checked + .checkbox-box {
		background: #d72e28;
	}
	.checkbox-label {
		color: #d72e28;
		font-size: 0.95rem;
		font-weight: 600;
	}
	.dialog-error {
		color: #d72e28;
		font-size: 0.85rem;
		margin: 10px 0 0;
	}
	.dialog-actions {
		display: flex;
		gap: 12px;
		margin-top: 22px;
	}
	.btn {
		flex: 1;
		border: none;
		border-radius: 14px;
		padding: 14px;
		font-size: 1.05rem;
		font-weight: 700;
	}
	.btn.cancel {
		background: #e2e2e2;
		color: #ffffff;
	}
	.btn.confirm {
		background: #d72e28;
		color: #ffffff;
	}
	.btn.confirm:disabled {
		opacity: 0.55;
	}
</style>
