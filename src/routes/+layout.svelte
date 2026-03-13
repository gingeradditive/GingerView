<script lang="ts">
	import { page } from '$app/stores';
	import favicon from '$lib/assets/favicon.svg';
	import logoImage from '/Printers/G2/Logo.svg';
	import { mdiTabletDashboard, mdiFileMultiple, mdiCog } from '@mdi/js';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<main class="page-content">{@render children()}</main>

<nav class="dock" aria-label="Navigazione principale">
	<div class="logo-container">
		<img src={logoImage} alt="Logo" class="logo-image" />
	</div>
	<a href="/" class:active={$page.url.pathname === '/'} aria-label="Dashboard" title="Dashboard">
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<path d={mdiTabletDashboard} />
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
</nav>

<style>
	.page-content {
		min-height: 100vh;
	}

	.dock {
		position: fixed;
		left: 50%;
		bottom: 20px;
		transform: translateX(-50%);
		display: flex;
		gap: 0.8rem;
		padding: 12px;
		background: rgba(255, 255, 255, 0.85);
		border-radius: 24px;
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
		z-index: 1000;
	}

	.dock a {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 66px;
		height: 66px;
		color: #ffffff;
		border-radius: 18px;
		text-decoration: none;
		background: #C8C8C8;
	}

	.dock a:hover {
		background: #C8C8C8;
	}

	.dock a.active {
		background: #828282;
		border: 3px solid #D72E28;
	}

	.dock a:focus-visible {
		outline: 2px solid #d72e28;
		outline-offset: 2px;
	}

	.dock svg {
		width: 40px;
		height: 40px;
		fill: currentColor;
	}

	.settings-icon {
		background: transparent !important;
		margin-left: 24px;
	}

	.settings-icon svg {
		fill: #828282;
	}

	.settings-icon:hover {
		background: transparent !important;
	}

	.settings-icon.active {
		background: transparent !important;
		border: 3px solid #D72E28;
	}

	.logo-container {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 85px;
		height: 66px;
		margin-right: 20px;
	}

	.logo-image {
		width: 60px;
		height: 60px;
		object-fit: contain;
	}

</style>
