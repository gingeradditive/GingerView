<script lang="ts">
	import { onMount } from 'svelte';
	import { Wifi, WifiOff, RefreshCw, Settings, X } from 'lucide-svelte';
	import { networkAPI, NetworkAPIError } from '$lib/services/network-api';
	import type { WiFiNetwork, NetworkStatus } from '$lib/types/wifi';

	interface NetworkInfo extends WiFiNetwork {
		current: boolean;
		signal: number; // 1-4 bars converted from signal_strength
		secured: boolean; // derived from security field
	}

	let networkManager = $state({
		isOnline: navigator.onLine,
		connectionType: 'wifi',
		signalStrength: 4,
		ipAddress: '192.168.1.100',
		isConnected: true,
		availableNetworks: [] as NetworkInfo[],
		currentNetwork: 'MyWiFiNetwork',
		isScanning: false,
		error: null as string | null,
		lastUpdated: new Date()
	});

	let showDetails = $state(false);
	let showNetworkList = $state(false);
	let isRefreshing = $state(false);
	let selectedNetwork = $state<string>('');
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

	// Convert WiFiNetwork to NetworkInfo and calculate signal bars
	function convertToNetworkInfo(network: WiFiNetwork, currentNetwork: string | null): NetworkInfo {
		// Signal strength is already a percentage (0-100), convert to 1-4 bars
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
			networkManager.signalStrength = Math.ceil(status.signal_info.current_connection_signal / 25);
			networkManager.lastUpdated = new Date();
		} catch (error) {
			console.error('Failed to update network status:', error);
			networkManager.error = error instanceof NetworkAPIError ? error.message : 'Failed to update network status';
			// Keep existing values on error, but mark as disconnected
			networkManager.isOnline = navigator.onLine;
		}
	}

	async function scanNetworks() {
		try {
			networkManager.isScanning = true;
			networkManager.error = null;
			
			const scanResult = await networkAPI.scanNetworks();
			const networks = scanResult.networks.map(network => 
				convertToNetworkInfo(network, networkManager.currentNetwork)
			);
			
			networkManager.availableNetworks = networks;
		} catch (error) {
			console.error('Failed to scan networks:', error);
			networkManager.error = error instanceof NetworkAPIError ? error.message : 'Failed to scan for networks';
			// Keep existing networks on error
		} finally {
			networkManager.isScanning = false;
		}
	}

	async function connectToNetwork(ssid: string, password?: string) {
		try {
			networkManager.error = null;
			const result = await networkAPI.connectToNetwork({
				ssid,
				password: password || null
			});

			if (result.success) {
				await updateNetworkStatus();
				showPasswordDialog = false;
				networkPassword = '';
				hiddenSSID = '';
				selectedNetwork = '';
			} else {
				networkManager.error = result.message || 'Failed to connect to network';
			}
		} catch (error) {
			console.error('Failed to connect to network:', error);
			networkManager.error = error instanceof NetworkAPIError ? error.message : 'Failed to connect to network';
		}
	}

	async function disconnectNetwork() {
		try {
			networkManager.error = null;
			await networkAPI.disconnectNetwork();
			await updateNetworkStatus();
		} catch (error) {
			console.error('Failed to disconnect from network:', error);
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
		} else {
			const network = networkManager.availableNetworks.find(n => n.ssid === ssid);
			if (network) {
				selectedNetwork = ssid;
				if (network.secured) {
					showPasswordDialog = true;
				} else {
					connectToNetwork(ssid);
				}
			}
		}
	}

	function cancelConnection() {
		showPasswordDialog = false;
		selectedNetwork = '';
		networkPassword = '';
		hiddenSSID = '';
	}

	// TODO: Remove these functions once backend is implemented
	async function getLocalIP(): Promise<string> {
		// Try multiple methods to get local IP
		const methods = [
			// Method 1: WebRTC (most reliable)
			() => getWebRTCIP(),
			// Method 2: Try to fetch from local network service
			() => fetchLocalIP(),
			// Method 3: Use browser network info if available
			() => getBrowserNetworkInfo()
		];

		for (const method of methods) {
			try {
				const ip = await method();
				if (ip && ip !== 'Unknown' && !ip.startsWith('127.') && !ip.startsWith('169.254.')) {
					return ip;
				}
			} catch (error) {
				console.log('Method failed:', error);
				continue;
			}
		}

		throw new Error('All methods failed');
	}

	async function getWebRTCIP(): Promise<string> {
		return new Promise((resolve, reject) => {
			const rtc = new RTCPeerConnection({ 
				iceServers: [
					{ urls: 'stun:stun.l.google.com:19302' }
				]
			});
			rtc.createDataChannel('');
			
			let resolved = false;
			
			rtc.onicecandidate = (event) => {
				if (event.candidate && !resolved) {
					const candidate = event.candidate.candidate;
					const match = candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
					if (match && !match[0].startsWith('127.') && !match[0].startsWith('169.254.')) {
						resolved = true;
						resolve(match[0]);
						rtc.close();
					}
				}
			};
			
			rtc.createOffer()
				.then(offer => rtc.setLocalDescription(offer))
				.catch(reject);
			
			setTimeout(() => {
				if (!resolved) {
					rtc.close();
					reject(new Error('WebRTC timeout'));
				}
			}, 3000);
		});
	}

	async function fetchLocalIP(): Promise<string> {
		try {
			// Try to fetch from a local service that might return local IP
			const response = await fetch('http://localhost:8080/ip', {
				signal: AbortSignal.timeout(1000)
			});
			if (response.ok) {
				const text = await response.text();
				const ipMatch = text.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
				if (ipMatch) return ipMatch[0];
			}
		} catch {
			// Local service not available, continue
		}
		throw new Error('Local fetch failed');
	}

	async function getBrowserNetworkInfo(): Promise<string> {
		// Try to get network info from browser APIs
		if ('connection' in navigator) {
			const connection = (navigator as any).connection;
			// Some browsers might provide network interface info
			if (connection.type) {
				// Map connection type to typical IP ranges
				switch (connection.type) {
					case 'wifi':
						return '192.168.1.x'; // Common WiFi range
					case 'ethernet':
						return '192.168.0.x'; // Common ethernet range
					default:
						return '192.168.x.x'; // Generic local range
				}
			}
		}
		throw new Error('No browser network info');
	}

	async function refreshStatus() {
		isRefreshing = true;
		await updateNetworkStatus();
		setTimeout(() => {
			isRefreshing = false;
		}, 1000);
	}

	function getNetworkIcon() {
		if (!networkManager.isOnline || !networkManager.isConnected) {
			return WifiOff;
		}
		
		// Return WiFi icon based on signal strength
		const signalBars = getSignalBars();
		if (signalBars === 0) return WifiOff;
		
		return Wifi; // Always return Wifi for connected status
	}

	function getWifiSignalIcon() {
		const signalBars = getSignalBars();
		return Wifi; // Always return Wifi, we'll style it differently based on signal
	}

	function getSignalColorFromBars(bars: number): string {
		if (bars === 0) return 'text-gray-400';
		if (bars === 1) return 'text-red-500';
		if (bars === 2) return 'text-yellow-500';
		if (bars === 3) return 'text-green-500';
		if (bars === 4) return 'text-green-600';
		return 'text-gray-400';
	}

	function getSignalColor() {
		const signalBars = getSignalBars();
		if (signalBars === 0) return 'text-gray-400';
		if (signalBars === 1) return 'text-red-500';
		if (signalBars === 2) return 'text-yellow-500';
		if (signalBars === 3) return 'text-green-500';
		if (signalBars === 4) return 'text-green-600';
		return 'text-gray-400';
	}

	function getNetworkInterface() {
		// Detect network interface based on platform and connection
		const userAgent = navigator.userAgent;
		
		// On macOS, WiFi is typically en0, ethernet is en1, etc.
		if (userAgent.includes('Mac')) {
			return networkManager.connectionType.includes('ethernet') ? 'en1' : 'en0';
		}
		
		// On Raspberry Pi/Linux, WiFi is typically wlan0, ethernet is eth0
		if (userAgent.includes('Linux') || !userAgent.includes('Windows')) {
			return networkManager.connectionType.includes('ethernet') ? 'eth0' : 'wlan0';
		}
		
		// Windows fallback
		return networkManager.connectionType.includes('ethernet') ? 'Ethernet' : 'Wi-Fi';
	}

	function getSignalBars(): 0 | 1 | 2 | 3 | 4 {
		if (!networkManager.isOnline || !networkManager.isConnected) return 0;
		// For WiFi/ethernet, always return good signal (3-4 bars) since we can't easily measure it
		return 4;
	}
</script>

<div class="fixed bottom-4 left-4 z-40">
	<div class="relative">
		<!-- Main button -->
		<button
			class="bg-white hover:bg-gray-100 text-gray-700 p-3 rounded-full shadow-lg transition-colors duration-200 flex items-center justify-center"
			onclick={() => showDetails = !showDetails}
			title="Network Status"
		>
			<div class="flex items-center space-x-2">
				{#if getNetworkIcon() === WifiOff}
					<WifiOff class="w-5 h-5 text-gray-400" />
				{:else}
					<Wifi class={`w-5 h-5 ${getSignalColor()}`} />
				{/if}
			</div>
		</button>

		<!-- Main Details Popup -->
		{#if showDetails}
			<div
				class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
				role="dialog"
				aria-modal="true"
				aria-labelledby="network-status-title"
				onclick={() => showDetails = false}
			>
				<div
					class="bg-white rounded-lg shadow-2xl w-full max-w-md flex flex-col border border-gray-200"
					role="document"
					onclick={(e) => e.stopPropagation()}
				>
					<!-- Header -->
					<div class="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
						<h3 id="network-status-title" class="text-lg font-semibold text-gray-900 flex items-center space-x-2">
							<Settings class="w-5 h-5 text-blue-600" />
							<span>Network Status</span>
						</h3>
						<button
							onclick={() => showDetails = false}
							class="p-2 hover:bg-gray-100 rounded-full transition-colors"
						>
							<X class="w-4 h-4" />
						</button>
					</div>

					<!-- Status Content -->
					<div class="p-4 space-y-4">
						<!-- Error Display -->
						{#if networkManager.error}
							<div class="p-3 bg-red-50 border border-red-200 rounded-lg">
								<div class="flex items-start space-x-2">
									<div class="w-4 h-4 text-red-500 mt-0.5">⚠️</div>
									<div class="flex-1">
										<div class="text-sm font-medium text-red-800">Error</div>
										<div class="text-sm text-red-600">{networkManager.error}</div>
									</div>
								</div>
							</div>
						{/if}
						
						<!-- IP Address -->
						<div class="p-3 bg-gray-50 rounded-lg">
							<div class="text-sm text-gray-600 mb-1">IP Address</div>
							<div class="font-mono text-lg">{networkManager.ipAddress}</div>
						</div>
						
						<!-- Current Network -->
						<div class="p-3 bg-gray-50 rounded-lg">
							<div class="text-sm text-gray-600 mb-1">Current Network</div>
							<div class="font-medium text-lg">{networkManager.currentNetwork || 'Not connected'}</div>
						</div>
						
						<!-- Connection Status -->
						<div class="p-3 bg-gray-50 rounded-lg">
							<div class="text-sm text-gray-600 mb-1">Connection Status</div>
							<div class="flex items-center space-x-2">
								<div class="w-3 h-3 rounded-full {networkManager.isOnline && networkManager.isConnected ? 'bg-green-500' : 'bg-red-500'}"></div>
								<span class="font-medium text-lg {networkManager.isOnline && networkManager.isConnected ? 'text-green-600' : 'text-red-600'}">
									{networkManager.isOnline && networkManager.isConnected ? 'Connected' : 'Disconnected'}
								</span>
							</div>
						</div>
						
						<!-- Connection Type -->
						<div class="p-3 bg-gray-50 rounded-lg">
							<div class="text-sm text-gray-600 mb-1">Connection Type</div>
							<div class="flex items-center space-x-2">
								{#if networkManager.connectionType === 'wifi'}
									<Wifi class="w-5 h-5 text-blue-600" />
								{:else}
									<div class="w-5 h-5 bg-gray-400 rounded"></div>
								{/if}
								<span class="font-medium capitalize text-lg">{networkManager.connectionType}</span>
							</div>
						</div>
					</div>

					<!-- Actions -->
					<div class="flex justify-between items-center p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
						<div class="text-xs text-gray-500">
							Last updated: {networkManager.lastUpdated.toLocaleTimeString()}
						</div>
						<div class="flex space-x-2">
							{#if networkManager.error}
								<button
									onclick={() => networkManager.error = null}
									class="px-3 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
								>
									Clear Error
								</button>
							{/if}
							<button
								onclick={openNetworkSelection}
								class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex items-center space-x-2"
							>
								<Wifi class="w-4 h-4" />
								<span>Change Network</span>
							</button>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Network Selection Popup -->
		{#if showNetworkList}
			<div
				class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
				role="dialog"
				aria-modal="true"
				aria-labelledby="network-list-title"
				onclick={() => showNetworkList = false}
			>
				<div
					class="bg-white rounded-lg shadow-2xl w-full max-w-md flex flex-col border border-gray-200"
					role="document"
					onclick={(e) => e.stopPropagation()}
				>
					<!-- Header -->
					<div class="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
						<h3 id="network-list-title" class="text-lg font-semibold text-gray-900 flex items-center space-x-2">
							<Wifi class="w-5 h-5 text-blue-600" />
							<span>Select Network</span>
						</h3>
						<button
							onclick={() => showNetworkList = false}
							class="p-2 hover:bg-gray-100 rounded-full transition-colors"
						>
							<X class="w-4 h-4" />
						</button>
					</div>

					<!-- Network List -->
					<div class="p-4">
						<!-- Error Display -->
						{#if networkManager.error}
							<div class="p-3 bg-red-50 border border-red-200 rounded-lg mb-3">
								<div class="flex items-start space-x-2">
									<div class="w-4 h-4 text-red-500 mt-0.5">⚠️</div>
									<div class="flex-1">
										<div class="text-sm font-medium text-red-800">Error</div>
										<div class="text-sm text-red-600">{networkManager.error}</div>
									</div>
								</div>
							</div>
						{/if}
						
						<div class="flex items-center justify-between mb-3">
							<div class="text-sm text-gray-600">Available Networks</div>
							<button
								onclick={scanNetworks}
								disabled={networkManager.isScanning}
								class="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded transition-colors flex items-center space-x-1"
							>
								<RefreshCw class={`w-3 h-3 ${networkManager.isScanning ? 'animate-spin' : ''}`} />
								<span>{networkManager.isScanning ? 'Scanning...' : 'Scan'}</span>
							</button>
						</div>
						
						{#if networkManager.availableNetworks.length > 0}
							<div class="space-y-2 max-h-64 overflow-y-auto">
								<!-- Hidden Network Option -->
								<div 
									class="flex items-center justify-between p-3 bg-white border rounded hover:bg-gray-50 cursor-pointer"
									onclick={() => selectNetwork('HIDDEN_NETWORK')}
								>
									<div class="flex items-center space-x-2">
										<Wifi class="w-4 h-4 text-gray-600" />
										<div>
											<div class="text-sm font-medium">Hidden Network</div>
											<div class="text-xs text-gray-500">Enter SSID manually</div>
										</div>
									</div>
									<div class="text-gray-400">
										<Settings class="w-4 h-4" />
									</div>
								</div>
								
								<!-- Available Networks -->
								{#each networkManager.availableNetworks as network}
									<div 
										class="flex items-center justify-between p-3 bg-white border rounded hover:bg-gray-50 cursor-pointer"
										onclick={() => selectNetwork(network.ssid)}
									>
										<div class="flex items-center space-x-2">
											<Wifi class={`w-4 h-4 ${getSignalColorFromBars(network.signal)}`} />
											<div>
												<div class="text-sm font-medium">{network.ssid}</div>
												<div class="text-xs text-gray-500">
													{network.secured ? '🔒 Secured' : '🔓 Open'} • {network.signal}/4 bars
												</div>
											</div>
										</div>
										{#if network.current}
											<div class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Connected</div>
										{:else}
											<div class="text-gray-400">
												<Wifi class="w-4 h-4" />
											</div>
										{/if}
									</div>
								{/each}
							</div>
						{:else if !networkManager.isScanning}
							<div class="text-sm text-gray-500 text-center py-8">
								No networks found. Click Scan to search for networks.
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<!-- Password Dialog -->
		{#if showPasswordDialog}
			<div
				class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
				role="dialog"
				aria-modal="true"
				aria-labelledby="password-dialog-title"
				onclick={cancelConnection}
			>
				<div
					class="bg-white rounded-lg shadow-2xl w-full max-w-sm flex flex-col border border-gray-200"
					role="document"
					onclick={(e) => e.stopPropagation()}
				>
					<!-- Header -->
					<div class="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
						<h3 id="password-dialog-title" class="text-lg font-semibold text-gray-900">
							{selectedNetwork === 'HIDDEN_NETWORK' ? 'Connect to Hidden Network' : 'Enter Password'}
						</h3>
						<button
							onclick={cancelConnection}
							class="p-2 hover:bg-gray-100 rounded-full transition-colors"
						>
							<X class="w-4 h-4" />
						</button>
					</div>

					<!-- Password Form -->
					<div class="p-4 space-y-4">
						{#if selectedNetwork === 'HIDDEN_NETWORK'}
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Network Name (SSID)</label>
								<input
									type="text"
									bind:value={hiddenSSID}
									placeholder="Enter network name"
									class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>
						{:else}
							<div class="text-sm text-gray-600">
								Connecting to: <strong>{selectedNetwork}</strong>
							</div>
						{/if}
						
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
							<input
								type="password"
								bind:value={networkPassword}
								placeholder="Enter network password"
								class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
						</div>
					</div>

					<!-- Actions -->
					<div class="flex justify-end space-x-2 p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
						<button
							onclick={cancelConnection}
							class="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
						>
							Cancel
						</button>
						<button
							onclick={() => connectToNetwork(
								selectedNetwork === 'HIDDEN_NETWORK' ? hiddenSSID : selectedNetwork, 
								networkPassword
							)}
							disabled={!networkPassword || (selectedNetwork === 'HIDDEN_NETWORK' && !hiddenSSID)}
							class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded transition-colors"
						>
							Connect
						</button>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
