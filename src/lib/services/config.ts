import type { Config, KlipperConfig } from '$lib/types/config';

class ConfigService {
	private config: Config | null = null;

	loadConfig(): Config {
		if (this.config) {
			return this.config;
		}

		// Check if we're in browser environment
		if (typeof window === 'undefined') {
			// Server-side default config
			this.config = {
				klipper: {
					moonrakerHost: '192.168.1.20',
					moonrakerPort: 7125,
					moonrakerWsUrl: 'ws://192.168.1.20:7125/websocket',
					moonrakerApiUrl: 'http://192.168.1.20:7125',
					printerName: 'Discovery',
					connectionTimeout: 5000
				}
			};
			return this.config;
		}

		const klipperConfig: KlipperConfig = {
			moonrakerHost: this.getEnvVar('VITE_MOONRAKER_HOST', '192.168.1.20'),
			moonrakerPort: parseInt(this.getEnvVar('VITE_MOONRAKER_PORT', '7125')),
			moonrakerWsUrl: this.getOptionalEnvVar('VITE_MOONRAKER_WS_URL'),
			moonrakerApiUrl: this.getOptionalEnvVar('VITE_MOONRAKER_API_URL'),
			printerName: this.getEnvVar('VITE_PRINTER_NAME', 'Discovery'),
			connectionTimeout: parseInt(this.getEnvVar('VITE_CONNECTION_TIMEOUT', '5000'))
		};

		// Construct URLs if not explicitly provided
		if (!klipperConfig.moonrakerWsUrl) {
			klipperConfig.moonrakerWsUrl = `ws://${klipperConfig.moonrakerHost}:${klipperConfig.moonrakerPort}/websocket`;
		}

		if (!klipperConfig.moonrakerApiUrl) {
			klipperConfig.moonrakerApiUrl = `http://${klipperConfig.moonrakerHost}:${klipperConfig.moonrakerPort}`;
		}

		this.config = { klipper: klipperConfig };
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

	getKlipperConfig(): KlipperConfig {
		return this.loadConfig().klipper;
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

		return {
			isValid: errors.length === 0,
			errors
		};
	}
}

export const configService = new ConfigService();
