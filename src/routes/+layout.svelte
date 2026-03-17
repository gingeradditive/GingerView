<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import { Wifi, Terminal, PanelTop, Droplets, CircleDot, Wrench } from 'lucide-svelte';
	import { mdiTabletDashboard, mdiFileMultiple, mdiCog } from '@mdi/js';
	import '../app.css';

	type PinnedAction = { id: string; title: string };

	const PINNED_ACTIONS_KEY = 'gingerview:pinned-actions';
	const logoImage = '/Printers/G2/Logo.svg';

	let { children } = $props();
	let pinnedActions = $state<PinnedAction[]>([]);
	let popupOpen = $state(false);
	let popupTitle = $state('');

	function readPinnedActions(): PinnedAction[] {
		try {
			const raw = localStorage.getItem(PINNED_ACTIONS_KEY);
			if (!raw) return [];
			const parsed = JSON.parse(raw) as PinnedAction[];
			if (!Array.isArray(parsed)) return [];
			return parsed.filter((item) => typeof item?.id === 'string' && typeof item?.title === 'string');
		} catch {
			return [];
		}
	}

	function syncPinnedActions() {
		if (!browser) return;
		pinnedActions = readPinnedActions();
	}

	function openPinnedPopup(title: string) {
		popupTitle = title;
		popupOpen = true;
	}

	function closePinnedPopup() {
		popupOpen = false;
		popupTitle = '';
	}

	onMount(() => {
		syncPinnedActions();
		const refreshPinned = () => syncPinnedActions();
		window.addEventListener('pinned-actions-updated', refreshPinned);
		window.addEventListener('storage', refreshPinned);
		return () => {
			window.removeEventListener('pinned-actions-updated', refreshPinned);
			window.removeEventListener('storage', refreshPinned);
		};
	});
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

	{#each pinnedActions as action, index (action.id)}
		<button
			type="button"
			class="pinned-action"
			class:first-pinned={index === 0}
			onclick={() => openPinnedPopup(action.title)}
			aria-label={action.title}
			title={action.title}
		>
			{#if action.id === 'wifi'}
				<Wifi />
			{:else if action.id === 'console'}
				<Terminal />
			{:else if action.id === 'tbd'}
				<PanelTop />
			{:else if action.id === 'material'}
				<Droplets />
			{:else if action.id === 'nozzle'}
				<CircleDot />
			{:else if action.id === 'screw'}
				<Wrench />
			{:else}
				<PanelTop />
			{/if}
		</button>
	{/each}

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

{#if popupOpen}
	<div
		class="modal-overlay"
		role="dialog"
		aria-modal="true"
		aria-labelledby="pinned-popup-title"
		tabindex="0"
		onkeydown={(e) => e.key === 'Escape' && closePinnedPopup()}
		onclick={(e) => e.target === e.currentTarget && closePinnedPopup()}
	>
		<div class="modal-content" role="document">
			<div class="modal-header">
				<h3 id="pinned-popup-title">{popupTitle}</h3>
				<button type="button" class="close-modal" aria-label="Close popup" onclick={closePinnedPopup}>×</button>
			</div>
			<div class="modal-body">Empty popup mock.</div>
		</div>
	</div>
{/if}

<style>
	.page-content {
		min-height: 100vh;
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

	.dock a,
	.dock button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 52.8px;
		height: 52.8px;
		color: #ffffff;
		border-radius: 14.4px;
		text-decoration: none;
		background: #C8C8C8;
		border: none;
		cursor: pointer;
		padding: 0;
	}

	.dock a:hover,
	.dock button:hover {
		background: #C8C8C8;
	}

	.dock a.active {
		background: #828282;
		border: 2.4px solid #D72E28;
	}

	.dock a:focus-visible,
	.dock button:focus-visible {
		outline: 2px solid #d72e28;
		outline-offset: 2px;
	}

	.pinned-action {
		background: #C8C8C8 !important;
	}

	.first-pinned {
		margin-left: 19.2px;
	}

	.pinned-action:hover {
		background: #C8C8C8 !important;
	}

	.dock svg {
		width: 32px;
		height: 32px;
		fill: currentColor;
	}

	.settings-icon {
		background: transparent !important;
		margin-left: 19.2px;
	}

	.settings-icon svg {
		fill: #828282;
	}

	.settings-icon:hover {
		background: transparent !important;
	}

	.settings-icon.active svg {
		fill: #D72E28;
	}

	.settings-icon.active {
		background: transparent !important;
		border: none !important;
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

	.modal-overlay {
		position: fixed;
		inset: 0;
		background: linear-gradient(135deg, rgba(255, 255, 255, 0.3), rgba(240, 244, 248, 0.22));
		backdrop-filter: blur(12px) saturate(130%);
		-webkit-backdrop-filter: blur(12px) saturate(130%);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1300;
	}

	.modal-content {
		width: min(460px, calc(100vw - 32px));
		background: #FFFFFF;
		border: 1px solid #C8C8C8;
		border-radius: 16px;
		padding: 16px;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.modal-header h3 {
		margin: 0;
		color: #111111;
		font-size: 1rem;
	}

	.close-modal {
		border: none;
		background: transparent;
		color: #666666;
		font-size: 1.3rem;
		line-height: 1;
		cursor: pointer;
	}

	.modal-body {
		margin-top: 12px;
		min-height: 120px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #666666;
	}

</style>
