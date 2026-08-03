/**
 * Network contract of G2-Service (`docs/03` — Stato di rete, WiFi, Ethernet).
 *
 * Ethernet is part of it: the status endpoint is unified, and `adapter.type` is
 * what tells the two apart. Bodies are `camelCase`, like every other G2-Service
 * payload.
 */

export type InterfaceType = 'ethernet' | 'wifi';

/**
 * State of an interface, normalised from NetworkManager's own.
 *
 * `disconnected` and `unavailable` are different things, and the difference is
 * the one that matters here: on Ethernet `unavailable` means the cable is out,
 * `disconnected` means the cable is in but nothing is connected. A state added
 * by a future NetworkManager arrives as `unknown` rather than as an error.
 */
export type InterfaceState =
	| 'connected'
	| 'connecting'
	| 'disconnected'
	| 'unavailable'
	| 'unmanaged'
	| 'unknown';

export interface NetworkInterface {
	device: string;
	type: InterfaceType;
	state: InterfaceState;
}

/** The interface the unified status is describing. */
export interface Adapter extends NetworkInterface {
	connection: string | null;
}

/** All three are `null` when nothing is connected: the fields stay, the values change. */
export interface IpInfo {
	ipv4: string | null;
	/** Global addresses only — a link-local `fe80::` is of no use to a client. */
	ipv6: string | null;
	mac: string | null;
}

export interface SignalInfo {
	/** Signal quality, 0-100. */
	signalStrength: number;
	ssid: string;
}

/**
 * `GET /service/network/status`.
 *
 * `adapter` describes the *active* connection; with both up, Ethernet wins. With
 * nothing up, `adapter.state` is explicitly `disconnected` and the `ip` fields
 * are `null`. `interfaces` lists every known interface even when idle, which is
 * how "there is no cable" is told from "the cable is in but gets nothing".
 */
export interface NetworkStatus {
	adapter: Adapter;
	ip: IpInfo;
	/** Present only when `adapter.type` is `wifi`, `null` otherwise. */
	signalInfo: SignalInfo | null;
	interfaces: NetworkInterface[];
}

export interface WifiNetwork {
	/** Empty on a hidden network, which is what `isHidden` marks. */
	ssid: string;
	signalStrength: number;
	/**
	 * `open` on an unencrypted network, otherwise NetworkManager's own string
	 * (`WPA2`, `WPA1 WPA2`, `WPA2 802.1X`, ...). Deciding whether to ask for a
	 * password means comparing against `open`, not against the empty string.
	 */
	security: string;
	/** Channel frequency in MHz (2412, 5180), `null` when unreadable. */
	frequency: number | null;
	isHidden: boolean;
}

export interface WifiConnectRequest {
	ssid: string;
	/** Left out on an open network. When present it replaces any saved password. */
	password?: string | null;
}

/** `result` of a succeeded `wifi.connect` job. */
export interface WifiConnectResult {
	ssid: string;
	ip: IpInfo;
}
