import type { Config, KlipperConfig, NetworkConfig } from '$lib/types/config';

class ConfigService {
	private config: Config | null = null;

	loadConfig(): Config {
		if (this.config) {
			return this.config;
		}

		const klipperConfig: KlipperConfig = {
			moonrakerHost: this.getEnvVar('VITE_MOONRAKER_HOST', 'localhost'),
			moonrakerPort: this.getNumberEnvVar('VITE_MOONRAKER_PORT', 7125),
			moonrakerWsUrl: this.getOptionalEnvVar('VITE_MOONRAKER_WS_URL'),
			moonrakerApiUrl: this.getOptionalEnvVar('VITE_MOONRAKER_API_URL'),
			printerName: this.getEnvVar('VITE_PRINTER_NAME', 'Klipper Printer'),
			connectionTimeout: this.getNumberEnvVar('VITE_CONNECTION_TIMEOUT', 5000)
		};

		const networkConfig: NetworkConfig = {
			apiHost: this.getEnvVar('VITE_NETWORK_API_HOST', klipperConfig.moonrakerHost),
			apiPort: this.getNumberEnvVar('VITE_NETWORK_API_PORT', 8000),
			apiBaseUrl: this.getOptionalEnvVar('VITE_NETWORK_API_BASE_URL')
		};

		// Construct URLs if not explicitly provided
		if (!klipperConfig.moonrakerWsUrl) {
			klipperConfig.moonrakerWsUrl = `ws://${klipperConfig.moonrakerHost}:${klipperConfig.moonrakerPort}/websocket`;
		}

		if (!klipperConfig.moonrakerApiUrl) {
			klipperConfig.moonrakerApiUrl = `http://${klipperConfig.moonrakerHost}:${klipperConfig.moonrakerPort}`;
		}

		if (!networkConfig.apiBaseUrl) {
			networkConfig.apiBaseUrl = `http://${networkConfig.apiHost}:${networkConfig.apiPort}`;
		}

		this.config = { klipper: klipperConfig, network: networkConfig };
		return this.config;
	}

	private getEnvVar(key: string, defaultValue?: string): string {
		const value = import.meta.env[key];
		if (value === undefined) {
			if (defaultValue !== undefined) {
				return defaultValue;
			}
			throw new Error(`Environment variable ${key} is not set and no default value provided`);
		}
		return value;
	}

	private getOptionalEnvVar(key: string): string | undefined {
		const value = import.meta.env[key];
		return value === undefined ? undefined : value;
	}

	private getNumberEnvVar(key: string, defaultValue: number): number {
		const parsedValue = parseInt(this.getEnvVar(key, String(defaultValue)), 10);
		if (Number.isNaN(parsedValue)) {
			return defaultValue;
		}
		return parsedValue;
	}

	getKlipperConfig(): KlipperConfig {
		return this.loadConfig().klipper;
	}

	getNetworkConfig(): NetworkConfig {
		return this.loadConfig().network;
	}

	validateConfig(): { isValid: boolean; errors: string[] } {
		const errors: string[] = [];
		const config = this.getKlipperConfig();

		// Validate host
		if (!config.moonrakerHost) {
			errors.push('Moonraker host is required');
		}

		// Validate port
		if (!config.moonrakerPort || config.moonrakerPort < 1 || config.moonrakerPort > 65535) {
			errors.push('Moonraker port must be between 1 and 65535');
		}

		// Validate timeout
		if (config.connectionTimeout && config.connectionTimeout < 1000) {
			errors.push('Connection timeout should be at least 1000ms');
		}

		const networkConfig = this.getNetworkConfig();
		if (!networkConfig.apiHost) {
			errors.push('Network API host is required');
		}

		if (!networkConfig.apiPort || networkConfig.apiPort < 1 || networkConfig.apiPort > 65535) {
			errors.push('Network API port must be between 1 and 65535');
		}

		return {
			isValid: errors.length === 0,
			errors
		};
	}
}

export const configService = new ConfigService();
