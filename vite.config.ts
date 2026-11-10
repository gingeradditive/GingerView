import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv, type ProxyOptions } from 'vite';

/**
 * Le variabili che, compilate dentro il bundle, lo legano a un solo indirizzo.
 * Senza, l'app parla con Moonraker sulla propria origine e la stessa build
 * funziona su ogni stampante (vedi docs/03-configurazione.md).
 */
const PINNING_VARS = /^VITE_(MOONRAKER|G2_SERVICE)_/;

/** I percorsi che nginx, sulla stampante, gira a Moonraker e a G2-Service. */
const PRINTER_PATHS = ['/printer', '/server', '/machine', '/access', '/api', '/service'];

/**
 * In sviluppo il dev server fa quello che fa nginx sulla stampante: inoltra le
 * API alla macchina indicata da `GINGERVIEW_PRINTER`. L'app resta same-origin
 * come in produzione, e non servono né `cors_domains` su Moonraker né variabili
 * `VITE_*` (vedi docs/05-sviluppo.md).
 */
function printerProxy(printer: string): Record<string, ProxyOptions> {
	const target = /^https?:\/\//.test(printer) ? printer : `http://${printer}`;
	// Moonraker controlla l'Origin (il websocket risponde 403 a `localhost`):
	// riscritto con quello della stampante, la richiesta è identica a una che
	// arriva dal suo nginx. `changeOrigin` sistema solo l'Host.
	const origin = new URL(target).origin;
	const options = (ws = false): ProxyOptions => ({
		target,
		ws,
		changeOrigin: true,
		configure: (proxy) => {
			proxy.on('proxyReq', (req) => req.setHeader('origin', origin));
			proxy.on('proxyReqWs', (req) => req.setHeader('origin', origin));
		}
	});

	const proxy: Record<string, ProxyOptions> = { '/websocket': options(true) };
	for (const path of PRINTER_PATHS) proxy[path] = options();
	return proxy;
}

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

	// Con `VITE_DEMO=1` l'app parla con la stampante simulata nel browser
	// (src/lib/demo/): niente proxy, così nessuna richiesta può raggiungere una
	// stampante vera anche se `GINGERVIEW_PRINTER` è impostata.
	const demo = loadEnv(mode, process.cwd(), 'VITE_').VITE_DEMO === '1';

	// `build/` è tracciata ed è ciò che scaricano le stampanti: il simulatore non
	// ci deve mai finire. La build della demo usa una cartella sua (BUILD_DIR).
	if (command === 'build' && demo && (process.env.BUILD_DIR ?? 'build') === 'build') {
		throw new Error(
			'Build refused: VITE_DEMO=1 would put the simulated printer into build/. Set BUILD_DIR to another folder.'
		);
	}

	// Senza prefisso VITE_: è configurazione del dev server, non deve finire nel bundle.
	const printer = demo ? undefined : loadEnv(mode, process.cwd(), 'GINGERVIEW_').GINGERVIEW_PRINTER;

	return {
		plugins: [sveltekit()],
		server: command === 'serve' && printer ? { proxy: printerProxy(printer) } : undefined
	};
});
