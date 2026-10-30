<script lang="ts">
	import type { Icon as LucideIcon } from 'lucide-svelte';

	// Un dato del file o del lavoro: icona, valore, e sotto cosa è. Uguale nel dettaglio del
	// file e in quello dello storico, che prima avevano uno icone senza etichetta e l'altro
	// etichette senza icone.
	let {
		label,
		value,
		iconSrc,
		icon: Icon
	}: {
		label: string;
		value: string;
		iconSrc?: string;
		icon?: typeof LucideIcon;
	} = $props();
</script>

<div class="stat">
	<span class="icon" aria-hidden="true">
		{#if iconSrc}
			<img src={iconSrc} alt="" width="26" height="26" />
		{:else if Icon}
			<Icon size={24} />
		{/if}
	</span>
	<span class="value">{value}</span>
	<span class="label">{label}</span>
</div>

<style>
	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 12px 6px;
		min-width: 0;
		border-radius: 14px;
		background: var(--color-surface-soft);
		text-align: center;
	}

	.icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 28px;
		color: var(--color-red);
	}

	.value {
		max-width: 100%;
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--color-black);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.label {
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: var(--color-text-subtle);
	}
</style>
