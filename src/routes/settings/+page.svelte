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
	import { resolve } from '$app/paths';
	import type { RouteId } from '$app/types';
	import { onMount } from 'svelte';
	import { CONFIG_EDITOR_ENABLED } from '$lib/services/moonraker-config';
	import { ensureUiMode, setUiMode, uiMode, type UiMode } from '$lib/stores/uiModeStore';

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
			description: "See what's new and install updates",
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
			title: 'Open the wiki',
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
			description: 'Tweak the printer config and restart the firmware',
			icon: FileCode,
			kind: 'route',
			href: '/settings/config-editor',
			enabled: CONFIG_EDITOR_ENABLED
		}
	];

	const items = allItems.filter((item) => item.enabled !== false);

	const uiModes: { value: UiMode; label: string }[] = [
		{ value: 'simple', label: 'Simple' },
		{ value: 'advanced', label: 'Advanced' }
	];

	function selectUiMode(mode: UiMode) {
		if (mode === $uiMode) return;
		setUiMode(mode, $uiMode);
	}

	onMount(() => {
		ensureUiMode();
	});

	function handleExternalClick(item: ExternalItem) {
		window.open(item.href, '_blank');
	}
</script>

<svelte:head>
	<title>Settings · G2</title>
</svelte:head>

<section class="settings-page">
	<div class="settings-list">
		<header class="settings-header">
			<h1>Settings</h1>
			<div
				class="mode-switch"
				class:advanced={$uiMode === 'advanced'}
				role="radiogroup"
				aria-label="Interface mode"
			>
				<span class="mode-thumb" aria-hidden="true"></span>
				{#each uiModes as mode (mode.value)}
					<button
						type="button"
						class="mode-option"
						class:selected={$uiMode === mode.value}
						role="radio"
						aria-checked={$uiMode === mode.value}
						onclick={() => selectUiMode(mode.value)}
					>
						{mode.label}
					</button>
				{/each}
			</div>
		</header>

		{#each items as item, index (item.id)}
			{#if item.kind === 'route'}
				<a class="settings-row" href={resolve(item.href)}>
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
		padding: 24px 24px calc(112px + var(--safe-bottom));
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
	/* Due metà uguali e un cursore rosso che scorre sotto quella scelta: si legge
	   come un interruttore, ma dice per esteso entrambe le posizioni. */
	.mode-switch {
		position: relative;
		display: grid;
		grid-template-columns: 1fr 1fr;
		flex-shrink: 0;
		padding: 4px;
		background: var(--color-background);
		border: 1px solid var(--color-border-light);
		border-radius: 999px;
	}
	.mode-thumb {
		position: absolute;
		top: 4px;
		bottom: 4px;
		left: 4px;
		width: calc(50% - 4px);
		border-radius: 999px;
		background: var(--color-red);
		box-shadow: var(--shadow-panel);
		transition: transform 0.2s ease;
	}
	.mode-switch.advanced .mode-thumb {
		transform: translateX(100%);
	}
	.mode-option {
		position: relative;
		z-index: 1;
		min-width: 104px;
		height: 44px;
		padding: 0 16px;
		background: transparent;
		border: none;
		border-radius: 999px;
		font-size: 0.95rem;
		font-weight: 700;
		letter-spacing: 0.03em;
		color: var(--color-text-soft);
		cursor: pointer;
		transition: color 0.2s ease;
	}
	.mode-option.selected {
		color: var(--color-white);
	}
	@media (prefers-reduced-motion: reduce) {
		.mode-thumb,
		.mode-option {
			transition: none;
		}
	}
	/* Sul telefono accanto al titolo non ci sta senza rimpicciolirlo: va sotto, a
	   tutta larghezza, e resta grande da premere. */
	@media (max-width: 480px) {
		.settings-header {
			flex-wrap: wrap;
			gap: 12px;
		}
		.mode-switch {
			width: 100%;
		}
		.mode-option {
			min-width: 0;
		}
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
			padding: 16px 16px calc(112px + var(--safe-bottom));
		}
	}
</style>
