<script lang="ts">
	import type { Snippet } from 'svelte';
	import SettingsMenu from '$lib/components/SettingsMenu.svelte';
	import { trackSettingsNavigation } from '$lib/components/SettingsSheet.svelte';

	/**
	 * Il menu Settings c'è sempre; ogni sua pagina (`/settings/timezone`, …) si apre sopra
	 * come popup (`SettingsSheet`). Link diretti e reload aprono il popup col menu sotto.
	 */
	let { children }: { children: Snippet } = $props();

	trackSettingsNavigation();
</script>

<SettingsMenu />
{@render children()}
