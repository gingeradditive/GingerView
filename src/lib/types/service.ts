/**
 * Shapes that belong to G2-Service as a whole rather than to one of its areas:
 * the error envelope and the async job model. Both are defined in G2-Service
 * `docs/02` and are the same for every endpoint, so they live here instead of
 * being repeated next to each client.
 */

/**
 * Application error, HTTP 4xx/5xx: `{ "detail": { "code", "message" } }`.
 * The `code` is the stable part of the contract — the `message` is not.
 */
export interface ServiceErrorDetail {
	code: string;
	message: string;
}

/** One entry of a FastAPI validation error, HTTP 422: `{ "detail": [ ... ] }`. */
export interface ValidationErrorDetail {
	loc: (string | number)[];
	msg: string;
	type: string;
}

/**
 * The codes a caller can branch on.
 *
 * The first group comes from the service (`docs/02` — Modello degli errori), the
 * second from the failed outcome of a job (`docs/03`), and the last one is
 * synthesised here: no response ever carries them, but a caller still has to
 * tell "the service said no" from "the service never answered".
 *
 * The open-ended `string` keeps this a hint rather than a wall: a code added on
 * the service side must not stop compiling here.
 */
export type ServiceErrorCode =
	| 'INVALID_INPUT'
	| 'NOT_FOUND'
	| 'CONFLICT'
	| 'UPSTREAM_UNAVAILABLE'
	| 'SYSTEM_TOOL_UNAVAILABLE'
	| 'INTERNAL_ERROR'
	| 'WIFI_AUTH_FAILED'
	| 'WIFI_NETWORK_NOT_FOUND'
	| 'WIFI_TIMEOUT'
	/** Client-side: HTTP 422, the request never reached the logic. */
	| 'VALIDATION_ERROR'
	/** Client-side: the request did not get an answer at all. */
	| 'SERVICE_UNREACHABLE'
	/** Client-side: a job was still `running` when we stopped waiting for it. */
	| 'JOB_TIMEOUT'
	| (string & {});

export type JobStatus = 'running' | 'succeeded' | 'failed';

/**
 * An operation that cannot answer synchronously. `POST /service/network/wifi/connect`
 * returns one of these with `202`, and the outcome is read from
 * `GET /service/jobs/{jobId}`.
 *
 * `finishedAt`, `result` and `error` stay present and `null` while the job runs:
 * one shape to handle instead of two.
 */
export interface Job<TResult = Record<string, unknown>> {
	jobId: string;
	type: string;
	status: JobStatus;
	startedAt: string;
	finishedAt: string | null;
	result: TResult | null;
	/**
	 * The *expected* negative outcome of the operation — a wrong Wi-Fi password
	 * is this, not an HTTP error: the request was accepted and carried out.
	 */
	error: ServiceErrorDetail | null;
}
