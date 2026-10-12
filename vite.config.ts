import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

/**
 * Le variabili che, compilate dentro il bundle, lo legano a un solo indirizzo.
 * Senza, l'app parla con Moonraker sulla propria origine e la stessa build
 * funziona su ogni stampante (vedi docs/03-configurazione.md).
 */
const PINNING_VARS = /^VITE_(MOONRAKER|G2_SERVICE)_/;

export default defineConfig(({ command, mode }) => {
	if (command === 'build' && mode === 'production') {
		const pinned = Object.entries(loadEnv(mode, process.cwd(), 'VITE_')).filter(
			([key, value]) => PINNING_VARS.test(key) && value !== ''
		);
		// Una build "puntata" va chiesta apposta: per sbaglio è finita in `main` e
		// sulle stampanti dei clienti, che cercavano Moonraker su un altro host.
		if (pinned.length > 0 && process.env.GINGERVIEW_PINNED_BUILD !== '1') {
			throw new Error(
				[
					'Production build refused: these variables would compile an address into the bundle:',
					...pinned.map(([key, value]) => `    ${key}=${value}`),
					'Development settings belong in .env.development.local, which `vite build` ignores.',
					'To build a bundle for one specific printer on purpose, set GINGERVIEW_PINNED_BUILD=1.'
				].join('\n')
			);
		}
	}

	return {
		plugins: [sveltekit()]
	};
});
