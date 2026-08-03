<script lang="ts">
	import {
		Wifi,
		Terminal,
		CloudDownload,
		FileText,
		FileCode,
		BookOpen,
		History,
		ChartColumn,
		Globe,
		ExternalLink,
		ChevronRight
	} from 'lucide-svelte';
	import { CONFIG_EDITOR_ENABLED } from '$lib/services/moonraker-config';

	type Item = {
		id: string;
		title: string;
		description: string;
		icon: typeof Wifi;
		kind: 'route' | 'external';
		href?: string;
		/** Rows that only exist while the machine is in development. */
		enabled?: boolean;
	};

	const allItems: Item[] = [
		{
			id: 'network',
			title: 'Network',
			description: 'Manage your network connection',
			icon: Wifi,
			kind: 'route',
			href: '/settings/network'
		},
		{
			id: 'console',
			title: 'Console',
			description: 'Access the system console',
			icon: Terminal,
			kind: 'route',
			href: '/settings/console'
		},
		{
			id: 'update',
			title: 'Update',
			description: 'Check for updates and install',
			icon: CloudDownload,
			kind: 'route',
			href: '/settings/update'
		},
		{
			id: 'log',
			title: 'Logs',
			description: 'Download or clear Klipper, Moonraker and Crowsnest logs',
			icon: FileText,
			kind: 'route',
			href: '/settings/log'
		},
		{
			id: 'wiki',
			title: 'Open Wiki',
			description: 'Visit the project wiki',
			icon: BookOpen,
			kind: 'external',
			href: 'https://wiki.gingeradditive.com/'
		},
		{
			id: 'history',
			title: 'History',
			description: 'View system history',
			icon: History,
			kind: 'route',
			href: '/settings/history'
		},
		{
			id: 'statistics',
			title: 'Statistics',
			description: 'View usage statistics and metrics',
			icon: ChartColumn,
			kind: 'route',
			href: '/settings/statistics'
		},
		{
			id: 'timezone',
			title: 'Timezone',
			description: 'Set your timezone',
			icon: Globe,
			kind: 'route',
			href: '/settings/timezone'
		},
		{
			id: 'config-editor',
			title: 'Config editor',
			description: 'Edit the printer config files and restart the firmware',
			icon: FileCode,
			kind: 'route',
			href: '/settings/config-editor',
			enabled: CONFIG_EDITOR_ENABLED
		}
	];

	const items = allItems.filter((item) => item.enabled !== false);

	function handleExternalClick(item: Item) {
		if (item.href) {
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
				<button type="button" class="settings-row" onclick={() => handleExternalClick(item)}>
					<span class="icon"><item.icon /></span>
					<div class="row-text">
						<h2>{item.title}</h2>
						<p>{item.description}</p>
					</div>
					<span class="chevron"><ExternalLink /></span>
				</button>
			{/if}
			{#if index < items.length - 1}
				<div class="divider"></div>
			{/if}
		{/each}
	</div>
</section>

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
		color: var(--color-text-secondary);
	}
	.settings-list {
		background: var(--color-white);
		border-radius: 20px;
		padding: 0 20px 4px;
		box-shadow: var(--shadow-float);
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
		color: var(--color-text-muted);
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
		color: var(--color-text-subtle);
	}
	.chevron {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--color-gray-light);
		flex-shrink: 0;
	}
	.divider {
		height: 1px;
		background: var(--color-surface-sunken);
	}
	@media (max-width: 767.98px) {
		.settings-page {
			padding: 16px 16px 112px;
		}
	}
</style>
