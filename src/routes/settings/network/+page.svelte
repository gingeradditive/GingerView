<script lang="ts">
	import { onMount } from 'svelte';
	import { ChevronRight, Component, EthernetPort, Wifi, WifiHigh, WifiLow, WifiZero } from 'lucide-svelte';
	import { networkAPI, NetworkAPIError } from '$lib/services/network-api';
	import type { WiFiNetwork, NetworkStatus } from '$lib/types/wifi';

	interface NetworkInfo extends WiFiNetwork {
		current: boolean;
		signal: 1 | 2 | 3 | 4;
		secured: boolean;
	}

	const STATUS_POLL_INTERVAL_MS = 5000;

	let isConnected = $state(false);
	let connectionType = $state('wifi');
	let ipAddress = $state('Unknown');
	let currentSsid = $state('');
	let currentSignalBars = $state<1 | 2 | 3 | 4>(4);
	let availableNetworks = $state<NetworkInfo[]>([]);
	let isScanning = $state(false);
	let error = $state<string | null>(null);

	let showPasswordDialog = $state(false);
	let selectedNetwork = $state<NetworkInfo | null>(null);
	let networkPassword = $state('');
	let showPassword = $state(false);
	let connecting = $state(false);
	let dialogError = $state('');

	let showHiddenDialog = $state(false);
	let hiddenSSID = $state('');
	let hiddenPassword = $state('');
	let showHiddenPassword = $state(false);

	const isWired = $derived(connectionType.toLowerCase() !== 'wifi');

	function isNetworkSecured(security: string) {
		return security !== '' && security !== 'Open';
	}

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

	function convertToNetworkInfo(network: WiFiNetwork, current: string | null): NetworkInfo {
		return {
			...network,
			current: network.ssid === current,
			signal: signalBars(network.signal_strength),
			secured: isNetworkSecured(network.security)
		};
	}

	async function updateNetworkStatus() {
		try {
			error = null;
			const status: NetworkStatus = await networkAPI.getNetworkStatus();
			isConnected = status.adapter.state === 'connected';
			ipAddress = status.ip.ipv4 || 'Unknown';
			connectionType = status.adapter.type || 'wifi';
			currentSsid = status.signal_info.current_ssid || '';
			currentSignalBars = signalBars(status.signal_info.current_connection_signal);
		} catch (err) {
			error = err instanceof NetworkAPIError ? err.message : 'Failed to update network status';
		}
	}

	async function scanNetworks() {
		try {
			isScanning = true;
			error = null;
			const result = await networkAPI.scanNetworks();
			availableNetworks = result.networks.map((network) => convertToNetworkInfo(network, currentSsid));
		} catch (err) {
			error = err instanceof NetworkAPIError ? err.message : 'Failed to scan for networks';
		} finally {
			isScanning = false;
		}
	}

	onMount(() => {
		updateNetworkStatus();
		scanNetworks();
		const interval = setInterval(updateNetworkStatus, STATUS_POLL_INTERVAL_MS);
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

	async function connectToNetwork(ssid: string, password: string) {
		try {
			connecting = true;
			dialogError = '';
			const result = await networkAPI.connectToNetwork({ ssid, password: password || null });
			if (!result.success) {
				dialogError = result.message || 'Failed to connect to network';
				return;
			}
			await updateNetworkStatus();
			await scanNetworks();
			closeDialogs();
		} catch (err) {
			dialogError = err instanceof NetworkAPIError ? err.message : 'Failed to connect to network';
		} finally {
			connecting = false;
		}
	}
</script>

<section class="network-page">
	<div class="network-card">
		<header class="page-header">
			<span class="header-icon" aria-hidden="true"><Wifi /></span>
			<h1>Network</h1>
		</header>

		<div class="status-banner {isWired ? 'wired' : isConnected ? 'connected' : 'disconnected'}">
			<span class="banner-icon">
				{#if isWired}
					<EthernetPort />
				{:else}
					{@const SignalIcon = wifiIconFor(isConnected ? currentSignalBars : 4)}
					<SignalIcon />
				{/if}
			</span>
			<div class="banner-text">
				{#if isWired}
					<strong>Wired</strong>
					<span class="ip">IP: {ipAddress}</span>
				{:else if isConnected}
					<strong>{currentSsid || 'Connected'}</strong>
					<span class="ip">IP: {ipAddress}</span>
					<strong class="signal-label">{signalLabel(currentSignalBars)} Signal</strong>
				{:else}
					<strong>Disconnected</strong>
					<span class="ip">IP: ???</span>
				{/if}
			</div>
		</div>

		{#if error}
			<div class="error-box">{error}</div>
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
					Connect
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
					Connect
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
	.error-box {
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
