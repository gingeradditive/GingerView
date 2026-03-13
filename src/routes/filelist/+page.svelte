<script lang="ts">
	import PageContainer from '$lib/components/PageContainer.svelte';
	import KlipperConsole from '$lib/components/KlipperConsole.svelte';
	import NetworkManager from '$lib/components/NetworkManager.svelte';

	let consoleOpen = $state(false);
</script>

<PageContainer />

<KlipperConsole bind:isOpen={consoleOpen} />
<NetworkManager />
