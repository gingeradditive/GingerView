<script lang="ts">
	import { browser } from '$app/environment';
	import { Wifi, Terminal, PanelTop, Network, Wrench, Droplets, CircleDot, Shield, ChevronDown, X, Pin } from 'lucide-svelte';
	import NetworkManager from '$lib/components/NetworkManager.svelte';
	import KlipperConsole from '$lib/components/KlipperConsole.svelte';

	type Card = { id: string; title: string; description: string; icon: typeof Wifi };
	type Item = { id: string; title: string; icon: typeof Wifi; type: 'action' | 'toggle' };
	type Group = { id: string; title: string; items: Item[] };
	type PinnedAction = { id: string; title: string };

	const PINNED_ACTIONS_KEY = 'gingerview:pinned-actions';

	const topCards: Card[] = [
		{ id: 'wifi', title: 'Wifi configuration', description: 'Manage current network and Wi-Fi setup.', icon: Wifi },
		{ id: 'console', title: 'Console', description: 'Open diagnostics and command interface.', icon: Terminal },
		{ id: 'tbd', title: '[TBD]', description: 'Reserved slot for upcoming settings.', icon: PanelTop }
	];

	const groups: Group[] = [
		{
			id: 'network',
			title: 'Network settings',
			items: [{ id: 'tablet-network', title: 'Show tablet network settings', icon: Network, type: 'toggle' }]
		},
		{
			id: 'maintenance',
			title: 'Printer maintenance',
			items: [
				{ id: 'material', title: 'Change material', icon: Droplets, type: 'action' },
				{ id: 'nozzle', title: 'Change nozzle', icon: CircleDot, type: 'action' },
				{ id: 'screw', title: 'Screw adjustment', icon: Wrench, type: 'action' }
			]
		},
		{
			id: 'system',
			title: 'System settings',
			items: [{ id: 'advanced', title: 'Advanced user mode', icon: Shield, type: 'toggle' }]
		}
	];

	let popupOpen = $state(false);
	let popupId = $state('');
	let popupTitle = $state('');
	let toggles = $state<Record<string, boolean>>({ 'tablet-network': false, advanced: false });
	let pinnedActions = $state<PinnedAction[]>(browser ? readPinnedActions() : []);

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

	function openPopup(id: string, title: string) {
		popupId = id;
		popupTitle = title;
		popupOpen = true;
	}

	function handleOpenPopup(event: MouseEvent, id: string, title: string) {
		event.preventDefault();
		event.stopPropagation();
		openPopup(id, title);
	}

	function toggleItem(id: string) {
		toggles[id] = !toggles[id];
	}

	function closePopup() {
		popupOpen = false;
		popupId = '';
		popupTitle = '';
	}

	function isPinned(actionId: string) {
		return pinnedActions.some((item) => item.id === actionId);
	}

	function togglePin(action: PinnedAction) {
		if (!browser) return;
		if (isPinned(action.id)) {
			pinnedActions = pinnedActions.filter((item) => item.id !== action.id);
		} else {
			pinnedActions = [...pinnedActions, action];
		}
		localStorage.setItem(PINNED_ACTIONS_KEY, JSON.stringify(pinnedActions));
		window.dispatchEvent(new CustomEvent('pinned-actions-updated'));
	}
</script>

<section class="settings-page">
	<div class="top-grid">
		{#each topCards as card (card.id)}
			<div class="action-wrap">
				<button class="top-card" type="button" onclick={(e) => handleOpenPopup(e, card.id, card.title)}>
					<span class="icon-lg"><card.icon /></span>
					<div>
						<h2>{card.title}</h2>
						<p>{card.description}</p>
					</div>
				</button>
				<button
					type="button"
					class="pin-btn {isPinned(card.id) ? 'active' : ''}"
					title={isPinned(card.id) ? 'Rimuovi dal menu' : 'Aggiungi al menu'}
					aria-label={isPinned(card.id) ? 'Rimuovi dal menu' : 'Aggiungi al menu'}
					onclick={() => togglePin({ id: card.id, title: card.title })}
				>
					<span class="icon-sm"><Pin /></span>
				</button>
			</div>
		{/each}
	</div>

	<div class="accordion-list">
		{#each groups as group (group.id)}
			<details class="accordion" open>
				<summary>
					<span>{group.title}</span>
					<span class="chevron"><ChevronDown class="icon-sm" /></span>
				</summary>
				<div class="mini-grid">
					{#each group.items as item (item.id)}
						{#if item.type === 'toggle'}
							<button
								class="item-btn toggle-btn {toggles[item.id] ? 'active' : ''}"
								type="button"
								aria-pressed={toggles[item.id]}
								onclick={() => toggleItem(item.id)}
							>
								<span class="icon-sm"><item.icon /></span>
								<span>{item.title}</span>
							</button>
						{:else}
							<div class="action-wrap mini-wrap">
								<button class="item-btn" type="button" onclick={(e) => handleOpenPopup(e, item.id, item.title)}>
									<span class="icon-sm"><item.icon /></span>
									<span>{item.title}</span>
								</button>
								<button
									type="button"
									class="pin-btn {isPinned(item.id) ? 'active' : ''}"
									title={isPinned(item.id) ? 'Rimuovi dal menu' : 'Aggiungi al menu'}
									aria-label={isPinned(item.id) ? 'Rimuovi dal menu' : 'Aggiungi al menu'}
									onclick={() => togglePin({ id: item.id, title: item.title })}
								>
									<span class="icon-sm"><Pin /></span>
								</button>
							</div>
						{/if}
					{/each}
				</div>
			</details>
		{/each}
	</div>
</section>

{#if popupOpen}
	<div
		class="modal-overlay"
		role="dialog"
		aria-modal="true"
		aria-labelledby="mock-title"
		tabindex="0"
		onkeydown={(e) => e.key === 'Escape' && closePopup()}
		onclick={(e) => e.target === e.currentTarget && closePopup()}
	>
		<div class="modal-content" role="document">
			<div class="modal-header">
				<h3 id="mock-title">{popupTitle}</h3>
				<button class="close" type="button" onclick={closePopup} aria-label="Close">
					<span class="icon-sm"><X /></span>
				</button>
			</div>
			<div class="modal-body">
				{#if popupId === 'wifi'}
					<NetworkManager embedded={true} />
				{:else if popupId === 'console'}
					<KlipperConsole embedded={true} />
				{:else}
					<p>Empty popup mock.</p>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.settings-page { padding: 24px; display: flex; flex-direction: column; gap: 24px; }
	.top-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
	.action-wrap { position: relative; }
	.top-card {
		background: #fff; border: 1px solid #d8d8d8; border-radius: 14px; padding: 16px; display: flex; gap: 12px;
		align-items: flex-start; text-align: left; cursor: pointer; transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
		width: 100%;
	}
	.top-card:hover { transform: translateY(-1px); border-color: #d72e28; box-shadow: 0 8px 18px rgba(0, 0, 0, 0.08); }
	.top-card h2 { margin: 0; font-size: 1rem; }
	.top-card p { margin: 5px 0 0; font-size: 0.85rem; color: #6e6e6e; }
	.accordion-list { display: flex; flex-direction: column; gap: 10px; }
	.accordion { border: none; background: transparent; }
	.accordion summary {
		list-style: none; cursor: pointer; padding: 8px 0; display: flex; justify-content: space-between; align-items: center;
		font-weight: 700; font-size: 0.95rem;
	}
	.accordion summary::-webkit-details-marker { display: none; }
	.chevron { display: inline-flex; transition: transform 0.15s; }
	.accordion[open] .chevron { transform: rotate(180deg); }
	.mini-grid { padding: 4px 0 10px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
	.mini-wrap .item-btn { padding-right: 40px; }
	.item-btn {
		border: 1px solid #c8c8c8;
		border-radius: 10px;
		background: #ffffff;
		min-height: 52px;
		padding: 10px 12px;
		display: flex;
		align-items: center;
		gap: 8px;
		text-align: left;
		cursor: pointer;
		color: #111111;
		transition: transform 0.15s, background-color 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s;
		width: 100%;
	}
	.item-btn:hover { transform: translateY(-1px); border-color: #d72e28; box-shadow: 0 8px 18px rgba(0, 0, 0, 0.08); }
	.item-btn span { font-size: 0.84rem; line-height: 1.2; }
	.pin-btn {
		position: absolute;
		right: 8px;
		top: 8px;
		width: 28px;
		height: 28px;
		border: 1px solid #c8c8c8;
		border-radius: 8px;
		background: #ffffff;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		color: #666666;
	}
	.pin-btn:hover { border-color: #d72e28; color: #d72e28; }
	.pin-btn.active { background: #d72e28; border-color: #d72e28; color: #ffffff; }
	.pin-btn.active .icon-sm :global(svg) { color: #ffffff; }
	.toggle-btn.active {
		background: #d72e28;
		border-color: #d72e28;
		color: #ffffff;
	}
	.toggle-btn.active .icon-sm :global(svg) { color: #ffffff; }
	.modal-overlay {
		position: fixed; inset: 0; background: linear-gradient(135deg, rgba(255, 255, 255, 0.3), rgba(240, 244, 248, 0.22));
		backdrop-filter: blur(12px) saturate(130%); -webkit-backdrop-filter: blur(12px) saturate(130%);
		display: flex; align-items: center; justify-content: center; z-index: 2200;
	}
	.modal-content {
		width: min(900px, calc(100vw - 32px)); background: #fff; border: 1px solid #d8d8d8; border-radius: 16px; padding: 16px;
		max-height: calc(100vh - 64px); overflow-y: auto;
	}
	.modal-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
	.modal-header h3 { margin: 0; font-size: 1rem; }
	.close { border: none; background: transparent; padding: 4px; cursor: pointer; color: #666; }
	.modal-body { min-height: 120px; color: #666; font-size: 0.95rem; }
	.icon-lg { width: 20px; height: 20px; color: #d72e28; flex-shrink: 0; display: inline-flex; }
	.icon-sm { width: 16px; height: 16px; color: #d72e28; flex-shrink: 0; display: inline-flex; }
	.icon-lg :global(svg) { width: 20px; height: 20px; color: #d72e28; }
	.icon-sm :global(svg) { width: 16px; height: 16px; color: #d72e28; }
	@media (max-width: 980px) {
		.top-grid { grid-template-columns: 1fr; }
		.mini-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	}
	@media (max-width: 560px) {
		.settings-page { padding: 16px; }
		.mini-grid { grid-template-columns: 1fr; }
	}
</style>
