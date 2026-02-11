<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Wifi, WifiOff, Send, Info, Loader2 } from 'lucide-svelte';
	import { klipperWebSocket } from '../services/klipper-websocket';

	let message = 'Hello World from GingerView!';
	let connectionStatus = 'Disconnected';
	let klipperInfo: any = null;

	onMount(() => {
		// Try to connect to Klipper WebSocket
		const connectPromise = klipperWebSocket.connect().catch((error) => {
			console.log('Klipper not available, running in demo mode');
		});

		// Subscribe to connection status changes
		const unsubscribeStatus = klipperWebSocket.connectionStatus.subscribe((status) => {
			connectionStatus = status.connected ? 'Connected' : 
							status.connecting ? 'Connecting...' : 
							status.error || 'Disconnected';
		});

		// Subscribe to Klipper status updates
		const unsubscribeKlipper = klipperWebSocket.klipperStatus.subscribe((status) => {
			klipperInfo = status;
		});

		return () => {
			unsubscribeStatus();
			unsubscribeKlipper();
		};
	});

	onDestroy(() => {
		klipperWebSocket.disconnect();
	});

	function sendMessage() {
		klipperWebSocket.send({
			method: 'server.info',
			id: Date.now().toString()
		});
	}

	function getStatusIcon() {
		if (connectionStatus === 'Connected') return Wifi;
		if (connectionStatus === 'Connecting...') return Loader2;
		return WifiOff;
	}

	function getStatusColor() {
		if (connectionStatus === 'Connected') return 'text-green-600';
		if (connectionStatus === 'Connecting...') return 'text-yellow-600';
		return 'text-red-600';
	}
</script>

<div class="demo-component card p-6 max-w-md mx-auto">
	<div class="flex items-center gap-3 mb-6">
		<div class="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
			<Info class="w-6 h-6 text-white" />
		</div>
		<div>
			<h2 class="text-xl font-semibold text-gray-900">GingerView Demo Component</h2>
			<p class="text-sm text-gray-600">WebSocket Klipper Interface</p>
		</div>
	</div>
	
	<div class="space-y-4">
		<div class="p-4 bg-gray-50 rounded-lg border">
			<p class="text-lg font-medium text-gray-900">{message}</p>
		</div>

		<div class="card p-4">
			<div class="flex items-center justify-between">
				<div>
					<h3 class="text-sm font-medium text-gray-600 mb-1">Connection Status</h3>
					<p class="text-lg font-medium {getStatusColor()}">{connectionStatus}</p>
				</div>
				<div class="w-8 h-8 {getStatusColor()}">
					<svelte:component this={getStatusIcon()} class="w-8 h-8" />
				</div>
			</div>
		</div>

		{#if klipperInfo}
			<div class="card p-4 bg-green-50 border-green-200">
				<div class="flex items-center gap-2 mb-3">
					<Info class="w-4 h-4 text-green-600" />
					<h3 class="text-sm font-medium text-green-800">Klipper Information</h3>
				</div>
				<pre class="text-xs text-green-700 bg-green-100 p-3 rounded overflow-auto max-h-40">{JSON.stringify(klipperInfo, null, 2)}</pre>
			</div>
		{/if}

		<button 
			on:click={sendMessage}
			class="btn btn-primary w-full h-10"
			disabled={connectionStatus !== 'Connected'}
		>
			<div class="flex items-center justify-center gap-2">
				<Send class="w-4 h-4" />
				<span>Send Test Message</span>
			</div>
		</button>
	</div>
</div>
