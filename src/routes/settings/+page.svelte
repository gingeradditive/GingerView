<script lang="ts">
	import {
		Wifi,
		Terminal,
		SquareFunction,
		CloudDownload,
		FileText,
		FileCode,
		BookOpen,
		History,
		ChartColumn,
		Globe,
		Thermometer,
		ExternalLink,
		ChevronRight
	} from 'lucide-svelte';
	import { resolve } from '$app/paths';
	import type { RouteId } from '$app/types';
	import { CONFIG_EDITOR_ENABLED } from '$lib/services/moonraker-config';

	type BaseItem = {
		id: string;
		title: string;
		description: string;
		icon: typeof Wifi;
		/** Rows that only exist while the machine is in development. */
		enabled?: boolean;
	};

	// `href` is a route id on internal rows, so it can go through `resolve()`, and a plain
	// URL string on external ones, which leave the app entirely.
	type RouteItem = BaseItem & { kind: 'route'; href: RouteId };
	type ExternalItem = BaseItem & { kind: 'external'; href: string };
	type Item = RouteItem | ExternalItem;

	type Group = { id: string; title: string; items: Item[] };

	/**
	 * Le voci divise per argomento. Una voce nuova è una riga nel gruppo giusto; un
	 * argomento nuovo è un gruppo in più.
	 */
	const allGroups: Group[] = [
		{
			id: 'printer',
			title: 'Printer',
			items: [
				{
					id: 'macros',
					title: 'Macros',
					description: 'Run the printer macros',
					icon: SquareFunction,
					kind: 'route',
					href: '/settings/macros'
				},
				{
					id: 'temperature-presets',
					title: 'Temperature presets',
					description: 'PLA, PETG and your own, for the dashboard',
					icon: Thermometer,
					kind: 'route',
					href: '/settings/temperature-presets'
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
					id: 'config-editor',
					title: 'Config editor',
					description: 'Tweak the printer config and restart the firmware',
					icon: FileCode,
					kind: 'route',
					href: '/settings/config-editor',
					enabled: CONFIG_EDITOR_ENABLED
				}
			]
		},
		{
			id: 'system',
			title: 'System',
			items: [
				{
					id: 'network',
					title: 'Network',
					description: 'Manage your network connection',
					icon: Wifi,
					kind: 'route',
					href: '/settings/network'
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
					id: 'update',
					title: 'Update',
					description: "See what's new and install updates",
					icon: CloudDownload,
					kind: 'route',
					href: '/settings/update'
				}
			]
		},
		{
			id: 'data',
			title: 'Data',
			items: [
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
					id: 'log',
					title: 'Logs',
					description: 'Download or clear Klipper, Moonraker and Crowsnest logs',
					icon: FileText,
					kind: 'route',
					href: '/settings/log'
				}
			]
		},
		{
			id: 'help',
			title: 'Help',
			items: [
				{
					id: 'wiki',
					title: 'Open the wiki',
					description: 'Visit the project wiki',
					icon: BookOpen,
					kind: 'external',
					href: 'https://wiki.gingeradditive.com/'
				}
			]
		}
	];

	// Le voci solo-sviluppo spariscono, e con loro un gruppo rimasto vuoto.
	const groups = allGroups
		.map((group) => ({ ...group, items: group.items.filter((item) => item.enabled !== false) }))
		.filter((group) => group.items.length > 0);

	function handleExternalClick(item: ExternalItem) {
		window.open(item.href, '_blank');
	}
</script>

<svelte:head>
	<title>Settings · G2</title>
</svelte:head>

<section class="settings-page">
	<header class="settings-header">
		<h1>Settings</h1>
	</header>

	<div class="groups">
		{#each groups as group (group.id)}
			<section class="settings-group" aria-labelledby="settings-group-{group.id}">
				<h2 id="settings-group-{group.id}" class="group-title">{group.title}</h2>
				<div class="settings-list">
					{#each group.items as item, index (item.id)}
						{#if item.kind === 'route'}
							<a class="settings-row" href={resolve(item.href)}>
								<span class="icon"><item.icon /></span>
								<div class="row-text">
									<h3>{item.title}</h3>
									<p>{item.description}</p>
								</div>
								<span class="chevron"><ChevronRight /></span>
							</a>
						{:else}
							<button type="button" class="settings-row" onclick={() => handleExternalClick(item)}>
								<span class="icon"><item.icon /></span>
								<div class="row-text">
									<h3>{item.title}</h3>
									<p>{item.description}</p>
								</div>
								<span class="chevron"><ExternalLink /></span>
							</button>
						{/if}
						{#if index < group.items.length - 1}
							<div class="divider"></div>
						{/if}
					{/each}
				</div>
			</section>
		{/each}
	</div>
</section>

<style>
	.settings-page {
		padding: 24px 24px calc(112px + var(--safe-bottom));
		display: flex;
		flex-direction: column;
		gap: 20px;
		/* Su un computer le righe non si allungano fino al bordo. */
		width: 100%;
		max-width: 768px;
		margin: 0 auto;
		box-sizing: border-box;
	}
	.settings-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20px 4px 0;
	}
	.groups {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	.group-title {
		margin: 0 0 8px;
		padding: 0 4px;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--color-text-muted);
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
	.row-text h3 {
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
	/* Su un computer i gruppi vanno su due colonne: le colonne CSS li impilano per
	   altezza, così un gruppo corto non lascia un buco accanto a uno lungo. */
	@media (min-width: 1000px) {
		.settings-page {
			max-width: 1240px;
		}
		.groups {
			display: block;
			columns: 2;
			column-gap: 24px;
		}
		.settings-group {
			break-inside: avoid;
			/* Le colonne ignorano il gap del flex: lo spazio tra gruppi è un margine. */
			padding-bottom: 20px;
		}
	}
	@media (max-width: 767.98px) {
		.settings-page {
			padding: 16px 16px calc(112px + var(--safe-bottom));
		}
	}
</style>
