<script lang="ts">
	import { Trash2 } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { configService } from '$lib/services/config';
	import { formatZoneTime } from '$lib/services/timezone';
	import { ensurePrinterTimezone, printerTimezone } from '$lib/stores/timezoneStore';
	import { toastActions } from '$lib/stores/toastStore';

	type OutputEntry = {
		type: 'command' | 'response' | 'error';
		content: string;
		timestamp: Date;
	};

	let outputHistory = $state<OutputEntry[]>([]);
	let currentCommand = $state('');
	let isConnected = $state(false);
	let isConnecting = $state(false);
	let connectionAttempts = $state(0);
	let historyIndex = $state(-1);
	let tempCommand = $state('');
	let terminalRef = $state<HTMLDivElement | null>(null);

	let websocket: WebSocket | null = null;
	let commandHistory: string[] = [];
	const maxConnectionAttempts = 3;
	const config = configService.getKlipperConfig();

	onMount(() => {
		ensurePrinterTimezone();
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
		if (
			!config?.moonrakerWsUrl ||
			(websocket && websocket.readyState === WebSocket.OPEN) ||
			isConnecting
		)
			return;

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
				connectionAttempts = 0;
				addOutput('Connected to Moonraker', 'response');
				toastActions.success(
					'moonraker',
					'Console connected',
					'Successfully connected to Moonraker'
				);
			};

			websocket.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					if (data.method === 'notify_gcode_response') {
						const response = data.params?.[0] || '';
						const lines = response
							.split('\n')
							.filter((line: string) => line.trim() && line.trim() !== 'ok');
						for (const line of lines) {
							const cleanLine = line
								.replace(/^\/\/\s*/, '')
								.replace(/^;\s*/, '')
								.trim();
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
				addOutput('WebSocket connection error', 'error');
				toastActions.error('moonraker', 'Console error', 'WebSocket connection error to Moonraker');
			};

			websocket.onclose = (event) => {
				clearTimeout(timeout);
				isConnecting = false;
				isConnected = false;
				if (event.code !== 1000) {
					addOutput('Disconnected from Moonraker', 'error');
					toastActions.warning(
						'moonraker',
						'Console disconnected',
						'Lost connection to Moonraker console'
					);
				}
			};
		} catch {
			isConnecting = false;
			isConnected = false;
			addOutput('Failed to create WebSocket connection', 'error');
			toastActions.error(
				'moonraker',
				'Connection failed',
				'Failed to create WebSocket connection to Moonraker'
			);
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
		if (isConnected) return;
		disconnectWebSocket();
		connectionAttempts = 0;
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

		currentCommand =
			historyIndex === -1 ? tempCommand : commandHistory[commandHistory.length - 1 - historyIndex];
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

<section class="console-page">
	<div class="console-card">
		<header class="console-header">
			<h1>Console</h1>
			<button
				type="button"
				class="status-pill {isConnected ? 'connected' : 'disconnected'}"
				onclick={manualReconnect}
				disabled={isConnected}
				title={isConnected ? 'Connected' : 'Click to reconnect'}
			>
				<span class="dot"></span>
				{isConnected ? 'Connected' : 'Disconnected'}
			</button>
		</header>

		<div bind:this={terminalRef} class="terminal-output">
			{#each outputHistory as entry}
				<div class="line">
					<!--
						Il timestamp lo mette il browser quando la riga arriva, ma quello
						che descrive è uno scambio con la stampante: si legge nel suo
						fuso, come l'ETA.
					-->
					<span class="time">{formatZoneTime($printerTimezone, entry.timestamp, true)}</span>
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

		<div class="command-row">
			<input
				type="text"
				bind:value={currentCommand}
				onkeydown={handleKeydown}
				placeholder="Enter Klipper command..."
			/>
		</div>

		<div class="actions-row">
			<button
				type="button"
				class="clear-btn"
				onclick={clearTerminal}
				aria-label="Clear console"
				title="Clear console"
			>
				<Trash2 />
			</button>
			<button type="button" class="send-btn" onclick={sendCommand} disabled={!currentCommand.trim()}
				>Send</button
			>
		</div>
	</div>
</section>

<style>
	.console-page {
		height: 100%;
		padding: 24px 24px 112px;
		box-sizing: border-box;
	}
	.console-card {
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
	.console-header {
		display: flex;
		align-items: center;
		gap: 14px;
		flex-shrink: 0;
	}
	.console-header h1 {
		margin: 0;
		font-size: 2rem;
		font-weight: 700;
		color: var(--color-text-secondary);
	}
	.status-pill {
		margin-left: auto;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		border: none;
		border-radius: 999px;
		padding: 8px 16px;
		font-size: 0.95rem;
		font-weight: 600;
		cursor: pointer;
	}
	.status-pill:disabled {
		cursor: default;
	}
	.status-pill .dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: currentColor;
	}
	.status-pill.connected {
		background: var(--color-success-bg);
		color: var(--color-success);
	}
	.status-pill.disconnected {
		background: var(--color-danger-bg);
		color: var(--color-red);
	}
	.terminal-output {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		border: 1px solid var(--color-border-light);
		border-radius: 16px;
		padding: 16px 20px;
		box-sizing: border-box;
	}
	.line {
		display: flex;
		flex-direction: column;
		margin-bottom: 12px;
		font-size: 0.95rem;
		min-width: 0;
	}
	.time {
		color: var(--color-gray-light);
		font-size: 0.85rem;
	}
	.cmd,
	.res,
	.err {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.cmd {
		color: var(--color-red);
		font-weight: 700;
	}
	.res {
		color: var(--color-text-secondary);
	}
	.err {
		color: var(--color-red);
		font-weight: 700;
	}
	.command-row {
		flex-shrink: 0;
	}
	.command-row input {
		width: 100%;
		box-sizing: border-box;
		border: 1px solid var(--color-border-light);
		background: var(--color-white);
		border-radius: 16px;
		padding: 14px 18px;
		font-size: 0.95rem;
		outline: none;
		font-family: inherit;
	}
	.actions-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-shrink: 0;
	}
	.clear-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 14px;
		background: transparent;
		color: var(--color-text-soft);
	}
	.clear-btn:hover {
		color: var(--color-red);
	}
	.send-btn {
		border: none;
		background: var(--color-red);
		color: var(--color-white);
		border-radius: 16px;
		padding: 12px 32px;
		font-size: 1rem;
		font-weight: 700;
	}
	.send-btn:disabled {
		opacity: 0.55;
	}
</style>
