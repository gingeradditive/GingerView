/**
 * Dove sta andando un riscaldatore (zona dell'ugello o piatto), per le bande della dashboard.
 *
 * Si decide dal **target**, non da come varia la temperatura nel tempo: a regime oscilla di
 * qualche decimo, e un'icona che segue la derivata tremolerebbe tra "scalda" e "raffredda".
 *
 * - `heating`: c'è un target e la temperatura è ancora sotto di più della tolleranza;
 * - `ready`: c'è un target e la temperatura ci sta dentro (banda piena rossa);
 * - `cooling`: c'è un target più basso dell'attuale, oppure il riscaldatore è spento ma ancora
 *   chiaramente caldo;
 * - `idle`: spento e freddo, o dati che mancano.
 */
export type HeaterTrend = 'heating' | 'ready' | 'cooling' | 'idle';

/** Entro questa distanza dal target la banda è "a temperatura". */
export const READY_TOLERANCE_C = 5;

/**
 * Sopra questa temperatura un riscaldatore spento conta ancora come "si raffredda": è caldo da
 * toccare. Sotto è a temperatura ambiente o quasi, e non c'è niente da segnalare.
 */
export const HOT_AFTER_OFF_C = 50;

const isNumber = (value: number | null | undefined): value is number =>
	value != null && !Number.isNaN(value);

export function heaterTrend(
	temperature: number | null | undefined,
	target: number | null | undefined
): HeaterTrend {
	if (!isNumber(temperature)) return 'idle';
	const hasTarget = isNumber(target) && target > 0;

	if (!hasTarget) return temperature > HOT_AFTER_OFF_C ? 'cooling' : 'idle';
	if (Math.abs(temperature - target) <= READY_TOLERANCE_C) return 'ready';
	return temperature < target ? 'heating' : 'cooling';
}

/** Lo stato a parole, per gli `aria-label` delle bande. */
export function describeTrend(trend: HeaterTrend, target: number | null | undefined): string {
	const to = isNumber(target) && target > 0 ? ` to ${Math.round(target)}°` : '';
	switch (trend) {
		case 'heating':
			return `heating up${to}`;
		case 'cooling':
			return `cooling down${to}`;
		case 'ready':
			return 'at temperature';
		default:
			return 'off';
	}
}
