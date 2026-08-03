import { configService } from '$lib/services/config';
import type { Job, ServiceErrorCode, ValidationErrorDetail } from '$lib/types/service';

/**
 * Transport shared by every G2-Service client.
 *
 * G2-Service is the API of the *host*: network, timezone, and the configuration
 * of the physical machine — everything Moonraker does not deal with. It listens
 * on port 8000, and nginx proxies `/service/` to it on the printer's own origin,
 * so in production these requests are relative and no address is compiled into
 * the bundle.
 *
 * Three things are contract-wide (G2-Service `docs/02`) and therefore live here
 * rather than in each client: the `/service` prefix, the error envelope, and the
 * job model for operations that cannot answer synchronously.
 *
 * No toasts are raised from this layer. A failure means different things to
 * different pages — the network page shows it inline, a save shows it as a
 * toast — so the decision belongs to the caller.
 */

/**
 * Every endpoint lives under this prefix, Swagger included. It is not
 * configurable on the service either: it is paired with the nginx rule
 * `location ^~ /service/`, and `/service/` (ours) is not `/server/` (Moonraker).
 */
const API_PREFIX = '/service';

/** How often a running job is polled. */
const JOB_POLL_INTERVAL_MS = 1000;

/**
 * How long a job is followed before giving up on it. `nmcli` is given 60s to
 * associate, so anything under that would time out on the client while the
 * printer is still doing exactly what it was asked.
 */
const JOB_TIMEOUT_MS = 90_000;

/**
 * A request that did not succeed, with the `code` the caller can branch on.
 *
 * The code is either the service's own (`SYSTEM_TOOL_UNAVAILABLE`), the failed
 * outcome of a job (`WIFI_AUTH_FAILED`), or one of the client-side codes listed
 * in `ServiceErrorCode`.
 */
export class ServiceError extends Error {
	constructor(
		message: string,
		readonly code: ServiceErrorCode,
		/** Absent when no response was received at all. */
		readonly status?: number
	) {
		super(message);
		this.name = 'ServiceError';
	}

	/**
	 * True when the service never answered. Worth telling apart: during a Wi-Fi
	 * connection this is the expected state, not a fault.
	 */
	get unreachable(): boolean {
		return this.code === 'SERVICE_UNREACHABLE';
	}
}

/** Base URL of G2-Service, empty in the same-origin setup. */
function baseUrl(): string {
	return configService.getServiceConfig().apiBaseUrl.replace(/\/$/, '');
}

/**
 * Issues a request against `/service/…` and returns the decoded body, throwing a
 * `ServiceError` on anything else. `204 No Content` resolves to `undefined`.
 */
export async function serviceRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
	const url = `${baseUrl()}${API_PREFIX}${path}`;

	let response: Response;
	try {
		response = await fetch(url, {
			...options,
			headers: { 'Content-Type': 'application/json', ...options.headers }
		});
	} catch {
		throw new ServiceError(
			'The printer service is not answering. Check that G2-Service is running.',
			'SERVICE_UNREACHABLE'
		);
	}

	if (!response.ok) {
		throw await readError(response);
	}

	if (response.status === 204) {
		return undefined as T;
	}
	return (await response.json()) as T;
}

/**
 * Turns an error response into a `ServiceError`.
 *
 * Two shapes travel under `detail`: an object `{ code, message }` for the
 * application errors we raise ourselves, and a list for the validation errors
 * FastAPI generates on its own. A body in neither shape is not worth guessing
 * at — the status line is more honest than a made-up code.
 */
async function readError(response: Response): Promise<ServiceError> {
	let detail: unknown;
	try {
		detail = ((await response.json()) as { detail?: unknown })?.detail;
	} catch {
		detail = undefined;
	}

	if (detail && typeof detail === 'object' && !Array.isArray(detail) && 'code' in detail) {
		const { code, message } = detail as { code: string; message?: string };
		return new ServiceError(message || code, code, response.status);
	}

	if (Array.isArray(detail)) {
		const first = detail[0] as ValidationErrorDetail | undefined;
		return new ServiceError(first?.msg ?? 'Invalid request', 'VALIDATION_ERROR', response.status);
	}

	return new ServiceError(
		`HTTP ${response.status} — ${response.statusText || 'request failed'}`,
		'INTERNAL_ERROR',
		response.status
	);
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Follows a job to its end and returns its `result`.
 *
 * A failed job is *not* an HTTP error — the operation was accepted and carried
 * out, it simply came out negative — so it is thrown here with the job's own
 * code (`WIFI_AUTH_FAILED`, ...) and the caller decides what to say about it.
 *
 * Requests that get no answer are retried until the deadline instead of ending
 * the wait: joining a Wi-Fi network changes the machine's address, so losing the
 * connection halfway through is the normal path of the very operation being
 * followed. What survives the deadline is rethrown, so the caller can still tell
 * "it never answered again" from "it is still running".
 */
export async function waitForJob<T>(
	jobId: string,
	options: { timeoutMs?: number } = {}
): Promise<T> {
	const deadline = Date.now() + (options.timeoutMs ?? JOB_TIMEOUT_MS);
	let unreachable: ServiceError | null = null;

	for (;;) {
		try {
			const job = await serviceRequest<Job<T>>(`/jobs/${encodeURIComponent(jobId)}`);

			if (job.status === 'succeeded') {
				return job.result as T;
			}
			if (job.status === 'failed') {
				throw new ServiceError(
					job.error?.message ?? 'The operation failed.',
					job.error?.code ?? 'INTERNAL_ERROR'
				);
			}
			unreachable = null;
		} catch (error) {
			if (!(error instanceof ServiceError) || !error.unreachable) throw error;
			unreachable = error;
		}

		if (Date.now() >= deadline) {
			throw (
				unreachable ??
				new ServiceError('The operation is taking longer than expected.', 'JOB_TIMEOUT')
			);
		}
		await delay(JOB_POLL_INTERVAL_MS);
	}
}
