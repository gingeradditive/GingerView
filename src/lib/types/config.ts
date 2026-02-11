export interface KlipperConfig {
	moonrakerHost: string;
	moonrakerPort: number;
	moonrakerWsUrl?: string;
	moonrakerApiUrl?: string;
	printerName?: string;
	connectionTimeout?: number;
}

export interface Config {
	klipper: KlipperConfig;
}
