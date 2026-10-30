/**
 * Il punto unico di configurazione della demo.
 *
 * Tutto quello che si decide "in corso d'opera" vive qui: quanto dura una
 * stampa, quali pagine nascondere, quali azioni bloccare. Cambiare un valore e
 * fare push basta a pubblicare la nuova demo, senza toccare il simulatore.
 */

export const demoConfig = {
	/** Nome della stampante simulata, mostrato nell'avviso e nel badge. */
	printerName: 'G2 · Virtual',

	// --- tempi della stampa -------------------------------------------------

	/**
	 * Il riscaldamento finisce quando tutte le zone sono a temperatura, ma mai
	 * oltre questo limite: con un target molto alto la demo non deve restare
	 * ferma più di un minuto.
	 */
	heatingMaxSeconds: 60,

	/**
	 * Durata della fase di stampa vera e propria, riscaldamento escluso: è
	 * proporzionale al tempo stimato del file (`secondsPerPrintHour` secondi per
	 * ogni ora reale) e resta tra il minimo e il massimo. Con il riscaldamento
	 * (circa 45–60 s) il totale sta tra circa 2 e 5 minuti.
	 */
	printMinSeconds: 75,
	printMaxSeconds: 230,
	secondsPerPrintHour: 10,

	/**
	 * Movimenti e homing sono più rapidi del vero di questo fattore: su un metro
	 * di corsa la macchina vera impiega secondi che in fiera sembrano un blocco.
	 */
	motionSpeedup: 3,

	// --- pagine e azioni ----------------------------------------------------

	/**
	 * Pagine nascoste: il link sparisce e chi ci arriva dall'indirizzo torna
	 * alla dashboard. Prefissi di percorso, es. `'/settings/config-editor'`.
	 */
	hiddenRoutes: ['/settings/config-editor', '/settings/macros'] as string[],

	/**
	 * Azioni bloccate: la richiesta risponde con un errore leggibile ("not
	 * available in the demo") invece di essere simulata. Chiavi nel formato
	 * `'METODO /percorso'`, es. `'POST /machine/update/upgrade'`.
	 */
	blockedActions: [] as string[],

	/** Messaggio mostrato quando un'azione è bloccata. */
	blockedMessage: 'This action is not available in the demo.'
};

export type DemoConfig = typeof demoConfig;
