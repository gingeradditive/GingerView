/**
 * Tipi dell'import da chiavetta USB (G2-Service `docs/07`).
 *
 * La chiavetta non è più una cartella di Moonraker: la legge G2-Service, e
 * l'unica cosa che se ne fa è copiare un file nella memoria interna.
 */

/** `GET /service/usb`: `true` solo se c'è un filesystem montato, anche vuoto. */
export interface UsbStatus {
	mounted: boolean;
}

export interface UsbDir {
	name: string;
}

/** Solo file stampabili: il resto della chiavetta il servizio non lo elenca. */
export interface UsbFile {
	name: string;
	size: number;
	/** ISO 8601. */
	modified: string;
}

/** `GET /service/usb/files?path=`. `path` è `''` alla radice della chiavetta. */
export interface UsbDirectory {
	path: string;
	dirs: UsbDir[];
	files: UsbFile[];
}

/**
 * Cosa fare se nella destinazione c'è già un file con lo stesso nome. Con
 * `fail` il servizio risponde subito `409 FILE_EXISTS`: è così che si scopre il
 * conflitto prima di chiedere all'utente.
 */
export type UsbOnConflict = 'fail' | 'overwrite' | 'rename';

/** Corpo di `POST /service/usb/import`. `destDir` è relativa a `gcodes`. */
export interface UsbImportRequest {
	source: string;
	destDir: string;
	onConflict: UsbOnConflict;
}

/** `result` del job `usb-import`: il nome finale, diverso dall'originale con `rename`. */
export interface UsbImportResult {
	filename: string;
	/** Relativo a `gcodes`. */
	path: string;
}
