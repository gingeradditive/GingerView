<script lang="ts">
	import { Terminal, X } from 'lucide-svelte';
	
	let { isOpen = $bindable(false) } = $props();
	
	let commandHistory: string[] = [];
	let outputHistory = $state<Array<{ type: 'command' | 'response' | 'error'; content: string; timestamp: Date }>>([]);
	let currentCommand = $state('');
	let terminalRef: HTMLDivElement;
	let isConnected = $state(true); // Always connected
	
	// Console is always connected
	
	function addOutput(content: string, type: 'command' | 'response' | 'error') {
		outputHistory = [...outputHistory, { type, content, timestamp: new Date() }];
		// Auto-scroll to bottom
		setTimeout(() => {
			if (terminalRef) {
				terminalRef.scrollTop = terminalRef.scrollHeight;
			}
		}, 10);
	}
	
	async function sendCommand() {
		if (!currentCommand.trim()) return;
		
		// Console is always connected
		
		addOutput(currentCommand, 'command');
		commandHistory = [...commandHistory, currentCommand];
		
		// Command execution to be implemented with actual Klipper API
		
		currentCommand = '';
	}
	
	// Klipper command execution - to be implemented with actual API
	
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendCommand();
		}
	}
	
	function clearTerminal() {
		outputHistory = [];
	}
	
	function closeModal() {
		isOpen = false;
	}
</script>

<!-- Floating Console Button -->
<button
	type="button"
	onclick={() => isOpen = true}
	class="fixed bottom-4 right-4 z-40 bg-white hover:bg-gray-100 text-gray-700 p-3 rounded-full shadow-lg transition-colors duration-200 flex items-center justify-center"
	title="Open Klipper Console"
>
	<Terminal class="w-5 h-5" />
</button>

<!-- Console Popup -->
{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="console-title"
	>
		<div
			class="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col border border-gray-200"
			role="document"
		>
			<!-- Header -->
			<div class="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
				<div class="flex items-center gap-3">
					<Terminal class="w-5 h-5 text-blue-600" />
					<h2 id="console-title" class="text-lg font-semibold text-gray-900">Klipper Console</h2>
					<div class="flex items-center gap-2">
						<div class="w-2 h-2 rounded-full bg-green-500"></div>
						<span class="text-sm text-gray-600">Connected</span>
					</div>
				</div>
				<div class="flex items-center gap-2">
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
					Press Enter to send • Console is always connected
				</div>
			</div>
		</div>
	</div>
{/if}
