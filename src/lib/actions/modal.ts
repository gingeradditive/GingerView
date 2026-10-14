/**
 * Comportamento standard di una finestra modale, in un posto solo.
 *
 * Va sull'elemento con `role="dialog"` (l'overlay). Mentre è montato:
 * - **Escape** chiude, chiamando `onClose` — solo la modale in cima, se ce ne
 *   sono due aperte (un ConfirmModal sopra il dettaglio di un file);
 * - il **focus** entra nella modale (sul primo controllo, o su quello che ha già
 *   il focus dentro, come il campo di PromptModal) e **Tab** gira al suo interno
 *   senza finire sulla pagina sotto;
 * - la **pagina sotto non scorre**;
 * - alla chiusura il focus torna al pulsante che l'aveva aperta.
 *
 * Senza `onClose` Escape non fa nulla: per le modali che non si possono
 * chiudere a metà (avvio stampa in corso).
 *
 *     <div role="dialog" aria-modal="true" use:modal={{ onClose: cancel }}>…</div>
 */

type ModalOptions = {
	onClose?: () => void;
	/**
	 * `false`: all'apertura il focus va sulla finestra e non sul primo controllo. Al tocco
	 * il primo controllo è quasi sempre la X o Cancel, e ci si vedeva sopra l'anello del
	 * focus e il tooltip senza che nessuno l'avesse toccato. Tab porta comunque dentro.
	 */
	focusFirst?: boolean;
};

const FOCUSABLE = [
	'a[href]',
	'button:not([disabled])',
	'input:not([disabled]):not([type="hidden"])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'[tabindex]:not([tabindex="-1"])'
].join(',');

const stack: HTMLElement[] = [];
let scrollLocks = 0;
let savedOverflow = '';

const focusables = (node: HTMLElement): HTMLElement[] =>
	Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
		(el) => !el.closest('[inert]') && el.getClientRects().length > 0
	);

const lockScroll = (): void => {
	if (scrollLocks++ === 0) {
		savedOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
	}
};

const unlockScroll = (): void => {
	if (--scrollLocks === 0) document.body.style.overflow = savedOverflow;
};

export function modal(node: HTMLElement, options: ModalOptions = {}) {
	let onClose = options.onClose;
	const focusFirst = options.focusFirst ?? true;
	const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

	stack.push(node);
	lockScroll();
	if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1');

	// Dopo il primo render del contenuto (e dopo un eventuale autofocus suo).
	queueMicrotask(() => {
		if (node.contains(document.activeElement)) return;
		const first = focusFirst ? focusables(node)[0] : undefined;
		(first ?? node).focus({ preventScroll: true });
	});

	const onKeyDown = (e: KeyboardEvent): void => {
		if (stack[stack.length - 1] !== node) return;
		if (e.key === 'Escape') {
			if (!onClose) return;
			e.preventDefault();
			e.stopPropagation();
			onClose();
			return;
		}
		if (e.key !== 'Tab') return;
		const items = focusables(node);
		if (items.length === 0) {
			e.preventDefault();
			node.focus();
			return;
		}
		const first = items[0];
		const last = items[items.length - 1];
		const active = document.activeElement;
		if (e.shiftKey && (active === first || !node.contains(active))) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && (active === last || !node.contains(active))) {
			e.preventDefault();
			first.focus();
		}
	};

	document.addEventListener('keydown', onKeyDown);

	return {
		update(next: ModalOptions = {}) {
			onClose = next.onClose;
		},
		destroy() {
			document.removeEventListener('keydown', onKeyDown);
			const index = stack.lastIndexOf(node);
			if (index !== -1) stack.splice(index, 1);
			unlockScroll();
			// Solo se il pulsante c'è ancora e nessun'altra modale ha preso il focus.
			if (opener && opener.isConnected && stack.length === 0) {
				opener.focus({ preventScroll: true });
			}
		}
	};
}
