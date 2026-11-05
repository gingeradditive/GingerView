<script lang="ts">
	import { swipeHint } from '$lib/actions/swipe-hint';
	import CarouselSwipeHint from '$lib/components/CarouselSwipeHint.svelte';
	import { onMount } from 'svelte';
	import emblaCarouselSvelte from 'embla-carousel-svelte';
	import type { EmblaCarouselType, EmblaOptionsType } from 'embla-carousel';
	import DashboardJobInfoCard from '$lib/components/DashboardJobInfoCard.svelte';
	import DashboardTemperaturePanel from '$lib/components/DashboardTemperaturePanel.svelte';
	import DashboardFlowPanel from '$lib/components/DashboardFlowPanel.svelte';
	import DashboardZHeightPanel from '$lib/components/DashboardZHeightPanel.svelte';
	import DashboardPelletPanel from '$lib/components/DashboardPelletPanel.svelte';

	const pageCount = 5;

	// Stessa condizione dell'ultima media query in fondo al file: i cinque pannelli
	// sono tutti a schermo e non c'è niente da far scorrere.
	const allVisibleQuery = '(min-width: 1200px) and (min-height: 600px)';
	// Da qui in su si vedono tre card: allineate a sinistra come prima, senza le vicine ai lati.
	const tabletQuery = '(min-width: 768px) and (min-height: 600px)';

	let emblaApi: EmblaCarouselType | undefined = $state();
	let visibleCount = $state(1);

	// Le slide che si vedono adesso. Embla tiene tutte le slide nel DOM, quindi senza
	// questo elenco i pannelli fuori schermo continuerebbero a interrogare Moonraker:
	// ognuno riceve `visible` e sospende il polling quando esce di scena.
	let slidesInView = $state<number[]>([]);

	const options: EmblaOptionsType = {
		axis: 'x',
		loop: true,
		// Su telefono la card sta al centro e le vicine spuntano ai lati: si vede che si scorre.
		align: 'center',
		startIndex: 2,
		// Con tutto a schermo il carosello si spegne: niente trascinamento a vuoto.
		breakpoints: {
			[tabletQuery]: { align: 'start' },
			[allVisibleQuery]: { active: false }
		}
	};

	const onInit = (event: CustomEvent<EmblaCarouselType>): void => {
		emblaApi = event.detail;
		slidesInView = emblaApi.slidesInView();
		emblaApi.on('slidesInView', () => {
			slidesInView = emblaApi!.slidesInView();
		});
		emblaApi.on('reInit', () => {
			slidesInView = emblaApi!.slidesInView();
		});
	};

	// Da spento Embla non tiene più il conto delle slide visibili: lì sono tutte.
	const isInView = (index: number): boolean =>
		visibleCount >= pageCount || slidesInView.includes(index);

	const updateVisibleCount = (): void => {
		// Stesse condizioni delle media query in fondo al file: l'altezza serve a tenere il
		// telefono in orizzontale sul layout a una slide (vedi i breakpoint in app.css).
		if (window.matchMedia(allVisibleQuery).matches) visibleCount = 5;
		else if (window.matchMedia('(min-width: 768px) and (min-height: 600px)').matches)
			visibleCount = 3;
		else visibleCount = 1;
	};

	onMount(() => {
		updateVisibleCount();
		window.addEventListener('resize', updateVisibleCount);
		return () => window.removeEventListener('resize', updateVisibleCount);
	});
</script>

<div class="dashboard-carousel">
	<div
		class="embla"
		use:emblaCarouselSvelte={{ options, plugins: [] }}
		use:swipeHint={{ embla: emblaApi }}
		onemblaInit={onInit}
	>
		<div class="embla__container">
			<div class="embla__slide">
				<DashboardZHeightPanel visible={isInView(0)} />
			</div>
			<div class="embla__slide">
				<DashboardPelletPanel visible={isInView(1)} />
			</div>
			<div class="embla__slide">
				<DashboardJobInfoCard visible={isInView(2)} />
			</div>
			<div class="embla__slide">
				<DashboardTemperaturePanel visible={isInView(3)} />
			</div>
			<div class="embla__slide">
				<DashboardFlowPanel visible={isInView(4)} />
			</div>
		</div>
	</div>
	<div class="hint-slot">
		<CarouselSwipeHint />
	</div>
</div>

<style>
	.dashboard-carousel {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		width: 100%;
		height: 100%;
		min-height: 0;
	}

	.embla {
		width: 100%;
		flex: 1;
		min-height: 0;
		overflow: hidden;
		padding: 10px 0;
		box-sizing: border-box;
	}

	.embla__container {
		display: flex;
		height: 100%;
		margin-left: -1.5rem;
	}

	.embla__slide {
		flex: 0 0 100%;
		min-width: 0;
		height: 100%;
		padding-left: 1.5rem;
		box-sizing: border-box;
		/* Il riferimento per i testi delle card: il contenuto della slide è la card intera. */
		container-type: size;
	}

	/* Testi delle card della dashboard: titolo come "FLOW", sottotitolo come "Let me extrude!".
	   Registrate come <length>, le unità cq si risolvono qui, sulla slide, e le card ereditano
	   già i px; senza registrazione si risolverebbero sul container più vicino a chi le usa,
	   diverso in ogni card (la colonna di Z HEIGHT, il cerchio di FLOW). Stanno qui e non in
	   app.css perché Tailwind ci aggiunge un fallback per Safari che le riporta al valore
	   iniziale su ogni elemento. Il valore iniziale non può essere in rem. */
	@property --dashboard-title-size {
		syntax: '<length>';
		inherits: true;
		initial-value: 32px;
	}

	@property --dashboard-subtitle-size {
		syntax: '<length>';
		inherits: true;
		initial-value: 27.2px;
	}

	/* Stessa misura del cerchio di FLOW (il quadrato più grande dentro la card, tolti i
	   16px di padding): ogni card scrive titolo e sottotitolo con le stesse dimensioni. */
	.embla__slide > :global(*) {
		--dashboard-title-size: min(2rem, calc((min(100cqw, 100cqh) - 32px) * 0.12));
		--dashboard-subtitle-size: min(1.7rem, calc((min(100cqw, 100cqh) - 32px) * 0.09));
	}

	@media (min-width: 768px) and (max-width: 1199.98px) and (min-height: 600px) {
		.embla__slide {
			flex: 0 0 calc(100% / 3);
		}
	}

	@media (min-width: 1200px) and (min-height: 600px) {
		.embla__slide {
			flex: 0 0 20%;
		}
	}

	/* Telefono, una card alla volta: la card al centro all'84% e le vicine che spuntano ai lati,
	   così si vede che si scorre. Il carosello esce dai 16px di margine della pagina e arriva al
	   bordo dello schermo; tra le card 12px invece di 24, divisi a metà sui due lati. */
	@media (max-width: 767.98px), (max-height: 599.98px) {
		.embla {
			width: calc(100% + 32px);
			margin-inline: -16px;
		}

		.embla__container {
			margin-left: 0;
		}

		.embla__slide {
			flex: 0 0 84%;
			padding: 0 6px;
		}
	}

	/* Con tutte le card a schermo non c'è niente da scorrere: niente scritta. */
	.hint-slot {
		flex-shrink: 0;
	}

	@media (min-width: 1200px) and (min-height: 600px) {
		.hint-slot {
			display: none;
		}
	}
</style>
