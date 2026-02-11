<script lang="ts">
	import DemoComponent from '$lib/components/DemoComponent.svelte';
	import KlipperConsole from '$lib/components/KlipperConsole.svelte';
	
	let consoleOpen = $state(false);
</script>

<div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
	<DemoComponent />
</div>

<KlipperConsole bind:isOpen={consoleOpen} />
