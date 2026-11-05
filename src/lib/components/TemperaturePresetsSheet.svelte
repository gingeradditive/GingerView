<script lang="ts">
	import {
		ChevronRight,
		LoaderCircle,
		Power,
		Settings2,
		SlidersHorizontal,
		Thermometer
	} from 'lucide-svelte';
	import { resolve } from '$app/paths';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import {
		applyHeaterTargets,
		builtInPresets,
		customTemperaturePresets,
		loadTemperaturePresets,
		matchesPreset,
		presetSummary,
		type HeaterPreset
	} from '$lib/stores/temperaturePresetsStore';

	/**
	 * Il primo popup delle temperature, aperto toccando il disegno dell'estrusore nella
	 * dashboard (modalità advanced).
	 *
	 * Un preset si **applica al tocco** e il popup si chiude: è una scorciatoia, e una
	 * conferma in più la renderebbe inutile. Chi vuole decidere zona per zona sceglie
	 * "Custom", che apre i campi liberi (`ExtruderTemperatureModal`).
	 *
	 * Il preset che coincide con i target attuali della macchina è segnato "Active".
	 */
	let {
		isOpen,
		zones,
		targets,
		bedTarget,
		onClose,
		onCustom
	}: {
		isOpen: boolean;
		zones: string[];
		targets: (number | null)[];
		bedTarget: number | null;
		onClose: () => void;
		onCustom: () => void;
	} = $props();

	/** Il preset in invio (o `'off'`), per lo spinner e per fermare altri tocchi. */
	let busy = $state<string | null>(null);

	let wasOpen = false;
	$effect(() => {
		if (isOpen && !wasOpen) loadTemperaturePresets();
		wasOpen = isOpen;
	});

	const presets = $derived([...builtInPresets(zones), ...$customTemperaturePresets]);
	const roundedTargets = $derived(
		targets.map((target) => (target != null && target > 0 ? Math.round(target) : null))
	);
	const roundedBed = $derived(bedTarget != null && bedTarget > 0 ? Math.round(bedTarget) : null);
	const activeId = $derived(
		presets.find((preset) => matchesPreset(preset, zones, roundedTargets, roundedBed))?.id ?? null
	);
	const anyOn = $derived(roundedTargets.some((value) => value != null) || roundedBed != null);

	async function run(id: string, values: (number | null)[], bed: number | null) {
		if (busy) return;
		busy = id;
		const ok = await applyHeaterTargets(zones, values, bed);
		busy = null;
		if (ok) onClose();
	}

	const apply = (preset: HeaterPreset) =>
		run(
			preset.id,
			zones.map((zone) => preset.zones[zone] ?? 0),
			preset.bed
		);

	const allOff = () =>
		run(
			'off',
			zones.map(() => 0),
			0
		);
</script>

{#if isOpen}
	<Sheet label="Temperatures" onClose={() => !busy && onClose()} size="sm">
		{#snippet header()}
			<h3 class="sheet-title">Temperatures</h3>
			<p class="sheet-subtitle">Pick a preset — it heats up right away.</p>
		{/snippet}

		<ul class="list" aria-label="Temperature presets">
			{#each presets as preset (preset.id)}
				<li>
					<button
						type="button"
						class="row"
						class:active={preset.id === activeId}
						disabled={busy !== null}
						onclick={() => apply(preset)}
					>
						<span class="badge" class:custom={!preset.builtIn} aria-hidden="true">
							<Thermometer size={20} />
						</span>
						<span class="text">
							<span class="name">{preset.name}</span>
							<span class="summary">{presetSummary(preset)}</span>
						</span>
						{#if preset.id === activeId}
							<span class="active-tag">Active</span>
						{/if}
						<span class="end" aria-hidden="true">
							{#if busy === preset.id}
								<LoaderCircle size={20} class="spin" />
							{:else}
								<ChevronRight size={20} />
							{/if}
						</span>
					</button>
				</li>
			{/each}

			<li class="custom-item">
				<button type="button" class="row" disabled={busy !== null} onclick={onCustom}>
					<span class="badge neutral" aria-hidden="true"><SlidersHorizontal size={20} /></span>
					<span class="text">
						<span class="name">Custom</span>
						<span class="summary">Set each zone by hand</span>
					</span>
					<span class="end" aria-hidden="true"><ChevronRight size={20} /></span>
				</button>
			</li>
		</ul>

		<a class="manage" href={resolve('/settings/temperature-presets')} onclick={onClose}>
			<Settings2 size={16} />
			Manage presets
		</a>

		{#snippet footer()}
			<button
				type="button"
				class="btn btn-secondary off"
				disabled={busy !== null || !anyOn}
				onclick={allOff}
			>
				{#if busy === 'off'}
					<LoaderCircle size={18} class="spin" />
				{:else}
					<Power size={18} />
				{/if}
				Turn all off
			</button>
			<button type="button" class="btn btn-secondary" disabled={busy !== null} onclick={onClose}>
				Cancel
			</button>
		{/snippet}
	</Sheet>
{/if}

<style>
	.list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	/* "Custom" è un'altra cosa rispetto ai preset: staccato da una riga sottile. */
	.custom-item {
		margin-top: 6px;
		padding-top: 14px;
		border-top: 1px solid var(--color-surface-sunken);
	}

	.row {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 64px;
		padding: 10px 12px;
		box-sizing: border-box;
		border: 1px solid var(--color-border-light);
		border-radius: 14px;
		background: var(--color-white);
		font-family: inherit;
		text-align: left;
		color: inherit;
		cursor: pointer;
		transition:
			background-color 0.15s,
			border-color 0.15s,
			transform 0.1s;
	}

	.row:hover:not(:disabled) {
		background: var(--color-background);
	}

	.row:active:not(:disabled) {
		transform: scale(0.98);
	}

	.row:focus-visible {
		outline: 2px solid var(--color-red);
		outline-offset: 2px;
	}

	.row:disabled {
		cursor: default;
	}

	.row:disabled:not(:has(:global(.spin))) {
		opacity: 0.5;
	}

	.row.active {
		border-color: var(--color-red);
		box-shadow: inset 0 0 0 1px var(--color-red);
	}

	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		flex-shrink: 0;
		border-radius: 12px;
		background: var(--color-surface-sunken);
		color: var(--color-text-muted);
	}

	.badge.custom {
		background: rgba(var(--rgb-red), 0.08);
		color: var(--color-red);
	}

	.badge.neutral {
		background: var(--color-background);
	}

	.text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.name {
		font-size: 1rem;
		font-weight: 700;
		color: var(--color-text-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.summary {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-text-subtle);
		font-variant-numeric: tabular-nums;
	}

	.active-tag {
		flex-shrink: 0;
		padding: 3px 8px;
		border-radius: 999px;
		background: rgba(var(--rgb-red), 0.1);
		color: var(--color-red);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.03em;
		text-transform: uppercase;
	}

	.end {
		display: inline-flex;
		flex-shrink: 0;
		color: var(--color-gray-light);
	}

	.end :global(.spin) {
		color: var(--color-red);
		animation: spin 0.9s linear infinite;
	}

	.off :global(.spin) {
		animation: spin 0.9s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.manage {
		display: flex;
		width: fit-content;
		align-items: center;
		gap: 6px;
		margin: 16px auto 0;
		padding: 6px 10px;
		border-radius: 8px;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-text-soft);
		text-decoration: none;
	}

	.manage:hover {
		color: var(--color-text-secondary);
		background: var(--color-background);
	}

	.off {
		color: var(--color-red);
	}

	@media (prefers-reduced-motion: reduce) {
		.row {
			transition: none;
		}
	}
</style>
