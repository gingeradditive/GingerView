<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchAndDisplayWarnings, startNotifierWebSocket } from '$lib/services/moonraker-notifier';

	onMount(() => {
		// Fetch warnings from /server/info on startup
		fetchAndDisplayWarnings();

		// Start a WebSocket listener for ongoing notifications
		const disconnect = startNotifierWebSocket();

		return () => {
			disconnect();
		};
	});
</script>
