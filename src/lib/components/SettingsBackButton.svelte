<script lang="ts">
	import { ArrowLeft } from 'lucide-svelte';
	import { resolve } from '$app/paths';
	import { tooltip } from '$lib/actions/tooltip';

	/**
	 * Freccia "indietro" delle sottopagine di Settings, primo elemento del loro
	 * header, prima del titolo.
	 *
	 * È un link a `/settings`, non un `history.back()`: una sottopagina aperta da
	 * un link diretto o dopo un reload non ha un "prima" dentro l'app, e tornare
	 * indietro nel browser la farebbe uscire.
	 */
</script>

<a href={resolve('/settings')} class="back" aria-label="Back to Settings" use:tooltip>
	<ArrowLeft size={22} strokeWidth={2.2} />
</a>

<style>
	.back {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		flex-shrink: 0;
		border-radius: 12px;
		background: var(--color-surface-sunken);
		color: var(--color-text-secondary);
		transition:
			background-color 0.15s,
			transform 0.1s;
	}

	.back:hover {
		background: var(--color-divider);
	}

	.back:active {
		transform: scale(0.96);
	}

	.back:focus-visible {
		outline: 2px solid var(--color-red);
		outline-offset: 2px;
	}
</style>
