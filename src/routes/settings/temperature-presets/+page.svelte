<script lang="ts">
	import SettingsSheet from '$lib/components/SettingsSheet.svelte';
	import { onMount } from 'svelte';
	import { Lock, Pencil, Plus, Thermometer, Trash2 } from 'lucide-svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import ZoneTemperatureEditor from '$lib/components/ZoneTemperatureEditor.svelte';
	import { tooltip } from '$lib/actions/tooltip';
	import { loadNozzleZones } from '$lib/services/moonraker-zones';
	import {
		MAX_BED_TEMPERATURE,
		MAX_NOZZLE_TEMPERATURE,
		MAX_PRESET_NAME_LENGTH,
		builtInPresets,
		customTemperaturePresets,
		deleteTemperaturePreset,
		isPresetNameTaken,
		loadTemperaturePresets,
		newPresetId,
		saveTemperaturePreset,
		type HeaterPreset
	} from '$lib/stores/temperaturePresetsStore';

	/**
	 * Settings → Temperature presets: i preset del popup temperature della dashboard.
	 *
	 * PLA e PETG sono di base e si guardano soltanto. Quelli personalizzati si creano,
	 * modificano ed eliminano solo qui e stanno sulla stampante, quindi valgono da ogni
	 * dispositivo. Nella dashboard si applicano con un tocco (`TemperaturePresetsSheet`).
	 */

	let zones = $state<string[]>([]);
	let loading = $state(true);

	onMount(async () => {
		const [loadedZones] = await Promise.all([loadNozzleZones(), loadTemperaturePresets()]);
		zones = loadedZones;
		loading = false;
	});

	const builtIns = $derived(builtInPresets(zones));

	/** "Z1 200° · Z2 220° · … · Bed 80°", zona spenta = "off". */
	const detail = (preset: HeaterPreset): string => {
		const fmt = (value: number | undefined) => (value && value > 0 ? `${value}°` : 'off');
		const nozzle = zones.map((zone, index) => `Z${index + 1} ${fmt(preset.zones[zone])}`);
		return [...nozzle, `Bed ${fmt(preset.bed)}`].join(' · ');
	};

	// --- editor ---------------------------------------------------------------

	let editing = $state<{ id: string; isNew: boolean } | null>(null);
	let name = $state('');
	let values = $state<(number | null)[]>([]);
	let bed = $state<number | null>(null);
	let saving = $state(false);
	let submitted = $state(false);

	const isValid = (value: number | null, max: number): boolean =>
		value == null || (Number.isInteger(value) && value >= 0 && value <= max);

	const nameError = $derived(
		name.trim() === ''
			? 'Give it a name'
			: isPresetNameTaken(name, zones, editing?.id)
				? 'That name is already used'
				: ''
	);
	const zonesValid = $derived(
		values.every((value) => isValid(value, MAX_NOZZLE_TEMPERATURE)) &&
			isValid(bed, MAX_BED_TEMPERATURE)
	);

	function openNew() {
		editing = { id: newPresetId(), isNew: true };
		name = '';
		values = zones.map(() => null);
		bed = null;
		submitted = false;
	}

	function openEdit(preset: HeaterPreset) {
		editing = { id: preset.id, isNew: false };
		name = preset.name;
		values = zones.map((zone) => {
			const value = preset.zones[zone];
			return value && value > 0 ? value : null;
		});
		bed = preset.bed > 0 ? preset.bed : null;
		submitted = false;
	}

	function closeEditor() {
		if (!saving) editing = null;
	}

	async function save() {
		submitted = true;
		if (!editing || nameError || !zonesValid || saving) return;
		saving = true;
		const ok = await saveTemperaturePreset({
			id: editing.id,
			name,
			zones: Object.fromEntries(zones.map((zone, index) => [zone, values[index] ?? 0])),
			bed: bed ?? 0
		});
		saving = false;
		if (ok) editing = null;
	}

	// --- eliminazione ---------------------------------------------------------

	let deleting = $state<HeaterPreset | null>(null);

	async function confirmDelete() {
		if (!deleting) return;
		const id = deleting.id;
		deleting = null;
		await deleteTemperaturePreset(id);
	}
</script>

<svelte:head>
	<title>Temperature presets · G2</title>
</svelte:head>

<SettingsSheet title="Temperature presets" size="wide">
	{#snippet actions()}
		<button
			type="button"
			class="btn btn-primary new-btn"
			disabled={loading || zones.length === 0}
			onclick={openNew}
		>
			<Plus size={18} />
			New preset
		</button>
	{/snippet}

	<p class="intro">
		Tap the extruder on the dashboard and pick a preset: every nozzle zone and the bed go straight
		to these targets.
	</p>

	{#if loading}
		<p class="state">Loading presets…</p>
	{:else if zones.length === 0}
		<p class="state">Can't read the nozzle zones from the printer right now.</p>
	{:else}
		<section class="group" aria-labelledby="builtin-title">
			<h2 id="builtin-title" class="group-title">Built-in</h2>
			<ul class="list">
				{#each builtIns as preset (preset.id)}
					<li class="row">
						<span class="badge" aria-hidden="true"><Thermometer size={20} /></span>
						<div class="row-text">
							<span class="row-name">{preset.name}</span>
							<span class="row-detail">{detail(preset)}</span>
						</div>
						<span class="locked" aria-label="Built-in, can't be changed" use:tooltip>
							<Lock size={16} />
						</span>
					</li>
				{/each}
			</ul>
		</section>

		<section class="group" aria-labelledby="custom-title">
			<h2 id="custom-title" class="group-title">Your presets</h2>
			{#if $customTemperaturePresets.length === 0}
				<div class="empty">
					<p>No custom presets yet.</p>
					<p class="empty-hint">Create one with New preset.</p>
				</div>
			{:else}
				<ul class="list">
					{#each $customTemperaturePresets as preset (preset.id)}
						<li class="row">
							<button
								type="button"
								class="row-main"
								onclick={() => openEdit(preset)}
								aria-label="Edit {preset.name}"
							>
								<span class="badge custom" aria-hidden="true"><Thermometer size={20} /></span>
								<span class="row-text">
									<span class="row-name">{preset.name}</span>
									<span class="row-detail">{detail(preset)}</span>
								</span>
							</button>
							<button
								type="button"
								class="row-action"
								onclick={() => openEdit(preset)}
								aria-label="Edit {preset.name}"
								use:tooltip
							>
								<Pencil size={18} />
							</button>
							<button
								type="button"
								class="row-action danger"
								onclick={() => (deleting = preset)}
								aria-label="Delete {preset.name}"
								use:tooltip
							>
								<Trash2 size={18} />
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</SettingsSheet>

{#if editing}
	<Sheet label={editing.isNew ? 'New preset' : 'Edit preset'} onClose={closeEditor} size="sm">
		{#snippet header()}
			<h3 class="sheet-title">{editing?.isNew ? 'New preset' : 'Edit preset'}</h3>
			<p class="sheet-subtitle">
				Target for each nozzle zone and the bed, in °C. Leave it empty to keep it off.
			</p>
		{/snippet}

		<label class="sheet-field name-field">
			<span>Name</span>
			<input
				type="text"
				bind:value={name}
				maxlength={MAX_PRESET_NAME_LENGTH}
				placeholder="e.g. PLA black"
				autocomplete="off"
				aria-invalid={submitted && !!nameError}
				disabled={saving}
				onkeydown={(e) => e.key === 'Enter' && save()}
			/>
		</label>
		{#if submitted && nameError}
			<p class="field-error">{nameError}</p>
		{/if}

		<ZoneTemperatureEditor
			bind:values
			invalid={values.map((value) => !isValid(value, MAX_NOZZLE_TEMPERATURE))}
			withBed
			bind:bed
			bedInvalid={!isValid(bed, MAX_BED_TEMPERATURE)}
			bedMax={MAX_BED_TEMPERATURE}
			max={MAX_NOZZLE_TEMPERATURE}
			placeholder="Off"
			disabled={saving}
			onEnter={save}
		/>

		{#if !zonesValid}
			<p class="sheet-error zones-error">
				Use numbers between 0 and {MAX_NOZZLE_TEMPERATURE} °C for the nozzle, 0 and {MAX_BED_TEMPERATURE}
				°C for the bed.
			</p>
		{/if}

		{#snippet footer()}
			<button type="button" class="btn btn-secondary" disabled={saving} onclick={closeEditor}>
				Cancel
			</button>
			<button
				type="button"
				class="btn btn-primary"
				disabled={saving || !zonesValid || (submitted && !!nameError)}
				onclick={save}
			>
				{saving ? 'Saving…' : 'Save'}
			</button>
		{/snippet}
	</Sheet>
{/if}

<ConfirmModal
	isOpen={deleting !== null}
	title="Delete this preset?"
	message={`"${deleting?.name ?? ''}" will disappear from the dashboard on every device.`}
	confirmLabel="Delete"
	tone="danger"
	icon={Trash2}
	onConfirm={confirmDelete}
	onCancel={() => (deleting = null)}
/>

<style>
	.new-btn {
		min-height: 40px;
	}

	.intro {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.45;
		color: var(--color-text-soft);
	}

	.state {
		margin: 8px 4px;
		color: var(--color-text-soft);
	}

	.group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.group-title {
		margin: 8px 0 0;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-text-subtle);
	}

	.list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 10px 10px 12px;
		border: 1px solid var(--color-border-light);
		border-radius: 14px;
		background: var(--color-white);
	}

	.row-main {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 0;
		border: none;
		background: transparent;
		font-family: inherit;
		text-align: left;
		color: inherit;
		cursor: pointer;
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

	.row > .badge {
		margin-right: 4px;
	}

	.row-text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.row-name {
		font-size: 1rem;
		font-weight: 700;
		color: var(--color-text-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.row-detail {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-text-subtle);
		font-variant-numeric: tabular-nums;
	}

	.locked {
		display: inline-flex;
		padding: 8px;
		color: var(--color-text-subtle);
	}

	.row-action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		flex-shrink: 0;
		border: none;
		border-radius: 10px;
		background: transparent;
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.row-action:hover {
		background: var(--color-background);
	}

	.row-action.danger {
		color: var(--color-red);
	}

	.row-action.danger:hover {
		background: var(--color-danger-bg);
	}

	.empty {
		padding: 20px;
		border: 1px dashed var(--color-gray);
		border-radius: 14px;
		text-align: center;
	}

	.empty p {
		margin: 0;
		font-weight: 700;
		color: var(--color-text-muted);
	}

	.empty .empty-hint {
		margin-top: 4px;
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--color-text-soft);
	}

	.name-field {
		margin-bottom: 4px;
	}

	.field-error {
		margin: 0 0 8px 4px;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-red);
	}

	.name-field + :global(.skeleton),
	.field-error + :global(.skeleton) {
		margin-top: 16px;
	}

	.zones-error {
		margin-top: 12px;
	}
</style>
