import { getMoonrakerApiUrl } from './config';
import { toastActions } from '$lib/stores/toastStore';

/**
 * G-code verso Kalico, in un posto solo.
 *
 * Prima ogni pannello aveva il suo `sendGcode` con `catch {}`: un PAUSE o un
 * CANCEL_PRINT rifiutato ("Printer is shutdown") non lasciava traccia, e chi
 * aveva premuto il tasto credeva fatto ciò che la macchina non aveva fatto.
 */

/**
 * Moonraker reports a refused command as `{"error": {"message": ...}}` with a
 * non-2xx status. That message is the one worth showing ("Must home axis first",
 * "Printer is shutdown"), so prefer it over the bare HTTP status text.
 */
export const readError = async (response: Response, fallback: string): Promise<string> => {
	try {
		const payload = await response.json();
		const message = payload?.error?.message;
		if (typeof message === 'string' && message.trim()) return message;
	} catch {
		// Body was not JSON — fall through to the generic message.
	}
	return `${fallback}: ${response.status} ${response.statusText}`;
};

export const describeError = (error: unknown): string =>
	error instanceof Error ? error.message : 'Unknown error';

/**
 * Throws when the printer refuses the command.
 *
 * Kalico answers `printer/gcode/script` only once every command in the script
 * has run, so a non-2xx here means the machine did **not** do what was asked.
 * The caller has to know: an extrude sequence that ignored a failed `G28` went
 * on to move, heat and extrude from an unknown position.
 */
export const runGcode = async (script: string): Promise<void> => {
	let response: Response;
	try {
		response = await fetch(
			`${getMoonrakerApiUrl()}/printer/gcode/script?script=${encodeURIComponent(script)}`,
			{ method: 'POST' }
		);
	} catch {
		throw new Error('Moonraker is unreachable');
	}
	if (!response.ok) {
		throw new Error(await readError(response, 'Command refused'));
	}
};

/**
 * `runGcode` for buttons: the failure becomes a toast titled `failureTitle`
 * instead of an exception. Returns whether the printer accepted the command,
 * for callers that update their own state only on success.
 */
export const sendGcode = async (script: string, failureTitle: string): Promise<boolean> => {
	try {
		await runGcode(script);
		return true;
	} catch (error) {
		toastActions.error('klipper', failureTitle, describeError(error));
		return false;
	}
};
