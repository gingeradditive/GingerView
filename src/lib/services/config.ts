import type { Config, KlipperConfig, NetworkConfig } from '$lib/types/config';

/**
 * Endpoint resolution
 * -------------------
 * By default GingerView talks to Moonraker on its *own origin*: nginx serves the
 * static build on port 80 and proxies `/printer/`, `/server/`, `/machine/`,
 * `/access/`, `/api/` and `/websocket` to Moonraker. That is how Mainsail works,
 * and it is what lets GingerSlicer connect to the printer without a port number.
 *
 * Same-origin means the compiled bundle contains no addresses at all, so a single
 * build works on every machine. Note that `VITE_*` values are inlined at build
 * time, and `.env` is gitignored, so anything host-specific baked in here would
 * be wrong for every printer but the one it was built for.
 *
 * The `VITE_MOONRAKER_*` / `VITE_NETWORK_API_*` variables exist to override this
 * during development, when the dev server and the printer are different hosts.
 */

class ConfigService {
	private config: Config | null = null;

	loadConfig(): Config {
		if (this.config) {
			return this.config;
		}

		const config: Config = {
			klipper: this.buildKlipperConfig(),
			network: this.buildNetworkConfig()
		};

		// Only memoize in the browser: the same-origin WebSocket URL is derived from
		// `window.location`, so caching a build-time result would pin an empty URL.
		if (typeof window !== 'undefined') {
			this.config = config;
		}
		return config;
	}

	private buildKlipperConfig(): KlipperConfig {
		const host = this.getOptionalEnvVar('VITE_MOONRAKER_HOST');
		const port = this.getNumberEnvVar('VITE_MOONRAKER_PORT', 7125);
		const explicitOrigin = host ? `http://${host}:${port}` : '';

		return {
			moonrakerApiUrl: this.getOptionalEnvVar('VITE_MOONRAKER_API_URL') ?? explicitOrigin,
			moonrakerWsUrl:
				this.getOptionalEnvVar('VITE_MOONRAKER_WS_URL') ??
				(host ? `ws://${host}:${port}/websocket` : sameOriginWebSocketUrl()),
			moonrakerHost: host ?? '',
			moonrakerPort: host ? port : 0,
			printerName: this.getEnvVar('VITE_PRINTER_NAME', 'Ginger Printer'),
			connectionTimeout: this.getNumberEnvVar('VITE_CONNECTION_TIMEOUT', 5000)
		};
	}

	private buildNetworkConfig(): NetworkConfig {
		// Falls back to the Moonraker host so that pointing the dev server at a
		// printer configures both services at once.
		const host =
			this.getOptionalEnvVar('VITE_NETWORK_API_HOST') ??
			this.getOptionalEnvVar('VITE_MOONRAKER_HOST');
		const port = this.getNumberEnvVar('VITE_NETWORK_API_PORT', 8000);

		return {
			apiBaseUrl:
				this.getOptionalEnvVar('VITE_NETWORK_API_BASE_URL') ?? (host ? `http://${host}:${port}` : ''),
			apiHost: host ?? '',
			apiPort: host ? port : 0
		};
	}

	private getEnvVar(key: string, defaultValue: string): string {
		return this.getOptionalEnvVar(key) ?? defaultValue;
	}

	private getOptionalEnvVar(key: string): string | undefined {
		const value = import.meta.env[key];
		if (typeof value !== 'string') return undefined;
		const trimmed = value.trim();
		return trimmed === '' ? undefined : trimmed;
	}

	private getNumberEnvVar(key: string, defaultValue: number): number {
		const raw = this.getOptionalEnvVar(key);
		if (raw === undefined) return defaultValue;
		const parsedValue = parseInt(raw, 10);
		return Number.isNaN(parsedValue) ? defaultValue : parsedValue;
	}

	getKlipperConfig(): KlipperConfig {
		return this.loadConfig().klipper;
	}

	getNetworkConfig(): NetworkConfig {
		return this.loadConfig().network;
	}

	/** True when requests go to the page's own origin through the nginx proxy. */
	isSameOrigin(): boolean {
		return this.getKlipperConfig().moonrakerApiUrl === '';
	}

	validateConfig(): { isValid: boolean; errors: string[] } {
		const errors: string[] = [];
		const klipper = this.getKlipperConfig();

		// An explicit override must be complete: a host without a usable port, or a
		// malformed URL, is a misconfiguration rather than a fallback to same-origin.
		if (klipper.moonrakerHost && (klipper.moonrakerPort < 1 || klipper.moonrakerPort > 65535)) {
			errors.push('Moonraker port must be between 1 and 65535');
		}

		if (!klipper.moonrakerWsUrl) {
			errors.push('Moonraker WebSocket URL could not be resolved');
		}

		if (klipper.connectionTimeout && klipper.connectionTimeout < 1000) {
			errors.push('Connection timeout should be at least 1000ms');
		}

		const network = this.getNetworkConfig();
		if (network.apiHost && (network.apiPort < 1 || network.apiPort > 65535)) {
			errors.push('Network API port must be between 1 and 65535');
		}

		return { isValid: errors.length === 0, errors };
	}
}

/**
 * Derived from `window.location` so the same bundle works over http and https and
 * on any hostname. Guarded because the static adapter renders the fallback page in
 * Node at build time, where `window` does not exist.
 */
function sameOriginWebSocketUrl(): string {
	if (typeof window === 'undefined') return '';
	const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
	return `${protocol}//${window.location.host}/websocket`;
}

export const configService = new ConfigService();

/**
 * Moonraker HTTP base without a trailing slash, ready to be concatenated with a
 * path. Returns an empty string in the same-origin setup, which turns callers
 * into relative requests such as `/printer/objects/query`.
 */
export function getMoonrakerApiUrl(): string {
	return configService.getKlipperConfig().moonrakerApiUrl.replace(/\/$/, '');
}
