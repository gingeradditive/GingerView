<script lang="ts">
	import { Terminal, RotateCcw, Trash2, X } from 'lucide-svelte';
	import { configService } from '$lib/services/config';
	import { onMount } from 'svelte';

	let { isOpen = $bindable(false), embedded = false } = $props<{ isOpen?: boolean; embedded?: boolean }>();

	let commandHistory: string[] = [];
	let outputHistory = $state<Array<{ type: 'command' | 'response' | 'error'; content: string; timestamp: Date }>>([]);
	let currentCommand = $state('');
	let terminalRef: HTMLDivElement;
	let isConnected = $state(false);
	let connectionError = $state('');
	let connectionAttempts = $state(0);
	const maxConnectionAttempts = 3;
	let historyIndex = $state(-1);
	let tempCommand = $state('');
	let config = $state<any>(null);
	let websocket: WebSocket | null = null;
	let isConnecting = $state(false);

	onMount(() => {
		config = configService.getKlipperConfig();
		if (embedded && config) {
			connectWebSocket();
		}
		return () => disconnectWebSocket();
	});

	$effect(() => {
		if (embedded || !config) return;
		if (isOpen && !isConnected && !isConnecting && connectionAttempts === 0) {
			connectWebSocket();
		} else if (!isOpen && websocket) {
			disconnectWebSocket();
		}
	});

	function addOutput(content: string, type: 'command' | 'response' | 'error') {
		outputHistory = [...outputHistory, { type, content, timestamp: new Date() }];
		setTimeout(() => {
			if (terminalRef) terminalRef.scrollTop = terminalRef.scrollHeight;
		}, 10);
	}

	function connectWebSocket() {
		if (!config || (websocket && websocket.readyState === WebSocket.OPEN) || isConnecting) return;
		if (connectionAttempts >= maxConnectionAttempts) {
			addOutput('Max connection attempts reached. Check Moonraker configuration.', 'error');
			return;
		}

		connectionAttempts++;
		isConnecting = true;
		addOutput(`Connecting to ${config.moonrakerWsUrl}...`, 'response');

		try {
			websocket = new WebSocket(config.moonrakerWsUrl!);
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
			};

			websocket.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					if (data.method === 'notify_gcode_response') {
						const response = data.params?.[0] || '';
						const lines = response.split('\n').filter((line: string) => line.trim() && line.trim() !== 'ok');
						lines.forEach((line: string) => {
							const cleanLine = line.replace(/^\/\/\s*/, '').replace(/^;\s*/, '');
							if (cleanLine.trim()) addOutput(cleanLine, 'response');
						});
					} else if (typeof data.result === 'string' && data.result !== 'ok') {
						addOutput(data.result, 'response');
					} else if (data.error?.message) {
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
			};

			websocket.onclose = (event) => {
				clearTimeout(timeout);
				isConnecting = false;
				isConnected = false;
				if (event.code !== 1000) addOutput('Disconnected from Moonraker', 'error');
			};
		} catch {
			isConnecting = false;
			isConnected = false;
			connectionError = 'Failed to create WebSocket connection';
			addOutput('Failed to create WebSocket connection', 'error');
		}
	}

	function disconnectWebSocket() {
		if (websocket) websocket.close();
		websocket = null;
		isConnecting = false;
		isConnected = false;
		connectionAttempts = 0;
	}

	function sendCommand() {
		if (!currentCommand.trim()) return;
		if (!isConnected || !websocket) {
			addOutput('Not connected to Moonraker', 'error');
			return;
		}

		addOutput(currentCommand, 'command');
		if (!commandHistory.includes(currentCommand)) commandHistory = [...commandHistory, currentCommand];
		historyIndex = -1;
		tempCommand = '';

		try {
			websocket.send(
				JSON.stringify({
					jsonrpc: '2.0',
					method: 'printer.gcode.script',
					params: { script: currentCommand },
					id: Date.now()
				})
			);
		} catch {
			addOutput('Failed to send command', 'error');
		}

		currentCommand = '';
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendCommand();
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			navigateHistory(1);
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			navigateHistory(-1);
		}
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

	function clearTerminal() {
		outputHistory = [];
	}

	function manualReconnect() {
		disconnectWebSocket();
		connectionError = '';
		connectWebSocket();
	}

	function closeConsole() {
		if (!embedded) isOpen = false;
	}
</script>

{#if !embedded}
	<button type="button" onclick={() => (isOpen = true)} class="trigger-btn" title="Open Klipper Console">
		<Terminal class="icon" />
		<span>Apri Console</span>
	</button>
{/if}

{#if embedded}
	<div class="console-shell">
		<div class="console-panel">
			<div class="panel-header">
				<div class="head-left">
					<Terminal class="icon red" />
					<h3>{config?.printerName || 'Klipper Console'}</h3>
					<span class="state {isConnected ? 'connected' : 'disconnected'}">{isConnected ? 'Connected' : 'Disconnected'}</span>
				</div>
				<div class="head-actions">
					{#if !isConnected}
						<button type="button" class="icon-btn" onclick={manualReconnect} aria-label="Reconnect">
							<RotateCcw class="icon-sm" />
						</button>
					{/if}
					<button type="button" class="icon-btn" onclick={clearTerminal} aria-label="Clear terminal">
						<Trash2 class="icon-sm" />
					</button>
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
			<div class="terminal-input">
				<span class="prompt">&gt;</span>
				<input type="text" bind:value={currentCommand} onkeydown={handleKeydown} placeholder="Enter Klipper command..." />
				<button type="button" class="send-btn" onclick={sendCommand} disabled={!currentCommand.trim()}>Send</button>
			</div>
			<div class="footer">
				{config ? `Moonraker ${config.moonrakerHost}:${config.moonrakerPort}` : 'Loading configuration...'}
				{#if connectionError}
					<span>• {connectionError}</span>
				{/if}
			</div>
		</div>
	</div>
{:else if isOpen}
	<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="console-title" tabindex="0" onkeydown={(e) => e.key === 'Escape' && closeConsole()} onclick={(e) => e.target === e.currentTarget && closeConsole()}>
		<div class="console-panel popup">
			<div class="panel-header">
				<div class="head-left">
					<Terminal class="icon red" />
					<h3 id="console-title">{config?.printerName || 'Klipper Console'}</h3>
					<span class="state {isConnected ? 'connected' : 'disconnected'}">{isConnected ? 'Connected' : 'Disconnected'}</span>
				</div>
				<div class="head-actions">
					{#if !isConnected}
						<button type="button" class="icon-btn" onclick={manualReconnect} aria-label="Reconnect">
							<RotateCcw class="icon-sm" />
						</button>
					{/if}
					<button type="button" class="icon-btn" onclick={clearTerminal} aria-label="Clear terminal">
						<Trash2 class="icon-sm" />
					</button>
					<button type="button" class="icon-btn" onclick={closeConsole} aria-label="Close console">
						<X class="icon-sm" />
					</button>
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
			<div class="terminal-input">
				<span class="prompt">&gt;</span>
				<input type="text" bind:value={currentCommand} onkeydown={handleKeydown} placeholder="Enter Klipper command..." />
				<button type="button" class="send-btn" onclick={sendCommand} disabled={!currentCommand.trim()}>Send</button>
			</div>
			<div class="footer">
				{config ? `Moonraker ${config.moonrakerHost}:${config.moonrakerPort}` : 'Loading configuration...'}
				{#if connectionError}
					<span>• {connectionError}</span>
				{/if}
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
	.console-shell { width: 100%; }
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
	.console-panel {
		display: flex;
		flex-direction: column;
		border: 1px solid #d8d8d8;
		border-radius: 14px;
		background: #fff;
		overflow: hidden;
	}
	.console-panel.popup {
		width: min(980px, calc(100vw - 32px));
		max-height: calc(100vh - 64px);
	}
	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		padding: 12px 14px;
		border-bottom: 1px solid #ececec;
		background: #fff;
	}
	.head-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
	.head-left h3 { margin: 0; font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.state { font-size: 0.75rem; border-radius: 999px; padding: 2px 8px; border: 1px solid; }
	.state.connected { color: #1a7f37; background: #e8f5e9; border-color: #c8e6c9; }
	.state.disconnected { color: #c62828; background: #ffebee; border-color: #ffcdd2; }
	.head-actions { display: flex; gap: 8px; }
	.icon-btn {
		width: 30px;
		height: 30px;
		border: 1px solid #d8d8d8;
		border-radius: 8px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: #fff;
		color: #555;
	}
	.terminal-output {
		min-height: 280px;
		max-height: 46vh;
		overflow-y: auto;
		padding: 12px 14px;
		background: #fafafa;
		border-bottom: 1px solid #ececec;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.84rem;
	}
	.line { margin-bottom: 4px; }
	.time { color: #888; margin-right: 8px; font-size: 0.72rem; }
	.cmd { color: #d72e28; font-weight: 600; }
	.res { color: #2e2e2e; }
	.err { color: #b71c1c; }
	.terminal-input {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 14px;
	}
	.prompt {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		color: #d72e28;
		font-weight: 700;
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
	.send-btn:disabled { opacity: 0.55; }
	.footer {
		padding: 0 14px 12px;
		color: #666;
		font-size: 0.74rem;
	}
	.icon { width: 18px; height: 18px; }
	.icon-sm { width: 16px; height: 16px; }
	.red { color: #d72e28; }
</style>
