<script lang="ts" module>
	import { afterNavigate } from '$app/navigation';

	/**
	 * Vero se l'utente è arrivato alla pagina aperta dal menu Settings: allora chiudere è
	 * un passo indietro nella cronologia, e il tasto indietro del browser non riapre il
	 * popup. Lo aggiorna `trackSettingsNavigation`, chiamato dal layout di Settings.
	 */
	let openedFromMenu = false;

	export function trackSettingsNavigation(): void {
		afterNavigate(({ from, to }) => {
			openedFromMenu = from?.route.id === '/settings' && to?.route.id !== '/settings';
		});
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Sheet from '$lib/components/ui/Sheet.svelte';

	/**
	 * Il popup di una pagina di Settings. La pagina resta una route (`/settings/timezone`):
	 * il menu sta sotto, renderizzato dal layout, e chiudere torna a `/settings`.
	 *
	 * - `actions`: pill e pulsanti accanto al titolo (stato, Refresh, New…).
	 * - `dismissible={false}` dove un tocco sullo sfondo farebbe perdere lavoro (editor).
	 */
	let {
		title,
		size = 'wide',
		tall = false,
		dismissible = true,
		panelClass = '',
		actions,
		children,
		footer
	}: {
		title: string;
		size?: 'sm' | 'md' | 'wide' | 'lg' | 'xl';
		tall?: boolean;
		dismissible?: boolean;
		panelClass?: string;
		actions?: Snippet;
		children?: Snippet;
		footer?: Snippet;
	} = $props();

	function close(): void {
		if (openedFromMenu) history.back();
		else goto(resolve('/settings'), { replaceState: true });
	}
</script>

<Sheet label={title} onClose={close} {size} {tall} {dismissible} {panelClass} {footer} showClose>
	{#snippet header()}
		<div class="settings-sheet-header">
			<h2 class="sheet-title">{title}</h2>
			{#if actions}
				<div class="settings-sheet-actions">{@render actions()}</div>
			{/if}
		</div>
	{/snippet}
	<div class="settings-sheet-body" class:fill={tall}>
		{@render children?.()}
	</div>
</Sheet>

<style>
	.settings-sheet-header {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 10px 12px;
		min-height: 40px;
	}

	.settings-sheet-header .sheet-title {
		font-size: 1.35rem;
	}

	/* Le pagine impilano i blocchi come facevano nella card: in colonna, 16px tra uno e
	   l'altro. Nei popup alti il corpo riempie il pannello (console, editor). */
	.settings-sheet-body {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.settings-sheet-body.fill {
		height: 100%;
		min-height: 0;
	}

	.settings-sheet-actions {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
		margin-left: auto;
	}
</style>
