<script lang="ts">
	import { RotateCcw, Terminal, Trash2, X } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { configService } from '$lib/services/config';
	import { toastActions } from '$lib/stores/toastStore';

	let { onClose } = $props<{ onClose?: () => void }>();

	type OutputEntry = {
		type: 'command' | 'response' | 'error';
		content: string;
		timestamp: Date;
	};

	let outputHistory = $state<OutputEntry[]>([]);
	let currentCommand = $state('');
	let isConnected = $state(false);
	let isConnecting = $state(false);
	let connectionError = $state('');
	let connectionAttempts = $state(0);
	let historyIndex = $state(-1);
	let tempCommand = $state('');
	let terminalRef = $state<HTMLDivElement | null>(null);

	let websocket: WebSocket | null = null;
	let commandHistory: string[] = [];
	const maxConnectionAttempts = 3;
	const config = configService.getKlipperConfig();

	onMount(() => {
		connectWebSocket();
		return () => disconnectWebSocket();
	});

	function addOutput(content: string, type: OutputEntry['type']) {
		outputHistory = [...outputHistory, { type, content, timestamp: new Date() }];
		setTimeout(() => {
			if (terminalRef) terminalRef.scrollTop = terminalRef.scrollHeight;
		}, 10);
	}

	function connectWebSocket() {
		if (!config?.moonrakerWsUrl || (websocket && websocket.readyState === WebSocket.OPEN) || isConnecting) return;

		if (connectionAttempts >= maxConnectionAttempts) {
			addOutput('Max connection attempts reached. Check Moonraker configuration.', 'error');
			return;
		}

		connectionAttempts += 1;
		isConnecting = true;
		addOutput(`Connecting to ${config.moonrakerWsUrl}...`, 'response');

		try {
			websocket = new WebSocket(config.moonrakerWsUrl);
			const timeout = setTimeout(() => {
				if (websocket?.readyState === WebSocket.CONNECTING) websocket.close();
			}, 5000);

			websocket.onopen = () => {
				clearTimeout(timeout);
				isConnecting = false;
				isConnected = true;
				connectionError = '';
				connectionAttempts = 0;
				addOutput('Connected to Moonraker', 'response');
				toastActions.success('moonraker', 'Console connected', 'Successfully connected to Moonraker');
			};

			websocket.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					if (data.method === 'notify_gcode_response') {
						const response = data.params?.[0] || '';
						const lines = response.split('\n').filter((line: string) => line.trim() && line.trim() !== 'ok');
						for (const line of lines) {
							const cleanLine = line.replace(/^\/\/\s*/, '').replace(/^;\s*/, '').trim();
							if (cleanLine) addOutput(cleanLine, 'response');
						}
						return;
					}

					if (typeof data.result === 'string' && data.result !== 'ok') {
						addOutput(data.result, 'response');
						return;
					}

					if (data.error?.message) {
						addOutput(`Error: ${data.error.message}`, 'error');
					}
				} catch {
					addOutput(`Received: ${event.data}`, 'response');
				}
			};

			websocket.onerror = () => {
				isConnecting = false;
				isConnected = false;
				connectionError = 'WebSocket connection error';
				addOutput('WebSocket connection error', 'error');
				toastActions.error('moonraker', 'Console error', 'WebSocket connection error to Moonraker');
			};

			websocket.onclose = (event) => {
				clearTimeout(timeout);
				isConnecting = false;
				isConnected = false;
				if (event.code !== 1000) {
					addOutput('Disconnected from Moonraker', 'error');
					toastActions.warning('moonraker', 'Console disconnected', 'Lost connection to Moonraker console');
				}
			};
		} catch {
			isConnecting = false;
			isConnected = false;
			connectionError = 'Failed to create WebSocket connection';
			addOutput('Failed to create WebSocket connection', 'error');
			toastActions.error('moonraker', 'Connection failed', 'Failed to create WebSocket connection to Moonraker');
		}
	}

	function disconnectWebSocket() {
		if (websocket) websocket.close(1000);
		websocket = null;
		isConnecting = false;
		isConnected = false;
		connectionAttempts = 0;
	}

	function manualReconnect() {
		disconnectWebSocket();
		connectionError = '';
		connectWebSocket();
	}

	function clearTerminal() {
		outputHistory = [];
	}

	function sendCommand() {
		const command = currentCommand.trim();
		if (!command) return;

		if (!isConnected || !websocket) {
			addOutput('Not connected to Moonraker', 'error');
			return;
		}

		addOutput(command, 'command');
		if (!commandHistory.includes(command)) commandHistory = [...commandHistory, command];
		historyIndex = -1;
		tempCommand = '';

		try {
			websocket.send(
				JSON.stringify({
					jsonrpc: '2.0',
					method: 'printer.gcode.script',
					params: { script: command },
					id: Date.now()
				})
			);
		} catch {
			addOutput('Failed to send command', 'error');
		}

		currentCommand = '';
	}

	function navigateHistory(direction: number) {
		if (commandHistory.length === 0) return;
		if (historyIndex === -1) tempCommand = currentCommand;

		let newIndex = historyIndex + direction;
		if (newIndex < -1) newIndex = -1;
		if (newIndex >= commandHistory.length) newIndex = commandHistory.length - 1;
		historyIndex = newIndex;

		currentCommand = historyIndex === -1 ? tempCommand : commandHistory[commandHistory.length - 1 - historyIndex];
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendCommand();
			return;
		}

		if (event.key === 'ArrowUp') {
			event.preventDefault();
			navigateHistory(1);
			return;
		}

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			navigateHistory(-1);
		}
	}
</script>

<div class="console-panel">
	<div class="panel-header">
		<div class="head-left">
			<span class="title-icon" aria-hidden="true"><Terminal size={18} /></span>
			<h3>Console</h3>
			<span class="state {isConnected ? 'connected' : 'disconnected'}">{isConnected ? 'Connected' : 'Disconnected'}</span>
		</div>
	</div>

	<div bind:this={terminalRef} class="terminal-output">
		{#each outputHistory as entry}
			<div class="line">
				<span class="time">{entry.timestamp.toLocaleTimeString()}</span>
				{#if entry.type === 'command'}
					<span class="cmd">&gt; {entry.content}</span>
				{:else if entry.type === 'error'}
					<span class="err">{entry.content}</span>
				{:else}
					<span class="res">{entry.content}</span>
				{/if}
			</div>
		{/each}
	</div>

	<div class="footer">
		{#if config}
			<span>Moonraker {config.moonrakerHost}:{config.moonrakerPort}</span>
		{:else}
			<span>Moonraker configuration not available</span>
		{/if}
		{#if connectionError}
			<span>• {connectionError}</span>
		{/if}
	</div>

	<div class="terminal-input">
		<input type="text" bind:value={currentCommand} onkeydown={handleKeydown} placeholder="Enter Klipper command..." />
		<button type="button" class="send-btn" onclick={sendCommand} disabled={!currentCommand.trim()}>Send</button>
		{#if !isConnected}
			<button type="button" class="icon-btn" onclick={manualReconnect} aria-label="Reconnect">
				<RotateCcw size={16} />
			</button>
		{/if}
		<button type="button" class="icon-btn" onclick={clearTerminal} aria-label="Clear terminal">
			<Trash2 size={16} />
		</button>
	</div>	
</div>

<style>
	.console-panel {
		width: 100%;
	}
	.panel-header {
		display: flex;
		justify-content: flex-start;
		align-items: center;
		gap: 10px;
		padding: 0 0 12px 0;
		border-bottom: 1px solid #ececec;
	}
	.head-left {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}
	.title-icon {
		display: inline-flex;
		color: #d72e28;
	}
	.head-left h3 {
		margin: 0;
		font-size: 1rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.state {
		font-size: 0.75rem;
		border-radius: 999px;
		padding: 2px 8px;
		border: 1px solid;
	}
	.state.connected {
		color: #1a7f37;
		background: #e8f5e9;
		border-color: #c8e6c9;
	}
	.state.disconnected {
		color: #c62828;
		background: #ffebee;
		border-color: #ffcdd2;
	}
	.icon-btn {
		border: 1px solid #d8d8d8;
		border-radius: 8px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: #fff;
		color: #555;
		padding: 12px;
	}
	.terminal-output {
		height: 280px;
		overflow-y: auto;
		padding: 12px 0;
		border-bottom: 1px solid #ececec;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.84rem;
	}
	.line {
		margin-bottom: 4px;
		padding: 0 10px;
	}
	.time {
		color: #888;
		margin-right: 8px;
		font-size: 0.72rem;
	}
	.cmd {
		color: #d72e28;
		font-weight: 600;
	}
	.res {
		color: #2e2e2e;
	}
	.err {
		color: #b71c1c;
	}
	.terminal-input {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.terminal-input input {
		flex: 1;
		border: 1px solid #d0d0d0;
		border-radius: 9px;
		padding: 8px 10px;
		font-size: 0.9rem;
		outline: none;
	}
	.send-btn {
		border: 1px solid #d72e28;
		background: #d72e28;
		color: #fff;
		border-radius: 9px;
		padding: 8px 12px;
	}
	.send-btn:disabled {
		opacity: 0.55;
	}
	.footer {
		color: #666;
		font-size: 0.74rem;
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		padding: 12px 0;
	}
</style>
