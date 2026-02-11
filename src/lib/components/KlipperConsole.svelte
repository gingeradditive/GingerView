<script lang="ts">
	import { Terminal, X } from 'lucide-svelte';
	import { configService } from '$lib/services/config';
	import { onMount } from 'svelte';
	
	let { isOpen = $bindable(false) } = $props();
	
	let commandHistory: string[] = [];
	let outputHistory = $state<Array<{ type: 'command' | 'response' | 'error'; content: string; timestamp: Date }>>([]);
	let currentCommand = $state('');
	let terminalRef: HTMLDivElement;
	let isConnected = $state(false);
	let connectionError = $state<string>('');
	let connectionAttempts = $state(0);
	const maxConnectionAttempts = 3;
	let historyIndex = $state(-1); // -1 means not browsing history
	let tempCommand = $state(''); // Store current command when browsing history
	
	// Load configuration only on client side
	let config = $state<any>(null);
	let websocket: WebSocket | null = null;

	// Ensure config is loaded on mount
	onMount(() => {
		console.log('KlipperConsole component mounted');
		config = configService.getKlipperConfig();
		console.log('Config loaded:', config);
	});
	
	function addOutput(content: string, type: 'command' | 'response' | 'error') {
		outputHistory = [...outputHistory, { type, content, timestamp: new Date() }];
		// Auto-scroll to bottom
		setTimeout(() => {
			if (terminalRef) {
				terminalRef.scrollTop = terminalRef.scrollHeight;
			}
		}, 10);
	}
	
	function connectWebSocket() {
		if (websocket && websocket.readyState === WebSocket.OPEN) {
			console.log('Already connected');
			return;
		}

		if (!config) {
			console.log('Config not loaded, cannot connect');
			addOutput('Configuration not loaded yet', 'error');
			return;
		}

		if (connectionAttempts >= maxConnectionAttempts) {
			console.log('Max connection attempts reached');
			addOutput('Max connection attempts reached. Please check your network and Moonraker configuration.', 'error');
			return;
		}

		connectionAttempts++;
		console.log(`Connection attempt ${connectionAttempts}/${maxConnectionAttempts}`);
		
		console.log('Starting WebSocket connection to:', config.moonrakerWsUrl);
		addOutput(`Connecting to ${config.moonrakerWsUrl}... (Attempt ${connectionAttempts}/${maxConnectionAttempts})`, 'response');

		try {
			websocket = new WebSocket(config.moonrakerWsUrl!);
			console.log('WebSocket object created:', websocket);

			// Set a timeout for connection
			const connectionTimeout = setTimeout(() => {
				if (websocket?.readyState === WebSocket.CONNECTING) {
					console.log('Connection timeout');
					websocket.close();
					isConnected = false;
					connectionError = 'Connection timeout';
					addOutput('Connection timeout - check if Moonraker is running', 'error');
				}
			}, 5000);

			websocket.onopen = () => {
				console.log('WebSocket onopen event fired');
				clearTimeout(connectionTimeout);
				isConnected = true;
				connectionError = '';
				connectionAttempts = 0; // Reset attempts on successful connection
				addOutput('Connected to Moonraker', 'response');
			};

			websocket.onmessage = (event) => {
				console.log('WebSocket message received:', event.data);
				try {
					const data = JSON.parse(event.data);
					
					// Handle G-code responses
					if (data.method === 'notify_gcode_response') {
						const response = data.params?.[0] || '';
						if (response.trim()) {
							// Split multiple lines and display each
							const lines = response.split('\n').filter((line: string) => line.trim());
							
							lines.forEach((line: string) => {
								const trimmedLine = line.trim();
								
								// Completely skip "ok" responses
								if (trimmedLine === 'ok') {
									return;
								}
								
								// Remove comment prefixes for cleaner display
								const cleanLine = line.replace(/^\/\/\s*/, '').replace(/^;\s*/, '');
								if (cleanLine.trim()) {
									addOutput(cleanLine, 'response');
								}
							});
						}
					}
					// Handle JSON-RPC responses
					else if (data.result) {
						if (data.result === 'ok') {
							// Skip "ok" responses completely
							return;
						}
						if (typeof data.result === 'string') {
							addOutput(data.result, 'response');
						}
					}
					// Handle other notifications (don't spam the console)
					else if (data.method && data.method !== 'notify_proc_stat_update' && data.method !== 'notify_gcode_response') {
						addOutput(`Notification: ${data.method}`, 'response');
					}
					// Handle error responses
					else if (data.error) {
						addOutput(`Error: ${data.error.message}`, 'error');
					}
				} catch (error) {
					addOutput(`Received: ${event.data}`, 'response');
				}
			};

			websocket.onerror = (error) => {
				console.error('WebSocket error event:', error);
				clearTimeout(connectionTimeout);
				isConnected = false;
				connectionError = 'WebSocket connection error';
				addOutput('WebSocket connection error - check network and firewall', 'error');
			};

			websocket.onclose = (event) => {
				console.log('WebSocket close event:', event.code, event.reason);
				clearTimeout(connectionTimeout);
				isConnected = false;
				// Only show error for abnormal closures
				if (event.code !== 1000 && event.code !== 1006) {
					addOutput(`Disconnected from Moonraker (Code: ${event.code}) - ${event.reason || 'Unknown reason'}`, 'error');
				}
			};
		} catch (error) {
			console.error('Failed to create WebSocket:', error);
			isConnected = false;
			connectionError = 'Failed to create WebSocket connection';
			addOutput('Failed to create WebSocket connection - check URL format', 'error');
		}
	}

	function disconnectWebSocket() {
		if (websocket) {
			websocket.close();
			websocket = null;
		}
		isConnected = false;
		connectionAttempts = 0; // Reset attempts when manually disconnecting
	}

	async function sendCommand() {
		console.log('sendCommand called, currentCommand:', currentCommand);
		console.log('isConnected:', isConnected);
		console.log('websocket state:', websocket?.readyState);
		
		if (!currentCommand.trim()) return;
		
		if (!isConnected) {
			console.log('Cannot send command - not connected');
			addOutput('Not connected to Moonraker', 'error');
			return;
		}

		addOutput(currentCommand, 'command');
		
		// Add to history (avoid duplicates)
		if (!commandHistory.includes(currentCommand)) {
			commandHistory = [...commandHistory, currentCommand];
		}
		
		// Reset history browsing
		historyIndex = -1;
		tempCommand = '';

		try {
			const message = {
				jsonrpc: "2.0",
				method: "printer.gcode.script",
				params: {
					script: currentCommand
				},
				id: Date.now()
			};

			console.log('Sending command:', message);
			websocket!.send(JSON.stringify(message));
			console.log('Command sent successfully');
		} catch (error) {
			console.error('Failed to send command:', error);
			addOutput('Failed to send command', 'error');
		}

		currentCommand = '';
	}
	
	// Connect when console opens
	$effect(() => {
		console.log('isOpen changed:', isOpen);
		if (isOpen && config && !isConnected && connectionAttempts === 0) {
			console.log('Console is opening, connecting WebSocket');
			connectWebSocket();
		} else if (!isOpen && websocket) {
			console.log('Console is closing, disconnecting WebSocket');
			disconnectWebSocket();
		}
	});

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendCommand();
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			navigateHistory(1); // Up arrow = newer commands
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			navigateHistory(-1); // Down arrow = older commands
		}
	}
	
	function navigateHistory(direction: number) {
		if (commandHistory.length === 0) return;
		
		// Save current command if we're just starting to browse history
		if (historyIndex === -1) {
			tempCommand = currentCommand;
		}
		
		// Calculate new index
		let newIndex = historyIndex + direction;
		
		// Handle boundaries
		if (newIndex < -1) {
			newIndex = -1;
		} else if (newIndex >= commandHistory.length) {
			newIndex = commandHistory.length - 1;
		}
		
		historyIndex = newIndex;
		
		// Update current command based on index
		if (historyIndex === -1) {
			// Return to the command we were typing before browsing history
			currentCommand = tempCommand;
		} else {
			// Show command from history
			currentCommand = commandHistory[commandHistory.length - 1 - historyIndex];
		}
	}
	
	function clearTerminal() {
		outputHistory = [];
	}
	
	function manualReconnect() {
		console.log('Manual reconnect requested');
		connectionAttempts = 0;
		isConnected = false;
		connectionError = '';
		if (websocket) {
			websocket.close();
			websocket = null;
		}
		connectWebSocket();
	}
	
	function closeModal() {
		console.log('Closing modal');
		isOpen = false;
		connectionAttempts = 0; // Reset attempts when closing
	}
</script>

<!-- Floating Console Button -->
<button
	type="button"
	onclick={() => {
		console.log('Opening console');
		isOpen = true;
	}}
	class="fixed bottom-4 right-4 z-40 bg-white hover:bg-gray-100 text-gray-700 p-3 rounded-full shadow-lg transition-colors duration-200 flex items-center justify-center"
	title="Open Klipper Console"
>
	<Terminal class="w-5 h-5" />
</button>

<!-- Console Popup -->
{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
		role="dialog"
		aria-modal="true"
		aria-labelledby="console-title"
		onclick={closeModal}
	>
		<div
			class="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col border border-gray-200 relative z-[60]"
			role="document"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Header -->
			<div class="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
				<div class="flex items-center gap-3">
					<Terminal class="w-5 h-5 text-blue-600" />
					<h2 id="console-title" class="text-lg font-semibold text-gray-900">{config?.printerName || 'Klipper Console'}</h2>
					<div class="flex items-center gap-2">
						<div class="w-2 h-2 rounded-full {isConnected ? 'bg-green-500' : 'bg-red-500'}"></div>
						<span class="text-sm text-gray-600">{isConnected ? 'Connected' : 'Disconnected'}</span>
					</div>
				</div>
				<div class="flex items-center gap-2">
					{#if !isConnected}
						<button
							onclick={manualReconnect}
							class="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors"
						>
							Reconnect
						</button>
					{/if}
					<button
						onclick={clearTerminal}
						class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
					>
						Clear
					</button>
					<button
						onclick={closeModal}
						class="p-1 text-gray-400 hover:text-gray-600 transition-colors"
					>
						<X class="w-5 h-5" />
					</button>
				</div>
			</div>
			
			<!-- Terminal Output -->
			<div
				bind:this={terminalRef}
				class="flex-1 p-4 overflow-y-auto font-mono text-sm bg-gray-50"
			>
				{#each outputHistory as entry}
					<div class="mb-1">
						<span class="text-gray-500 text-xs">
							{entry.timestamp.toLocaleTimeString()}
						</span>
						{#if entry.type === 'command'}
							<span class="text-blue-600 ml-2 font-semibold">&gt; {entry.content}</span>
						{:else if entry.type === 'response'}
							<span class="text-gray-700 ml-2">{entry.content}</span>
						{:else if entry.type === 'error'}
							<span class="text-red-600 ml-2">{entry.content}</span>
						{/if}
					</div>
				{/each}
			</div>
			
			<!-- Command Input -->
			<div class="p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
				<div class="flex items-center gap-2">
					<span class="text-blue-600 font-mono font-semibold">&gt;</span>
					<input
						type="text"
						bind:value={currentCommand}
						onkeydown={handleKeydown}
						placeholder="Enter Klipper command..."
						class="flex-1 bg-white border border-gray-300 text-gray-900 px-3 py-2 rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					/>
					<button
						onclick={sendCommand}
						disabled={!currentCommand.trim()}
						class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded transition-colors"
					>
						Send
					</button>
				</div>
				<div class="mt-2 text-xs text-gray-500">
					Press Enter to send • {config ? `Connected to ${config.moonrakerHost}:${config.moonrakerPort}` : 'Loading configuration...'}
					{#if historyIndex >= 0}
						• History: {historyIndex + 1}/{commandHistory.length}
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
