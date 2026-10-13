/**
 * Etichetta per i pulsanti che mostrano solo un'icona.
 *
 * Il `title` nativo non serve a GingerView: al tocco non compare mai, e qui si
 * usa quasi sempre il telefono. Questa azione mostra lo stesso testo:
 * - col mouse, passandoci sopra (dopo un attimo, per non lampeggiare);
 * - con la tastiera, quando il pulsante riceve il focus;
 * - al tocco, con una **pressione lunga**: il tocco breve resta il clic di
 *   sempre, e la pressione lunga che ha mostrato l'etichetta non esegue
 *   l'azione al rilascio — serve proprio a chiedere "cosa fa?" senza farlo.
 *
 * Il testo è quello dell'`aria-label` (o del `title`, che viene tolto per non
 * avere due etichette): una stringa sola per screen reader ed etichetta.
 *
 *     <button aria-label="Upload file" use:tooltip>…</button>
 *     <button aria-label="Stop" use:tooltip={'Stop the print'}>…</button>
 *     <button aria-label="Emergency stop" use:tooltip={{ longPress: false }}>…</button>
 *
 * `longPress: false` lascia il tocco esattamente com'è (niente etichetta, niente
 * clic trattenuto): per l'emergency stop, che non deve mai essere rallentato.
 */

type TooltipOptions = string | { text?: string; longPress?: boolean } | undefined;

const readOptions = (options: TooltipOptions): { text?: string; longPress: boolean } =>
	typeof options === 'object'
		? { text: options.text, longPress: options.longPress ?? true }
		: { text: options, longPress: true };

const HOVER_DELAY_MS = 400;
const LONG_PRESS_MS = 500;
const TOUCH_VISIBLE_MS = 1600;
const MOVE_TOLERANCE_PX = 10;
const GAP_PX = 8;
const EDGE_PX = 8;

let bubble: HTMLDivElement | null = null;
let owner: Element | null = null;

const getBubble = (): HTMLDivElement => {
	if (bubble) return bubble;
	bubble = document.createElement('div');
	bubble.className = 'gv-tooltip';
	bubble.setAttribute('role', 'tooltip');
	// Il nome accessibile ce l'ha già il pulsante: l'etichetta è solo visiva.
	bubble.setAttribute('aria-hidden', 'true');
	document.body.appendChild(bubble);
	return bubble;
};

const show = (node: Element, text: string): void => {
	if (!text) return;
	const el = getBubble();
	el.textContent = text;
	el.dataset.visible = 'true';
	owner = node;

	// Sui monitor grandi la pagina è zoomata (app.css): le misure arrivano in pixel
	// dello schermo e vanno riportate in CSS px, come fa PrintCard col menu.
	const zoom =
		(document.documentElement as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom ?? 1;
	const rect = node.getBoundingClientRect();
	const anchor = {
		top: rect.top / zoom,
		bottom: rect.bottom / zoom,
		centerX: (rect.left + rect.width / 2) / zoom
	};
	const viewportWidth = window.innerWidth / zoom;

	const { width, height } = el.getBoundingClientRect();
	const w = width / zoom;
	const h = height / zoom;
	// Sopra il pulsante (il dito copre ciò che sta sotto); sotto solo se sopra
	// non c'è spazio, come per i pulsanti in cima allo schermo.
	const above = anchor.top - GAP_PX - h >= EDGE_PX;
	const top = above ? anchor.top - GAP_PX - h : anchor.bottom + GAP_PX;
	const left = Math.max(EDGE_PX, Math.min(anchor.centerX - w / 2, viewportWidth - EDGE_PX - w));
	el.style.top = `${top}px`;
	el.style.left = `${left}px`;
};

const hide = (node: Element): void => {
	if (owner !== node || !bubble) return;
	bubble.dataset.visible = 'false';
	owner = null;
};

export function tooltip(target: HTMLElement | SVGElement, options?: TooltipOptions) {
	// Anche le icone `<svg role="button">` (slider ventola/luce): per i listener
	// e lo stile i due tipi si comportano allo stesso modo.
	const node = target as HTMLElement;
	let { text: label, longPress } = readOptions(options);
	const titleText = node.getAttribute('title');
	if (titleText) node.removeAttribute('title');
	const currentText = (): string => label ?? node.getAttribute('aria-label') ?? titleText ?? '';

	let hoverTimer: ReturnType<typeof setTimeout> | undefined;
	let pressTimer: ReturnType<typeof setTimeout> | undefined;
	let hideTimer: ReturnType<typeof setTimeout> | undefined;
	let pressStart: { x: number; y: number } | null = null;
	let longPressed = false;

	const clearTimers = (): void => {
		clearTimeout(hoverTimer);
		clearTimeout(pressTimer);
		clearTimeout(hideTimer);
	};

	const onPointerEnter = (e: PointerEvent): void => {
		if (e.pointerType !== 'mouse') return;
		clearTimeout(hoverTimer);
		hoverTimer = setTimeout(() => show(node, currentText()), HOVER_DELAY_MS);
	};

	const onPointerLeave = (e: PointerEvent): void => {
		if (e.pointerType !== 'mouse') return;
		clearTimeout(hoverTimer);
		hide(node);
	};

	const onPointerDown = (e: PointerEvent): void => {
		if (e.pointerType === 'mouse') {
			// Un clic chiude l'etichetta: l'azione parte, non serve più.
			clearTimeout(hoverTimer);
			hide(node);
			return;
		}
		if (!longPress) return;
		longPressed = false;
		pressStart = { x: e.clientX, y: e.clientY };
		clearTimeout(pressTimer);
		pressTimer = setTimeout(() => {
			longPressed = true;
			show(node, currentText());
		}, LONG_PRESS_MS);
	};

	const onPointerMove = (e: PointerEvent): void => {
		if (!pressStart) return;
		// Il dito scorre (carosello, lista): è uno scroll, non una pressione lunga.
		if (Math.hypot(e.clientX - pressStart.x, e.clientY - pressStart.y) > MOVE_TOLERANCE_PX) {
			clearTimeout(pressTimer);
			pressStart = null;
		}
	};

	const onPointerEnd = (): void => {
		clearTimeout(pressTimer);
		pressStart = null;
		if (longPressed) {
			clearTimeout(hideTimer);
			hideTimer = setTimeout(() => hide(node), TOUCH_VISIBLE_MS);
		}
	};

	// La pressione lunga ha già dato la risposta: il clic che segue al rilascio
	// non deve eseguire l'azione. In cattura, prima del gestore del pulsante.
	const onClickCapture = (e: MouseEvent): void => {
		if (!longPressed) return;
		longPressed = false;
		e.preventDefault();
		e.stopImmediatePropagation();
	};

	// Su Android la pressione lunga apre il menu contestuale del browser.
	const onContextMenu = (e: Event): void => {
		if (longPressed || pressStart) e.preventDefault();
	};

	const onFocus = (): void => {
		if (node.matches(':focus-visible')) show(node, currentText());
	};
	const onBlur = (): void => hide(node);
	const onKeyDown = (e: KeyboardEvent): void => {
		if (e.key === 'Escape') hide(node);
	};

	node.addEventListener('pointerenter', onPointerEnter);
	node.addEventListener('pointerleave', onPointerLeave);
	node.addEventListener('pointerdown', onPointerDown);
	node.addEventListener('pointermove', onPointerMove);
	node.addEventListener('pointerup', onPointerEnd);
	node.addEventListener('pointercancel', onPointerEnd);
	node.addEventListener('click', onClickCapture, true);
	node.addEventListener('contextmenu', onContextMenu);
	node.addEventListener('focus', onFocus);
	node.addEventListener('blur', onBlur);
	node.addEventListener('keydown', onKeyDown);
	// iOS: niente lente/menu di selezione durante la pressione lunga.
	node.style.setProperty('-webkit-touch-callout', 'none');
	node.style.setProperty('user-select', 'none');

	return {
		update(next?: TooltipOptions) {
			({ text: label, longPress } = readOptions(next));
			if (owner === node && bubble) bubble.textContent = currentText();
		},
		destroy() {
			clearTimers();
			hide(node);
			node.removeEventListener('pointerenter', onPointerEnter);
			node.removeEventListener('pointerleave', onPointerLeave);
			node.removeEventListener('pointerdown', onPointerDown);
			node.removeEventListener('pointermove', onPointerMove);
			node.removeEventListener('pointerup', onPointerEnd);
			node.removeEventListener('pointercancel', onPointerEnd);
			node.removeEventListener('click', onClickCapture, true);
			node.removeEventListener('contextmenu', onContextMenu);
			node.removeEventListener('focus', onFocus);
			node.removeEventListener('blur', onBlur);
			node.removeEventListener('keydown', onKeyDown);
		}
	};
}
