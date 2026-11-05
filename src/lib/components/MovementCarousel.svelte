<script lang="ts">
	import { swipeHint } from '$lib/actions/swipe-hint';
	import CarouselSwipeHint from '$lib/components/CarouselSwipeHint.svelte';
	import { onMount } from 'svelte';
	import emblaCarouselSvelte from 'embla-carousel-svelte';
	import type { EmblaCarouselType, EmblaOptionsType } from 'embla-carousel';
	import ToolheadPosition from '$lib/components/ToolheadPosition.svelte';
	import ExtrudeDialog from '$lib/components/ExtrudeDialog.svelte';

	// Stessa condizione della media query in fondo al file (vedi i breakpoint in app.css):
	// lì le due colonne stanno entrambe a schermo e non c'è niente da far scorrere.
	const allVisibleQuery = '(min-width: 768px) and (min-height: 600px)';

	let emblaApi: EmblaCarouselType | undefined = $state();
	let visibleCount = $state(1);

	// Le card in ordine; su telefono ripetute una volta per reggere il loop con le vicine visibili.
	const cards = ['position', 'extrude'] as const;
	let slides = $derived(visibleCount === 1 ? [...cards, ...cards] : [...cards]);

	// Le slide che si vedono adesso: come nella dashboard, il pannello fuori schermo
	// resta montato e va sospeso a mano (vedi DashboardCarousel.svelte).
	let slidesInView = $state<number[]>([]);

	const options: EmblaOptionsType = {
		axis: 'x',
		// Loop infinito come nella dashboard. Su telefono le card sono all'84% con le vicine che
		// spuntano ai lati, e con due sole card Embla non riesce a farle girare: lì le slide sono
		// duplicate (vedi `slides`), quattro in tutto.
		loop: true,
		align: 'center',
		// Con tutto a schermo il carosello si spegne: niente trascinamento a vuoto.
		// Da tablet in su le due card stanno a schermo: carosello spento, allineato come prima.
		breakpoints: { [allVisibleQuery]: { active: false, align: 'start' } }
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
		visibleCount >= cards.length || slidesInView.includes(index);

	const updateVisibleCount = (): void => {
		if (window.matchMedia(allVisibleQuery).matches) visibleCount = 2;
		else visibleCount = 1;
	};

	onMount(() => {
		updateVisibleCount();
		window.addEventListener('resize', updateVisibleCount);
		return () => window.removeEventListener('resize', updateVisibleCount);
	});
</script>

<div class="movement-carousel">
	<div
		class="embla"
		use:emblaCarouselSvelte={{ options, plugins: [] }}
		use:swipeHint={{ embla: emblaApi }}
		onemblaInit={onInit}
	>
		<div class="embla__container">
			<!-- Su telefono ogni card compare due volte (Position, Heat & extrude, Position, Heat &
			     extrude): è il minimo perché il loop regga con le vicine visibili ai lati. Da tablet
			     in su le due card stanno affiancate e c'è una sola copia. -->
			{#each slides as kind, index (index)}
				<div class="embla__slide">
					{#if kind === 'position'}
						<ToolheadPosition visible={isInView(index)} />
					{:else}
						<ExtrudeDialog />
					{/if}
				</div>
			{/each}
		</div>
	</div>
	<div class="hint-slot">
		<CarouselSwipeHint />
	</div>
</div>

<style>
	.movement-carousel {
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
	}

	@media (min-width: 768px) and (min-height: 600px) {
		.embla__slide {
			flex: 0 0 50%;
		}
	}

	/* Telefono, una card alla volta: come nella dashboard, la card al centro all'84% e le vicine
	   che spuntano ai lati. Il carosello esce dai 16px di margine della pagina fino al bordo
	   dello schermo; tra le card 12px, divisi a metà sui due lati. */
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

	@media (min-width: 768px) and (min-height: 600px) {
		.hint-slot {
			display: none;
		}
	}
</style>
