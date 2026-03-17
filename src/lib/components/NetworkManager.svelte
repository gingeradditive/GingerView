<script lang="ts">
	import { onMount } from 'svelte';
	import { Wifi, WifiOff, RefreshCw, Settings, X } from 'lucide-svelte';
	import { networkAPI, NetworkAPIError } from '$lib/services/network-api';
	import type { WiFiNetwork, NetworkStatus } from '$lib/types/wifi';

	interface NetworkInfo extends WiFiNetwork {
		current: boolean;
		signal: number;
		secured: boolean;
	}

	let { embedded = false } = $props<{ embedded?: boolean }>();

	let networkManager = $state({
		isOnline: navigator.onLine,
		connectionType: 'wifi',
		ipAddress: 'Unknown',
		isConnected: false,
		availableNetworks: [] as NetworkInfo[],
		currentNetwork: 'Not connected',
		isScanning: false,
		error: null as string | null,
		lastUpdated: new Date()
	});

	let showDetails = $state(false);
	let showNetworkList = $state(false);
	let isRefreshing = $state(false);
	let selectedNetwork = $state('');
	let networkPassword = $state('');
	let hiddenSSID = $state('');
	let showPasswordDialog = $state(false);

	onMount(() => {
		updateNetworkStatus();
		const interval = setInterval(updateNetworkStatus, 5000);
		window.addEventListener('online', updateNetworkStatus);
		window.addEventListener('offline', updateNetworkStatus);
		return () => {
			clearInterval(interval);
			window.removeEventListener('online', updateNetworkStatus);
			window.removeEventListener('offline', updateNetworkStatus);
		};
	});

	function convertToNetworkInfo(network: WiFiNetwork, currentNetwork: string | null): NetworkInfo {
		const signalBars = Math.ceil(network.signal_strength / 25);
		return {
			...network,
			current: network.ssid === currentNetwork,
			signal: Math.max(1, Math.min(4, signalBars)) as 1 | 2 | 3 | 4,
			secured: network.security !== null && network.security !== '' && network.security !== 'Open'
		};
	}

	async function updateNetworkStatus() {
		try {
			networkManager.error = null;
			const status: NetworkStatus = await networkAPI.getNetworkStatus();
			networkManager.isOnline = status.adapter.state === 'connected';
			networkManager.isConnected = status.adapter.state === 'connected';
			networkManager.ipAddress = status.ip.ipv4 || 'Unknown';
			networkManager.connectionType = status.adapter.type || 'wifi';
			networkManager.currentNetwork = status.signal_info.current_ssid || 'Not connected';
			networkManager.lastUpdated = new Date();
		} catch (error) {
			networkManager.error = error instanceof NetworkAPIError ? error.message : 'Failed to update network status';
			networkManager.isOnline = navigator.onLine;
		}
	}

	async function refreshStatus() {
		isRefreshing = true;
		await updateNetworkStatus();
		setTimeout(() => (isRefreshing = false), 700);
	}

	async function scanNetworks() {
		try {
			networkManager.isScanning = true;
			networkManager.error = null;
			const scanResult = await networkAPI.scanNetworks();
			networkManager.availableNetworks = scanResult.networks.map((network) =>
				convertToNetworkInfo(network, networkManager.currentNetwork)
			);
		} catch (error) {
			networkManager.error = error instanceof NetworkAPIError ? error.message : 'Failed to scan for networks';
		} finally {
			networkManager.isScanning = false;
		}
	}

	async function connectToNetwork(ssid: string, password?: string) {
		try {
			networkManager.error = null;
			const result = await networkAPI.connectToNetwork({ ssid, password: password || null });
			if (!result.success) {
				networkManager.error = result.message || 'Failed to connect to network';
				return;
			}
			await updateNetworkStatus();
			cancelConnection();
			showNetworkList = false;
		} catch (error) {
			networkManager.error = error instanceof NetworkAPIError ? error.message : 'Failed to connect to network';
		}
	}

	async function disconnectNetwork() {
		try {
			networkManager.error = null;
			await networkAPI.disconnectNetwork();
			await updateNetworkStatus();
		} catch (error) {
			networkManager.error = error instanceof NetworkAPIError ? error.message : 'Failed to disconnect from network';
		}
	}

	function openNetworkSelection() {
		showNetworkList = true;
		scanNetworks();
	}

	function selectNetwork(ssid: string) {
		if (ssid === 'HIDDEN_NETWORK') {
			selectedNetwork = 'HIDDEN_NETWORK';
			showPasswordDialog = true;
			return;
		}
		const network = networkManager.availableNetworks.find((n) => n.ssid === ssid);
		if (!network) return;
		selectedNetwork = ssid;
		if (network.secured) {
			showPasswordDialog = true;
		} else {
			connectToNetwork(ssid);
		}
	}

	function cancelConnection() {
		showPasswordDialog = false;
		selectedNetwork = '';
		networkPassword = '';
		hiddenSSID = '';
	}

	function getStatusTone() {
		return networkManager.isOnline && networkManager.isConnected ? 'ok' : 'ko';
	}

	function closePanel() {
		showDetails = false;
	}
</script>

{#if !embedded}
	<button class="trigger-btn" type="button" onclick={() => (showDetails = true)} title="Network status">
		{#if getStatusTone() === 'ok'}
			<span class="icon red"><Wifi /></span>
		{:else}
			<span class="icon muted"><WifiOff /></span>
		{/if}
		<span>Network manager</span>
	</button>
{/if}

{#if embedded || showDetails}
	<div class="panel {embedded ? 'embedded' : ''}">
		<div class="panel-header">
			<div class="title-wrap">
				<span class="icon red"><Settings /></span>
				<h3>Network status</h3>
			</div>
			{#if !embedded}
				<button class="icon-btn" type="button" onclick={closePanel} aria-label="Close network panel">
					<span class="icon-sm"><X /></span>
				</button>
			{/if}
		</div>

		{#if networkManager.error}
			<div class="error-box">
				<strong>Error</strong>
				<p>{networkManager.error}</p>
			</div>
		{/if}

		<div class="status-grid">
			<div class="status-item">
				<span>IP address</span>
				<strong class="mono">{networkManager.ipAddress}</strong>
			</div>
			<div class="status-item">
				<span>Current network</span>
				<strong>{networkManager.currentNetwork || 'Not connected'}</strong>
			</div>
			<div class="status-item">
				<span>Status</span>
				<strong class={getStatusTone() === 'ok' ? 'ok' : 'ko'}>
					{getStatusTone() === 'ok' ? 'Connected' : 'Disconnected'}
				</strong>
			</div>
			<div class="status-item">
				<span>Connection type</span>
				<strong>{networkManager.connectionType}</strong>
			</div>
		</div>

		<div class="actions">
			<span class="updated">Updated: {networkManager.lastUpdated.toLocaleTimeString()}</span>
			<div class="actions-right">
				<button class="btn ghost" type="button" onclick={refreshStatus} disabled={isRefreshing}>
					<span class={`icon-sm ${isRefreshing ? 'spin' : ''}`}><RefreshCw /></span>
					<span>Refresh</span>
				</button>
				<button class="btn primary" type="button" onclick={openNetworkSelection}>Change network</button>
				{#if networkManager.isConnected}
					<button class="btn danger" type="button" onclick={disconnectNetwork}>Disconnect</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

{#if showNetworkList}
	<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="network-list-title" tabindex="0" onkeydown={(e) => e.key === 'Escape' && (showNetworkList = false)} onclick={(e) => e.target === e.currentTarget && (showNetworkList = false)}>
		<div class="modal" role="document">
			<div class="modal-header">
				<h4 id="network-list-title">Select network</h4>
				<button class="icon-btn" type="button" onclick={() => (showNetworkList = false)} aria-label="Close">
					<span class="icon-sm"><X /></span>
				</button>
			</div>

			<div class="modal-body">
				<div class="list-head">
					<span>Available networks</span>
					<button class="btn ghost" type="button" onclick={scanNetworks} disabled={networkManager.isScanning}>
						<span class={`icon-sm ${networkManager.isScanning ? 'spin' : ''}`}><RefreshCw /></span>
						<span>{networkManager.isScanning ? 'Scanning...' : 'Scan'}</span>
					</button>
				</div>

				<div class="network-list">
					<button class="network-row" type="button" onclick={() => selectNetwork('HIDDEN_NETWORK')}>
						<div>
							<strong>Hidden network</strong>
							<p>Manual SSID input</p>
						</div>
					</button>

					{#each networkManager.availableNetworks as network}
						<button class="network-row" type="button" onclick={() => selectNetwork(network.ssid)}>
							<div>
								<strong>{network.ssid}</strong>
								<p>{network.secured ? 'Secured' : 'Open'} · {network.signal}/4</p>
							</div>
							{#if network.current}
								<span class="badge">Connected</span>
							{/if}
						</button>
					{/each}
				</div>
			</div>
		</div>
	</div>
{/if}

{#if showPasswordDialog}
	<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="password-dialog-title" tabindex="0" onkeydown={(e) => e.key === 'Escape' && cancelConnection()} onclick={(e) => e.target === e.currentTarget && cancelConnection()}>
		<div class="modal small" role="document">
			<div class="modal-header">
				<h4 id="password-dialog-title">{selectedNetwork === 'HIDDEN_NETWORK' ? 'Connect hidden network' : 'Enter password'}</h4>
				<button class="icon-btn" type="button" onclick={cancelConnection} aria-label="Close">
					<span class="icon-sm"><X /></span>
				</button>
			</div>
			<div class="modal-body">
				{#if selectedNetwork === 'HIDDEN_NETWORK'}
					<label class="field" for="hidden-ssid">
						<span>SSID</span>
						<input id="hidden-ssid" type="text" bind:value={hiddenSSID} placeholder="Network name" />
					</label>
				{/if}
				<label class="field" for="wifi-password">
					<span>Password</span>
					<input id="wifi-password" type="password" bind:value={networkPassword} placeholder="Network password" />
				</label>
				<div class="footer-actions">
					<button class="btn ghost" type="button" onclick={cancelConnection}>Cancel</button>
					<button
						class="btn primary"
						type="button"
						onclick={() =>
							connectToNetwork(selectedNetwork === 'HIDDEN_NETWORK' ? hiddenSSID : selectedNetwork, networkPassword)}
						disabled={!networkPassword || (selectedNetwork === 'HIDDEN_NETWORK' && !hiddenSSID)}
					>
						Connect
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.trigger-btn {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		padding: 10px 14px;
		border: 1px solid #c8c8c8;
		border-radius: 10px;
		background: #fff;
		color: #111;
	}
	.panel { border: 1px solid #d8d8d8; border-radius: 14px; background: #fff; padding: 16px; }
	.panel.embedded { border: none; border-radius: 0; padding: 0; background: transparent; }
	.panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
	.title-wrap { display: flex; align-items: center; gap: 8px; }
	h3 { margin: 0; font-size: 1rem; }
	.error-box { border: 1px solid #ef9a9a; background: #fff3f3; border-radius: 10px; padding: 10px; margin-bottom: 12px; }
	.error-box p { margin: 4px 0 0; font-size: 0.85rem; }
	.status-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
	.status-item { border: 1px solid #e2e2e2; border-radius: 10px; padding: 10px; background: #fff; }
	.status-item span { display: block; font-size: 0.75rem; color: #666; margin-bottom: 4px; }
	.status-item strong { font-size: 0.92rem; }
	.status-item .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
	.ok { color: #1a7f37; }
	.ko { color: #c62828; }
	.actions { display: flex; align-items: center; justify-content: space-between; margin-top: 14px; gap: 10px; flex-wrap: wrap; }
	.actions-right { display: flex; gap: 8px; flex-wrap: wrap; }
	.updated { color: #666; font-size: 0.75rem; }
	.btn {
		border: 1px solid #c8c8c8;
		border-radius: 9px;
		padding: 8px 12px;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: #fff;
		color: #111;
	}
	.btn.primary { background: #d72e28; border-color: #d72e28; color: #fff; }
	.btn.danger { background: #6d1f1f; border-color: #6d1f1f; color: #fff; }
	.btn:disabled { opacity: 0.6; }
	.icon-btn {
		width: 30px;
		height: 30px;
		border: 1px solid #d8d8d8;
		border-radius: 8px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: #fff;
	}
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 2300;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
		background: linear-gradient(135deg, rgba(255, 255, 255, 0.35), rgba(245, 245, 245, 0.28));
		backdrop-filter: blur(10px);
	}
	.modal { width: min(520px, calc(100vw - 32px)); background: #fff; border: 1px solid #d8d8d8; border-radius: 16px; overflow: hidden; }
	.modal.small { width: min(440px, calc(100vw - 32px)); }
	.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; border-bottom: 1px solid #ececec; }
	.modal-header h4 { margin: 0; font-size: 0.96rem; }
	.modal-body { padding: 14px; }
	.list-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; gap: 8px; }
	.list-head span { font-size: 0.82rem; color: #666; }
	.network-list { display: flex; flex-direction: column; gap: 8px; max-height: 45vh; overflow-y: auto; }
	.network-row { border: 1px solid #ddd; border-radius: 10px; padding: 10px; background: #fff; display: flex; align-items: center; justify-content: space-between; text-align: left; }
	.network-row p { margin: 4px 0 0; color: #666; font-size: 0.78rem; }
	.badge { font-size: 0.72rem; color: #1a7f37; background: #e8f5e9; border-radius: 999px; padding: 2px 8px; }
	.field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
	.field span { font-size: 0.78rem; color: #555; }
	.field input {
		border: 1px solid #d0d0d0;
		border-radius: 9px;
		padding: 8px 10px;
		font-size: 0.9rem;
		outline: none;
	}
	.footer-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
	.icon { width: 18px; height: 18px; }
	.icon-sm { width: 16px; height: 16px; }
	.red { color: #d72e28; }
	.muted { color: #888; }
	.spin { animation: spin 0.9s linear infinite; }
	@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
	@media (max-width: 700px) {
		.status-grid { grid-template-columns: 1fr; }
	}
</style>
