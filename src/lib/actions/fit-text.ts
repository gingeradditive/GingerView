import type { Action } from 'svelte/action';

/** Sotto questa dimensione il testo non si legge più: oltre si taglia con l'ellissi. */
const MIN_FONT_PX = 10;

/**
 * Tiene il testo su una riga sola rimpicciolendo il font quanto serve.
 *
 * La dimensione massima resta quella del CSS: l'azione la misura, e se il testo
 * non ci sta la riduce in proporzione. Si ricalcola quando cambia la larghezza
 * del contenitore e quando cambia il testo (passato come parametro). L'elemento
 * deve avere `white-space: nowrap` e `overflow: hidden` nel CSS.
 *
 * Uso: `<span use:fitText={testo}>{testo}</span>`
 */
export const fitText: Action<HTMLElement, string | undefined> = (node) => {
	const fit = (): void => {
		node.style.fontSize = '';
		const available = node.clientWidth;
		const needed = node.scrollWidth;
		if (available === 0 || needed <= available) return;

		const max = parseFloat(getComputedStyle(node).fontSize);
		// Un pelo di margine: l'arrotondamento dei px può lasciare fuori l'ultima lettera.
		const size = Math.max(MIN_FONT_PX, Math.floor((max * available * 0.98) / needed));
		node.style.fontSize = `${size}px`;
	};

	// Si osserva il contenitore e non il testo: il testo cambia larghezza proprio
	// quando l'azione gli cambia il font, e si rincorrerebbero.
	const observer = new ResizeObserver(fit);
	if (node.parentElement) observer.observe(node.parentElement);
	// Con il font web non ancora caricato la misura sarebbe sbagliata.
	document.fonts?.ready.then(fit);
	fit();

	return {
		update: fit,
		destroy: () => observer.disconnect()
	};
};
