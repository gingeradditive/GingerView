<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import favicon from '$lib/assets/favicon.svg';
	import { configService } from '$lib/services/config';
	import { mdiTabletDashboard, mdiFileMultiple, mdiCog, mdiCursorMove } from '@mdi/js';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import MoonrakerNotifier from '$lib/components/MoonrakerNotifier.svelte';
	import EmergencyStopButton from '$lib/components/EmergencyStopButton.svelte';
	import KlipperDownOverlay from '$lib/components/KlipperDownOverlay.svelte';
	import StaleDataBanner from '$lib/components/StaleDataBanner.svelte';
	import '../app.css';

	const logoImage = '/Printers/G2/Logo.svg';

	let { children } = $props();

	// The only way to misconfigure the endpoints is a wrong `.env`, and `VITE_*` values
	// exist only during development: a production build is same-origin and carries no
	// addresses at all. So the check runs in dev only, and on mount rather than at module
	// scope, because the WebSocket URL is resolved from `window.location`.
	onMount(() => {
		if (!import.meta.env.DEV) return;
		const { isValid, errors } = configService.validateConfig();
		if (!isValid) {
			console.error(
				`GingerView: invalid configuration, check your .env\n${errors.map((error) => `  - ${error}`).join('\n')}`
			);
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<ToastContainer />
<MoonrakerNotifier />
<main class="page-content">{@render children()}</main>
<StaleDataBanner />
<KlipperDownOverlay />

<nav class="dock" aria-label="Main navigation">
	<div class="logo-container">
		<img src={logoImage} alt="Logo" class="logo-image" />
	</div>
	<a href="/" class:active={$page.url.pathname === '/'} aria-label="Dashboard" title="Dashboard">
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<path d={mdiTabletDashboard} />
		</svg>
	</a>

	<a
		href="/movement"
		class:active={$page.url.pathname.startsWith('/movement')}
		aria-label="Movement"
		title="Movement"
	>
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<path d={mdiCursorMove} />
		</svg>
	</a>

	<a
		href="/filelist"
		class:active={$page.url.pathname.startsWith('/filelist')}
		aria-label="FileList"
		title="FileList"
	>
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<path d={mdiFileMultiple} />
		</svg>
	</a>

	<a
		href="/settings"
		class:active={$page.url.pathname.startsWith('/settings')}
		aria-label="Settings"
		title="Settings"
		class="settings-icon"
	>
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<path d={mdiCog} />
		</svg>
	</a>

	<EmergencyStopButton />
</nav>

<style>
	.page-content {
		height: 100%;
	}

	.dock {
		position: fixed;
		left: 50%;
		bottom: 16px;
		transform: translateX(-50%);
		display: flex;
		gap: 0.64rem;
		padding: 9.6px;
		background: rgba(var(--rgb-white), 0.85);
		border-radius: 19.2px;
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		box-shadow: 0 4px 20px rgba(var(--rgb-black), 0.15);
		z-index: 1000;
	}

	.dock a {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 52.8px;
		height: 52.8px;
		color: var(--color-text-subtle);
		border-radius: 14.4px;
		text-decoration: none;
		background: var(--color-white);
		border: 3px solid transparent;
		cursor: pointer;
		padding: 0;
	}

	.dock a:hover {
		background: var(--color-white);
	}

	.dock a.active {
		background: var(--color-white);
		border: 3px solid var(--color-red);
	}

	.dock a:focus-visible {
		outline: 2px solid var(--color-red);
		outline-offset: 2px;
	}

	.dock svg {
		width: 32px;
		height: 32px;
		fill: currentColor;
	}

	.settings-icon {
		background: var(--color-white) !important;
		margin-left: 19.2px;
		color: var(--color-text-subtle) !important;
		border: 3px solid transparent !important;
	}

	.settings-icon svg {
		fill: currentColor;
	}

	.settings-icon:hover {
		background: var(--color-white) !important;
	}

	.settings-icon.active svg {
		fill: var(--color-red);
	}

	.settings-icon.active {
		background: var(--color-white) !important;
		border: 3px solid var(--color-red) !important;
	}

	.logo-container {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 68px;
		height: 52.8px;
		margin-right: 16px;
	}

	.logo-image {
		width: 48px;
		height: 48px;
		object-fit: contain;
	}
</style>
