import { ServiceError, serviceRequest, waitForJob } from '$lib/services/g2-service';
import type { Job } from '$lib/types/service';
import type {
	UsbDirectory,
	UsbImportRequest,
	UsbImportResult,
	UsbOnConflict,
	UsbStatus
} from '$lib/types/usb';

/**
 * Chiavetta USB, attraverso G2-Service (`docs/07`):
 *
 *     GET  /service/usb                → { mounted }
 *     GET  /service/usb/files?path=    → { path, dirs, files }
 *     POST /service/usb/import         → 202 + job `usb-import`
 *
 * G2-OS monta la chiavetta in sola lettura e non la collega più dentro
 * `gcodes`: Moonraker non la vede, e il file manager ne importa i file.
 */

/**
 * La copia avviene da una chiavetta montata `--sync`: un G-code da qualche
 * centinaio di MB può volerci minuti, e il default di `waitForJob` (90 s) è
 * tarato su una connessione WiFi.
 */
const IMPORT_TIMEOUT_MS = 15 * 60_000;

/** I messaggi del servizio sono in italiano: si traduce dal `code`. */
const USB_MESSAGES: Record<string, string> = {
	USB_NOT_MOUNTED: 'The USB stick has been removed.',
	USB_READ_ERROR: 'The USB stick could not be read. Was it removed?',
	STORAGE_WRITE_ERROR: 'The printer could not save the file. Is its storage full?',
	NOT_FOUND: 'That file or folder is no longer there.',
	INVALID_INPUT: 'That file cannot be imported.',
	CONFLICT: 'Another import is already running.',
	SERVICE_UNREACHABLE: 'The printer service is not answering.',
	JOB_TIMEOUT: 'The import is taking too long. Check the file list in a while.'
};

/** Perché un'operazione sulla chiavetta non è andata, in inglese. */
export function describeUsbError(error: unknown, fallback: string): string {
	if (error instanceof ServiceError) {
		return USB_MESSAGES[error.code] ?? error.message ?? fallback;
	}
	return fallback;
}

/** `true` se l'errore è il conflitto che va chiesto all'utente. */
export function isFileExists(error: unknown): boolean {
	return error instanceof ServiceError && error.code === 'FILE_EXISTS';
}

/** `GET /service/usb`. Chiamata a intervalli dal file manager. */
export function fetchUsbStatus(): Promise<UsbStatus> {
	return serviceRequest<UsbStatus>('/usb');
}

/** `GET /service/usb/files`. `path` è relativo alla chiavetta, `''` è la radice. */
export function fetchUsbDirectory(path = ''): Promise<UsbDirectory> {
	return serviceRequest<UsbDirectory>(`/usb/files?path=${encodeURIComponent(path)}`);
}

/**
 * `POST /service/usb/import`, seguito fino alla fine.
 *
 * Con `onConflict: 'fail'` un file già presente rifiuta subito con
 * `FILE_EXISTS` (vedi `isFileExists`): chi chiama chiede all'utente e ripete
 * con `overwrite` o `rename`. Nessun toast da qui, decide chi chiama.
 */
export async function importUsbFile(
	source: string,
	destDir: string,
	onConflict: UsbOnConflict = 'fail'
): Promise<UsbImportResult> {
	const request: UsbImportRequest = { source, destDir, onConflict };
	const job = await serviceRequest<Job<UsbImportResult>>('/usb/import', {
		method: 'POST',
		body: JSON.stringify(request)
	});
	return waitForJob<UsbImportResult>(job.jobId, { timeoutMs: IMPORT_TIMEOUT_MS });
}
