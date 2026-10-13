<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Barra d'azione in fondo a una card della dashboard: il feeder nella card
	 * PELLET, le temperature nella card temperature (modalità avanzata). Un solo
	 * componente perché i controlli delle card si leggano e si tocchino tutti
	 * allo stesso modo — etichetta a sinistra, stato o azione a destra.
	 *
	 * Grammatica dei pulsanti di opzione di Heat & Extrude: neutra a riposo,
	 * bordo rosso quando `active`. Fondo sempre pieno, così resta leggibile anche
	 * sopra il riempimento rosso della card PELLET.
	 *
	 * La card che la ospita deve essere `position: relative` e lasciare libero in
	 * fondo lo spazio della barra: 52px + 12px di margine = 64px.
	 */
	let {
		label,
		active = false,
		disabled = false,
		role,
		ariaLabel,
		ariaChecked,
		onclick,
		children
	}: {
		label: string;
		active?: boolean;
		disabled?: boolean;
		role?: 'switch';
		ariaLabel?: string;
		ariaChecked?: boolean;
		onclick: () => void;
		/** Lato destro: lo stato (ON/OFF) o l'azione (SET ›). */
		children: Snippet;
	} = $props();
</script>

<button
	type="button"
	class="card-bar"
	class:active
	{role}
	aria-label={ariaLabel}
	aria-checked={ariaChecked}
	{disabled}
	{onclick}
>
	<span class="card-bar-label">{label}</span>
	<span class="card-bar-trailing">{@render children()}</span>
</button>

<style>
	.card-bar {
		position: absolute;
		left: 12px;
		right: 12px;
		bottom: 12px;
		z-index: 3;
		height: 52px;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0 14px;
		box-sizing: border-box;
		background: var(--color-background);
		border: 1px solid var(--color-border-light);
		border-radius: 12px;
		color: var(--color-text-soft);
		cursor: pointer;
		transition:
			background 0.15s,
			border-color 0.15s,
			color 0.15s;
	}

	.card-bar:hover {
		background: var(--color-surface-sunken);
	}

	.card-bar.active {
		background: var(--color-white);
		border: 2px solid var(--color-red);
		padding: 0 13px;
		color: var(--color-red);
	}

	.card-bar:disabled {
		cursor: default;
		opacity: 0.6;
	}

	.card-bar-label {
		font-size: 0.95rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.card-bar-trailing {
		margin-left: auto;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.85rem;
		font-weight: 600;
		letter-spacing: 0.05em;
	}
</style>
