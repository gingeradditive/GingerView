export interface KlipperConfig {
	moonrakerHost: string;
	moonrakerPort: number;
	moonrakerWsUrl?: string;
	moonrakerApiUrl?: string;
	printerName?: string;
	connectionTimeout?: number;
}

export interface NetworkConfig {
	apiHost: string;
	apiPort: number;
	apiBaseUrl?: string;
}

export interface Config {
	klipper: KlipperConfig;
	network: NetworkConfig;
}
