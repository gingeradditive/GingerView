<script lang="ts">
	import { page } from '$app/stores';
	import favicon from '$lib/assets/favicon.svg';
	import { mdiTabletDashboard, mdiFileMultiple, mdiCog, mdiCursorMove } from '@mdi/js';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import MoonrakerNotifier from '$lib/components/MoonrakerNotifier.svelte';
	import EmergencyStopButton from '$lib/components/EmergencyStopButton.svelte';
	import KlipperDownOverlay from '$lib/components/KlipperDownOverlay.svelte';
	import '../app.css';

	const logoImage = '/Printers/G2/Logo.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<ToastContainer />
<MoonrakerNotifier />
<main class="page-content">{@render children()}</main>
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
		background: rgba(255, 255, 255, 0.85);
		border-radius: 19.2px;
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
		z-index: 1000;
	}

	.dock a {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 52.8px;
		height: 52.8px;
		color: #828282;
		border-radius: 14.4px;
		text-decoration: none;
		background: #ffffff;
		border: 3px solid transparent;
		cursor: pointer;
		padding: 0;
	}

	.dock a:hover {
		background: #ffffff;
	}

	.dock a.active {
		background: #ffffff;
		border: 3px solid #D72E28;
	}

	.dock a:focus-visible {
		outline: 2px solid #d72e28;
		outline-offset: 2px;
	}

	.dock svg {
		width: 32px;
		height: 32px;
		fill: currentColor;
	}

	.settings-icon {
		background: #ffffff !important;
		margin-left: 19.2px;
		color: #828282 !important;
		border: 3px solid transparent !important;
	}

	.settings-icon svg {
		fill: currentColor;
	}

	.settings-icon:hover {
		background: #ffffff !important;
	}

	.settings-icon.active svg {
		fill: #D72E28;
	}

	.settings-icon.active {
		background: #ffffff !important;
		border: 3px solid #D72E28 !important;
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
