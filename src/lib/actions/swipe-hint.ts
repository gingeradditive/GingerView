import type { EmblaCarouselType } from 'embla-carousel';

/**
 * Spinta di invito sui caroselli di dashboard e Movement: poco dopo l'apertura le card
 * scivolano un attimo verso sinistra e tornano, due volte, per mostrare che si scorrono.
 *
 * Parte a ogni apertura **finché l'utente non ha fatto uno swipe almeno una volta** su quel
 * dispositivo; da lì in poi non serve più. Il ricordo sta in `localStorage`: è una comodità
 * del singolo browser, non un'impostazione della macchina, e se il browser non lo concede
 * la spinta semplicemente si ripete.
 *
 * Mai con "riduci movimento" e solo nel layout a una card (`ONE_CARD_QUERY`, lo stesso
 * confine dei caroselli): da tablet in su le card sono a schermo e non c'è niente da mostrare. L'animazione è in CSS su `translate` del contenitore delle
 * slide (vedi `.swipe-hint` in app.css), che si somma al `transform` di Embla senza
 * toccarlo: la card selezionata non cambia e i pannelli non si risvegliano.
 *
 *     <div class="embla" use:swipeHint={{ embla: emblaApi }}>
 */
const STORAGE_KEY = 'gingerview.swipe-learned';
const START_DELAY_MS = 800;
const ONE_CARD_QUERY = '(max-width: 767.98px), (max-height: 599.98px)';

type Params = { embla: EmblaCarouselType | undefined };

const hasLearned = (): boolean => {
	try {
		return localStorage.getItem(STORAGE_KEY) === '1';
	} catch {
		return false;
	}
};

const markLearned = (): void => {
	try {
		localStorage.setItem(STORAGE_KEY, '1');
	} catch {
		// Senza storage la spinta tornerà alla prossima apertura: niente di grave.
	}
};

export function swipeHint(node: HTMLElement, params: Params) {
	let played = false;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let detach: (() => void) | null = null;

	const stop = (): void => {
		if (timer !== null) clearTimeout(timer);
		timer = null;
		node.classList.remove('swipe-hint');
	};

	const onAnimationEnd = (event: AnimationEvent): void => {
		if (event.animationName === 'swipe-hint') node.classList.remove('swipe-hint');
	};
	node.addEventListener('animationend', onAnimationEnd);

	function apply({ embla }: Params): void {
		detach?.();
		detach = null;
		if (!embla) return;

		// Uno swipe vero: il dito ha trascinato e la card selezionata è cambiata. Un tocco
		// sulle card non conta, le frecce e i puntini stanno fuori da Embla.
		let startIndex: number | null = null;
		const onPointerDown = (): void => {
			stop();
			startIndex = embla.selectedScrollSnap();
		};
		const onSettle = (): void => {
			if (startIndex !== null && embla.selectedScrollSnap() !== startIndex) markLearned();
			startIndex = null;
		};
		embla.on('pointerDown', onPointerDown);
		embla.on('settle', onSettle);
		detach = () => {
			embla.off('pointerDown', onPointerDown);
			embla.off('settle', onSettle);
		};

		if (played || hasLearned()) return;
		if (!window.matchMedia(ONE_CARD_QUERY).matches) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		played = true;
		timer = setTimeout(() => {
			timer = null;
			node.classList.add('swipe-hint');
		}, START_DELAY_MS);
	}

	apply(params);

	return {
		update: apply,
		destroy() {
			stop();
			detach?.();
			node.removeEventListener('animationend', onAnimationEnd);
		}
	};
}
