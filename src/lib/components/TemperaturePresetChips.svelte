<script lang="ts">
	import { BookmarkPlus, Check, X } from 'lucide-svelte';
	import { tooltip } from '$lib/actions/tooltip';
	import {
		MAX_PRESET_NAME_LENGTH,
		presetSummary,
		type HeaterPreset
	} from '$lib/stores/temperaturePresetsStore';

	/**
	 * I preset del popup temperature: una riga di chip che scorre in orizzontale, e in fondo
	 * "Save" per salvare quello che c'è nei campi come preset nuovo.
	 *
	 * Chip e non una select: sono pochi, si toccano col pollice e si vedono tutti senza un
	 * tap in più. Toccarne uno **riempie i campi e basta** — i comandi partono con Apply,
	 * come per i valori scritti a mano.
	 */
	let {
		presets,
		activeId,
		disabled = false,
		canSave,
		isNameTaken,
		onPick,
		onSave
	}: {
		presets: HeaterPreset[];
		/** Il preset che coincide con i campi, da evidenziare. */
		activeId: string | null;
		disabled?: boolean;
		/** Campi validi e almeno uno acceso: salvare un preset tutto spento non serve. */
		canSave: boolean;
		isNameTaken: (name: string) => boolean;
		onPick: (preset: HeaterPreset) => void;
		onSave: (name: string) => Promise<boolean>;
	} = $props();

	let naming = $state(false);
	let name = $state('');
	let saving = $state(false);
	let touched = $state(false);
	let nameInput = $state<HTMLInputElement | null>(null);

	const trimmed = $derived(name.trim());
	const nameError = $derived(
		trimmed === '' ? 'Give it a name' : isNameTaken(trimmed) ? 'That name is already used' : ''
	);

	function startNaming() {
		if (!canSave || disabled) return;
		naming = true;
		name = '';
		touched = false;
		queueMicrotask(() => nameInput?.focus());
	}

	function cancelNaming() {
		naming = false;
		name = '';
	}

	async function submit() {
		touched = true;
		if (nameError || saving) return;
		saving = true;
		const ok = await onSave(trimmed);
		saving = false;
		if (ok) cancelNaming();
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			submit();
		}
		// Escape chiude solo la riga del nome, non tutto il popup.
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			cancelNaming();
		}
	}

	// Dissolvenza solo sul lato dove c'è altro da scorrere.
	let scroller = $state<HTMLDivElement | null>(null);
	let fadeStart = $state(false);
	let fadeEnd = $state(false);

	function updateFades() {
		if (!scroller) return;
		const { scrollLeft, scrollWidth, clientWidth } = scroller;
		fadeStart = scrollLeft > 6;
		fadeEnd = scrollLeft + clientWidth < scrollWidth - 6;
	}

	$effect(() => {
		if (!scroller) return;
		void presets.length;
		updateFades();
		const observer = new ResizeObserver(updateFades);
		observer.observe(scroller);
		return () => observer.disconnect();
	});
</script>

<div class="presets">
	<div
		class="scroller"
		class:fade-start={fadeStart}
		class:fade-end={fadeEnd}
		bind:this={scroller}
		onscroll={updateFades}
		role="group"
		aria-label="Temperature presets"
	>
		{#each presets as preset (preset.id)}
			<button
				type="button"
				class="chip"
				class:active={preset.id === activeId}
				aria-pressed={preset.id === activeId}
				{disabled}
				onclick={() => onPick(preset)}
			>
				<span class="chip-name">{preset.name}</span>
				<span class="chip-summary">{presetSummary(preset)}</span>
			</button>
		{/each}
		<button
			type="button"
			class="chip save"
			class:open={naming}
			disabled={disabled || !canSave}
			onclick={startNaming}
			aria-label="Save these temperatures as a preset"
			use:tooltip
		>
			<BookmarkPlus size={18} />
			<span>Save</span>
		</button>
	</div>

	{#if naming}
		<div class="name-row">
			<input
				bind:this={nameInput}
				bind:value={name}
				type="text"
				placeholder="Preset name"
				maxlength={MAX_PRESET_NAME_LENGTH}
				autocomplete="off"
				aria-label="Preset name"
				aria-invalid={touched && !!nameError}
				disabled={saving}
				onkeydown={onKeydown}
			/>
			<button
				type="button"
				class="icon-btn confirm"
				disabled={saving || (touched && !!nameError)}
				onclick={submit}
				aria-label="Save preset"
				use:tooltip
			>
				<Check size={20} />
			</button>
			<button
				type="button"
				class="icon-btn"
				disabled={saving}
				onclick={cancelNaming}
				aria-label="Cancel"
				use:tooltip
			>
				<X size={20} />
			</button>
		</div>
		{#if touched && nameError}
			<p class="name-error">{nameError}</p>
		{/if}
	{/if}
</div>

<style>
	.presets {
		margin-bottom: 20px;
	}

	.scroller {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		scroll-snap-type: x proximity;
		scrollbar-width: none;
		/* Spazio per l'anello di focus, che altrimenti verrebbe tagliato. Lo snap deve
		   tenerne conto, o a riposo la riga resta scorsa di 3px e accende la dissolvenza. */
		padding: 3px;
		margin: -3px;
		scroll-padding-inline: 3px;
	}

	.scroller::-webkit-scrollbar {
		display: none;
	}

	.scroller.fade-end {
		mask-image: linear-gradient(to right, #000 calc(100% - 32px), transparent);
	}

	.scroller.fade-start {
		mask-image: linear-gradient(to right, transparent, #000 32px);
	}

	.scroller.fade-start.fade-end {
		mask-image: linear-gradient(
			to right,
			transparent,
			#000 32px,
			#000 calc(100% - 32px),
			transparent
		);
	}

	.chip {
		flex-shrink: 0;
		scroll-snap-align: start;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: center;
		gap: 2px;
		min-height: 52px;
		padding: 8px 14px;
		box-sizing: border-box;
		border: 1px solid var(--color-border-light);
		border-radius: 14px;
		background: var(--color-white);
		font-family: inherit;
		text-align: left;
		cursor: pointer;
		transition:
			border-color 0.15s,
			background-color 0.15s,
			transform 0.1s;
	}

	.chip:hover:not(:disabled) {
		background: var(--color-background);
	}

	.chip:active:not(:disabled) {
		transform: scale(0.97);
	}

	.chip:focus-visible {
		outline: 2px solid var(--color-red);
		outline-offset: 2px;
	}

	.chip:disabled {
		cursor: default;
		opacity: 0.45;
	}

	.chip.active {
		border-color: var(--color-red);
		background: rgba(var(--rgb-red), 0.07);
		box-shadow: inset 0 0 0 1px var(--color-red);
	}

	.chip-name {
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--color-text-secondary);
		white-space: nowrap;
	}

	.chip.active .chip-name {
		color: var(--color-red);
	}

	.chip-summary {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-subtle);
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.chip.save {
		flex-direction: row;
		align-items: center;
		gap: 6px;
		border-style: dashed;
		border-color: var(--color-gray);
		color: var(--color-text-muted);
		font-size: 0.9rem;
		font-weight: 700;
	}

	.chip.save.open {
		border-style: solid;
		border-color: var(--color-text-subtle);
		background: var(--color-background);
	}

	.name-row {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 10px;
	}

	.name-row input {
		flex: 1;
		min-width: 0;
		height: 44px;
		padding: 0 14px;
		box-sizing: border-box;
		border: 1px solid var(--color-border-light);
		border-radius: 12px;
		background: var(--color-background);
		font-family: inherit;
		font-size: 1rem;
		color: var(--color-black);
	}

	.name-row input:focus {
		outline: none;
		border-color: var(--color-red);
		box-shadow: 0 0 0 3px rgba(var(--rgb-red), 0.15);
	}

	.name-row input[aria-invalid='true'] {
		border-color: var(--color-red);
	}

	.icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		flex-shrink: 0;
		border: 1px solid var(--color-border-light);
		border-radius: 12px;
		background: var(--color-white);
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.icon-btn.confirm {
		border-color: var(--color-red);
		background: var(--color-red);
		color: var(--color-white);
	}

	.icon-btn:disabled {
		cursor: default;
		opacity: 0.45;
	}

	.name-error {
		margin: 6px 0 0 4px;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-red);
	}

	@media (prefers-reduced-motion: reduce) {
		.chip {
			transition: none;
		}
	}
</style>
