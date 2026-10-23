import type { ClientInit } from '@sveltejs/kit';

/**
 * Con `VITE_DEMO=1` GingerView parla con una stampante simulata nel browser
 * (vedi `src/lib/demo/` e DEMO.md). Il valore è sostituito in fase di build:
 * senza flag il ramo è morto e il simulatore non entra nel bundle.
 */
export const init: ClientInit = async () => {
	if (import.meta.env.VITE_DEMO === '1') {
		const { installDemo } = await import('$lib/demo');
		installDemo();
	}
};
