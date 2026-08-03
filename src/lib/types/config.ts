export interface KlipperConfig {
	/**
	 * Base URL for Moonraker's HTTP API.
	 * An empty string means "same origin": requests are issued as relative paths
	 * (`/server/...`, `/printer/...`) and nginx proxies them to Moonraker.
	 */
	moonrakerApiUrl: string;
	/** Absolute WebSocket URL for Moonraker, always including the `/websocket` path. */
	moonrakerWsUrl: string;
	/** Set only when an explicit host override is configured, otherwise empty. */
	moonrakerHost: string;
	/** Set only when an explicit host override is configured, otherwise 0. */
	moonrakerPort: number;
	printerName?: string;
	connectionTimeout?: number;
}

export interface ServiceConfig {
	/**
	 * Base URL for G2-Service, the host's own API (network, timezone).
	 * An empty string means "same origin", with nginx proxying `/service/`.
	 * The `/service` prefix itself is not configurable — it is part of the
	 * contract and is added by `g2-service.ts`.
	 */
	apiBaseUrl: string;
	/** Set only when an explicit host override is configured, otherwise empty. */
	apiHost: string;
	/** Set only when an explicit host override is configured, otherwise 0. */
	apiPort: number;
}

export interface Config {
	klipper: KlipperConfig;
	service: ServiceConfig;
}
