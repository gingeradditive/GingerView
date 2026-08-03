import { serviceRequest, waitForJob } from '$lib/services/g2-service';
import type { Job } from '$lib/types/service';
import type {
	NetworkStatus,
	WifiConnectRequest,
	WifiConnectResult,
	WifiNetwork
} from '$lib/types/network';

/**
 * Network endpoints of G2-Service (`docs/03`).
 *
 * The status is unified over Wi-Fi and Ethernet: there is no separate "am I on a
 * cable" call to make, `adapter.type` says which one is carrying the connection.
 *
 * Connecting is asynchronous and for a reason that is not about duration: it
 * changes the machine's IP address, so the HTTP connection carrying the request
 * dies before a synchronous answer could come back. The service therefore hands
 * back a job, and `connectToWifi()` follows it — see `waitForJob()`.
 */

/** `GET /service/network/status`. */
export function fetchNetworkStatus(): Promise<NetworkStatus> {
	return serviceRequest<NetworkStatus>('/network/status');
}

/**
 * `GET /service/network/wifi/networks` — NetworkManager's last known scan,
 * without forcing a new one. This is the one to call on page load: it answers
 * immediately.
 */
export function fetchWifiNetworks(): Promise<WifiNetwork[]> {
	return serviceRequest<WifiNetwork[]>('/network/wifi/networks');
}

/**
 * `POST /service/network/wifi/rescan` — forces a scan and waits for its results.
 * Slower than reading the last one, so it belongs to an explicit "Scan", not to
 * a poll.
 */
export function rescanWifiNetworks(): Promise<WifiNetwork[]> {
	return serviceRequest<WifiNetwork[]>('/network/wifi/rescan', { method: 'POST' });
}

/**
 * `POST /service/network/wifi/connect`, followed to its outcome.
 *
 * Resolves with the new address once the machine is on the network. A wrong
 * password comes back as a rejection carrying `WIFI_AUTH_FAILED` — it is the
 * job's failed outcome, never an HTTP error.
 */
export async function connectToWifi(request: WifiConnectRequest): Promise<WifiConnectResult> {
	const job = await serviceRequest<Job<WifiConnectResult>>('/network/wifi/connect', {
		method: 'POST',
		body: JSON.stringify(request)
	});
	return waitForJob<WifiConnectResult>(job.jobId);
}

/**
 * Whether a network needs a password. The contract says to compare against
 * `open`: an empty string is not what an unencrypted network reports.
 */
export function isSecured(network: WifiNetwork): boolean {
	return network.security !== 'open';
}
