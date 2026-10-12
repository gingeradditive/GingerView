<script lang="ts">
	import { onMount } from 'svelte';
	import emblaCarouselSvelte from 'embla-carousel-svelte';
	import type { EmblaCarouselType, EmblaOptionsType } from 'embla-carousel';
	import ToolheadPosition from '$lib/components/ToolheadPosition.svelte';
	import ExtrudeDialog from '$lib/components/ExtrudeDialog.svelte';

	const pageCount = 2;

	// Stessa condizione della media query in fondo al file (vedi i breakpoint in app.css):
	// lì le due colonne stanno entrambe a schermo e non c'è niente da far scorrere.
	const allVisibleQuery = '(min-width: 768px) and (min-height: 600px)';

	let emblaApi: EmblaCarouselType | undefined = $state();
	let selectedIndex = $state(0);
	let visibleCount = $state(1);

	// Le slide che si vedono adesso: come nella dashboard, il pannello fuori schermo
	// resta montato e va sospeso a mano (vedi DashboardCarousel.svelte).
	let slidesInView = $state<number[]>([]);

	const options: EmblaOptionsType = {
		axis: 'x',
		loop: true,
		align: 'start',
		// Con tutto a schermo il carosello si spegne: niente trascinamento a vuoto.
		breakpoints: { [allVisibleQuery]: { active: false } }
	};

	const onInit = (event: CustomEvent<EmblaCarouselType>): void => {
		emblaApi = event.detail;
		selectedIndex = emblaApi.selectedScrollSnap();
		slidesInView = emblaApi.slidesInView();
		emblaApi.on('select', () => {
			selectedIndex = emblaApi!.selectedScrollSnap();
		});
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

	const scrollTo = (index: number): void => {
		emblaApi?.scrollTo(index);
	};

	const isDotActive = (index: number): boolean => {
		const diff = (index - selectedIndex + pageCount) % pageCount;
		return diff < visibleCount;
	};

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
	<div class="embla" use:emblaCarouselSvelte={{ options, plugins: [] }} onemblaInit={onInit}>
		<div class="embla__container">
			<div class="embla__slide">
				<ToolheadPosition visible={isInView(0)} />
			</div>
			<div class="embla__slide">
				<ExtrudeDialog />
			</div>
		</div>
	</div>
	<div class="dots">
		{#each Array(pageCount) as _, index (index)}
			<button
				class="dot"
				class:active={isDotActive(index)}
				aria-label={`Page ${index + 1}`}
				onclick={() => scrollTo(index)}
			></button>
		{/each}
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

	.dots {
		display: flex;
		gap: 6px;
		flex-shrink: 0;
	}

	/* Dopo la regola base: prima, a parità di specificità, vinceva `display: flex`
	   e i pallini restavano anche con entrambe le colonne a schermo. */
	@media (min-width: 768px) and (min-height: 600px) {
		.dots {
			display: none;
		}
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		border: none;
		background: var(--color-divider);
		padding: 0;
		cursor: pointer;
	}

	.dot.active {
		background: var(--color-text-subtle);
	}
</style>
