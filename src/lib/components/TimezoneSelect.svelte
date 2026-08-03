<script lang="ts">
	import { Check, ChevronDown, Search } from 'lucide-svelte';
	import type { TimezoneEntry } from '$lib/data/timezones';
	import {
		ALL_TIMEZONES,
		findZone,
		formatOffset,
		getCityLabel,
		getOffsetMinutes,
		getZoneDetail,
		searchTimezones
	} from '$lib/services/timezone';

	/**
	 * Menu a tendina con ricerca sulle zone IANA.
	 *
	 * L'elenco completo è di oltre quattrocento voci: scorrerlo tutto su un
	 * telefono non è praticabile, quindi la ricerca è il modo previsto per
	 * arrivare a una zona e lo scorrimento è solo il ripiego.
	 */
	let {
		value,
		onSelect,
		disabled = false
	}: {
		/** Identificatore IANA attualmente scelto. */
		value: string;
		onSelect: (id: string) => void;
		disabled?: boolean;
	} = $props();

	/**
	 * Quante voci vengono disegnate. Oltre questo numero la lista non è più
	 * navigabile a colpo d'occhio e tanto vale invitare a scrivere qualche
	 * lettera in più, invece di montare centinaia di righe a ogni tasto premuto.
	 */
	const maxVisible = 50;

	let open = $state(false);
	let query = $state('');
	let highlighted = $state(0);
	let container = $state<HTMLDivElement | null>(null);
	let searchInput = $state<HTMLInputElement | null>(null);
	let listRef = $state<HTMLUListElement | null>(null);

	let results = $derived(searchTimezones(query));
	let visible = $derived(results.slice(0, maxVisible));
	let hiddenCount = $derived(results.length - visible.length);

	let selected = $derived(findZone(value));
	let selectedCity = $derived(selected ? getCityLabel(selected.id) : value);
	let selectedDetail = $derived(selected ? getZoneDetail(selected) : 'Not in the known zone list');

	// A tendina aperta il cursore sta nel campo di ricerca e la riga evidenziata
	// resta visibile: vale sia all'apertura sia a ogni spostamento con le frecce.
	$effect(() => {
		if (!open) return;
		searchInput?.focus();
		scrollToHighlighted();
	});

	function toggle() {
		if (disabled) return;
		open = !open;
		if (!open) return;

		query = '';
		// Con la ricerca vuota l'elenco parte da capo: se la zona corrente sta oltre
		// le prime `maxVisible` non è fra quelle disegnate, e allora non si evidenzia
		// niente — meglio nessuna riga che una riga sbagliata.
		highlighted = ALL_TIMEZONES.slice(0, maxVisible).findIndex((zone) => zone.id === value);
	}

	function choose(zone: TimezoneEntry) {
		onSelect(zone.id);
		open = false;
	}

	function scrollToHighlighted() {
		const option = listRef?.querySelectorAll('.option')[highlighted];
		option?.scrollIntoView({ block: 'nearest' });
	}

	function move(step: number) {
		if (visible.length === 0) return;
		// Da "niente evidenziato" (-1) la freccia giù deve portare sulla prima riga.
		const from = highlighted < 0 ? (step > 0 ? -1 : visible.length) : highlighted;
		highlighted = Math.min(visible.length - 1, Math.max(0, from + step));
	}

	function handleSearchKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			move(1);
			return;
		}
		if (event.key === 'ArrowUp') {
			event.preventDefault();
			move(-1);
			return;
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			if (visible[highlighted]) choose(visible[highlighted]);
			return;
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			open = false;
		}
	}

	function handlePointerDown(event: PointerEvent) {
		if (!open) return;
		if (container && !container.contains(event.target as Node)) open = false;
	}
</script>

<svelte:window onpointerdown={handlePointerDown} />

<div class="select" bind:this={container}>
	<button
		type="button"
		class="trigger"
		class:open
		{disabled}
		aria-haspopup="listbox"
		aria-expanded={open}
		onclick={toggle}
	>
		<span class="trigger-text">
			<span class="city">{selectedCity}</span>
			<span class="detail">{selectedDetail}</span>
		</span>
		<span class="offset">{formatOffset(getOffsetMinutes(value))}</span>
		<span class="chevron"><ChevronDown /></span>
	</button>

	{#if open}
		<div class="panel">
			<div class="search">
				<Search />
				<input
					type="text"
					bind:this={searchInput}
					bind:value={query}
					oninput={() => (highlighted = 0)}
					onkeydown={handleSearchKeydown}
					placeholder="Search a city or a country..."
					autocomplete="off"
					spellcheck="false"
				/>
			</div>

			<ul class="options" role="listbox" aria-label="Timezones" bind:this={listRef}>
				{#each visible as zone, index (zone.id)}
					<li role="presentation">
						<button
							type="button"
							class="option"
							class:highlighted={index === highlighted}
							role="option"
							aria-selected={zone.id === value}
							onclick={() => choose(zone)}
							onpointerenter={() => (highlighted = index)}
						>
							<span class="option-text">
								<span class="city">{getCityLabel(zone.id)}</span>
								<span class="detail">{getZoneDetail(zone)}</span>
							</span>
							<span class="offset">{formatOffset(getOffsetMinutes(zone.id))}</span>
							{#if zone.id === value}
								<span class="check"><Check /></span>
							{/if}
						</button>
					</li>
				{/each}

				{#if results.length === 0}
					<li class="empty">No timezone matches "{query}"</li>
				{/if}
			</ul>

			{#if hiddenCount > 0}
				<p class="more">{hiddenCount} more — keep typing to narrow the list</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.select {
		position: relative;
		flex-shrink: 0;
	}
	.trigger {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		box-sizing: border-box;
		border: 1px solid #e2e2e2;
		background: #ffffff;
		border-radius: 16px;
		padding: 12px 16px;
		text-align: left;
		cursor: pointer;
	}
	.trigger.open {
		border-color: #d72e28;
	}
	.trigger:disabled {
		opacity: 0.55;
		cursor: default;
	}
	.trigger-text,
	.option-text {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}
	.city {
		font-size: 1rem;
		font-weight: 700;
		color: #222222;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.detail {
		font-size: 0.8rem;
		color: #8a8a8a;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.offset {
		font-size: 0.85rem;
		font-weight: 600;
		color: #6e6e6e;
		flex-shrink: 0;
	}
	.chevron {
		display: inline-flex;
		color: #6e6e6e;
		flex-shrink: 0;
		transition: transform 150ms ease;
	}
	.trigger.open .chevron {
		transform: rotate(180deg);
	}
	.panel {
		position: absolute;
		top: calc(100% + 8px);
		left: 0;
		right: 0;
		z-index: 20;
		background: #ffffff;
		border: 1px solid #e2e2e2;
		border-radius: 16px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		box-sizing: border-box;
	}
	.search {
		display: flex;
		align-items: center;
		gap: 10px;
		border: 1px solid #e2e2e2;
		border-radius: 12px;
		padding: 8px 12px;
		color: #8a8a8a;
		flex-shrink: 0;
	}
	.search input {
		flex: 1;
		min-width: 0;
		border: none;
		outline: none;
		font-family: inherit;
		font-size: 0.95rem;
		color: #222222;
		background: transparent;
	}
	.options {
		list-style: none;
		margin: 0;
		padding: 0;
		/* Alto quanto lo schermo concede, senza mai diventare una pagina a sé. */
		max-height: min(360px, 40vh);
		overflow-y: auto;
	}
	.option {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		box-sizing: border-box;
		background: transparent;
		border: none;
		border-radius: 12px;
		padding: 10px 12px;
		text-align: left;
		cursor: pointer;
	}
	.option.highlighted {
		background: #f5f5f5;
	}
	.check {
		display: inline-flex;
		color: #d72e28;
		flex-shrink: 0;
	}
	.empty {
		padding: 16px 12px;
		font-size: 0.9rem;
		color: #8a8a8a;
		text-align: center;
	}
	.more {
		margin: 0;
		font-size: 0.8rem;
		color: #8a8a8a;
		text-align: center;
		flex-shrink: 0;
	}
</style>
