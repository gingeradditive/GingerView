<script lang="ts">
	import { X } from 'lucide-svelte';
	import { tooltip } from '$lib/actions/tooltip';

	/**
	 * La X in alto a destra delle modali che non hanno un pulsante Cancel/Close.
	 * Senza, l'unico modo di chiuderle al tocco era indovinare di toccare fuori.
	 * La modale deve essere `position: relative`.
	 */
	let { onClose, label = 'Close' }: { onClose: () => void; label?: string } = $props();
</script>

<button type="button" class="modal-close" aria-label={label} use:tooltip onclick={onClose}>
	<X size={22} />
</button>

<style>
	.modal-close {
		position: absolute;
		top: 12px;
		right: 12px;
		z-index: 2;
		width: 44px;
		height: 44px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: 50%;
		background: var(--color-background);
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.modal-close:hover {
		background: var(--color-surface-sunken);
	}
</style>
