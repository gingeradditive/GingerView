<script lang="ts">
	import {
		Wifi,
		Terminal,
		CloudDownload,
		FileText,
		BookOpen,
		History,
		ChartColumn,
		Globe,
		ExternalLink,
		ChevronRight
	} from 'lucide-svelte';
	import NetworkManager from '$lib/components/NetworkManager.svelte';
	import KlipperConsole from '$lib/components/KlipperConsole.svelte';

	type Item = {
		id: string;
		title: string;
		description: string;
		icon: typeof Wifi;
		kind: 'modal' | 'route' | 'external';
		href?: string;
	};

	const items: Item[] = [
		{ id: 'wifi', title: 'Wifi Configuration', description: 'Connect and manage your Wi-Fi network', icon: Wifi, kind: 'modal' },
		{ id: 'console', title: 'Console', description: 'Access the system console', icon: Terminal, kind: 'modal' },
		{ id: 'update', title: 'Update', description: 'Check for updates and install', icon: CloudDownload, kind: 'route', href: '/settings/update' },
		{ id: 'log', title: 'Log', description: 'View system logs and events', icon: FileText, kind: 'route', href: '/settings/log' },
		{ id: 'wiki', title: 'Open Wiki', description: 'Visit the project wiki', icon: BookOpen, kind: 'external', href: 'https://github.com/gingeradditive/GingerView/wiki' },
		{ id: 'history', title: 'History', description: 'View system history', icon: History, kind: 'route', href: '/settings/history' },
		{ id: 'statistics', title: 'Statistics', description: 'View usage statistics and metrics', icon: ChartColumn, kind: 'route', href: '/settings/statistics' },
		{ id: 'timezone', title: 'Timezone', description: 'Set your timezone', icon: Globe, kind: 'route', href: '/settings/timezone' },
		{ id: 'mainsail', title: 'Mainsail', description: 'Open the Mainsail web interface', icon: ExternalLink, kind: 'external' }
	];

	let popupOpen = $state(false);
	let popupId = $state('');

	function openModal(id: string) {
		popupId = id;
		popupOpen = true;
	}

	function closeModal() {
		popupOpen = false;
		popupId = '';
	}

	function openMainsail() {
		const url = new URL(window.location.href);
		url.port = '8081';
		window.open(url.toString(), '_blank');
	}

	function handleClick(item: Item) {
		if (item.kind === 'modal') {
			openModal(item.id);
		} else if (item.id === 'mainsail') {
			openMainsail();
		} else if (item.kind === 'external' && item.href) {
			window.open(item.href, '_blank');
		}
	}
</script>

<section class="settings-page">
	<div class="settings-list">
		<header class="settings-header">
			<h1>Settings</h1>
		</header>

		{#each items as item, index (item.id)}
			{#if item.kind === 'route'}
				<a class="settings-row" href={item.href}>
					<span class="icon"><item.icon /></span>
					<div class="row-text">
						<h2>{item.title}</h2>
						<p>{item.description}</p>
					</div>
					<span class="chevron"><ChevronRight /></span>
				</a>
			{:else}
				<button type="button" class="settings-row" onclick={() => handleClick(item)}>
					<span class="icon"><item.icon /></span>
					<div class="row-text">
						<h2>{item.title}</h2>
						<p>{item.description}</p>
					</div>
					<span class="chevron">
						{#if item.kind === 'external'}
							<ExternalLink />
						{:else}
							<ChevronRight />
						{/if}
					</span>
				</button>
			{/if}
			{#if index < items.length - 1}
				<div class="divider"></div>
			{/if}
		{/each}
	</div>
</section>

{#if popupOpen}
	<div
		class="modal-overlay"
		role="dialog"
		aria-modal="true"
		tabindex="0"
		onkeydown={(e) => e.key === 'Escape' && closeModal()}
		onclick={(e) => e.target === e.currentTarget && closeModal()}
	>
		<div class="modal-content" role="document">
			<div class="modal-body">
				{#if popupId === 'wifi'}
					<NetworkManager embedded={true} />
				{:else if popupId === 'console'}
					<KlipperConsole onClose={closeModal} />
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.settings-page {
		padding: 24px 24px 112px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	.settings-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20px 4px 16px;
	}
	.settings-header h1 {
		margin: 0;
		font-size: 2rem;
		font-weight: 700;
		color: #222222;
	}
	.settings-list {
		background: #ffffff;
		border-radius: 20px;
		padding: 0 20px 4px;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
	}
	.settings-row {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 16px 4px;
		background: transparent;
		border: none;
		text-align: left;
		cursor: pointer;
		color: inherit;
		text-decoration: none;
	}
	.icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		color: #444444;
		flex-shrink: 0;
	}
	.icon :global(svg) {
		width: 26px;
		height: 26px;
	}
	.row-text {
		flex: 1;
		min-width: 0;
	}
	.row-text h2 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 700;
	}
	.row-text p {
		margin: 2px 0 0;
		font-size: 0.85rem;
		color: #8a8a8a;
	}
	.chevron {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: #b5b5b5;
		flex-shrink: 0;
	}
	.divider {
		height: 1px;
		background: #ececec;
	}
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: linear-gradient(135deg, rgba(100, 100, 100, 0.3), rgba(100, 100, 100, 0.22));
		backdrop-filter: blur(12px) saturate(130%);
		-webkit-backdrop-filter: blur(12px) saturate(130%);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2200;
	}
	.modal-content {
		width: min(900px, calc(100vw - 32px));
		background: #ffffff;
		border-radius: 20px;
		padding: 32px;
		max-height: calc(100vh - 64px);
		overflow-y: auto;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
	}
	.modal-body {
		min-height: 120px;
		color: #666;
		font-size: 0.95rem;
	}
	@media (max-width: 560px) {
		.settings-page {
			padding: 16px 16px 112px;
		}
	}
</style>
