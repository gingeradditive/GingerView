<script lang="ts">
	import KlipperConsole from '$lib/components/KlipperConsole.svelte';
	import NetworkManager from '$lib/components/NetworkManager.svelte';

	let consoleOpen = $state(false);
</script>

<section class="settings-page">
	<div class="settings-actions">
		<NetworkManager />
		<KlipperConsole bind:isOpen={consoleOpen} />
	</div>
</section>

<style>
	.settings-page {
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	h1 {
		margin: 0 0 8px;
		font-size: 1.5rem;
	}

	p {
		margin: 0;
		color: #666;
	}

	.settings-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: center;
	}
</style>
