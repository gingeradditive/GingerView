<script lang="ts">
	import { onMount } from 'svelte';
	import emblaCarouselSvelte from 'embla-carousel-svelte';
	import type { EmblaCarouselType, EmblaOptionsType } from 'embla-carousel';
	import DashboardJobInfoCard from '$lib/components/DashboardJobInfoCard.svelte';
	import DashboardTemperaturePanel from '$lib/components/DashboardTemperaturePanel.svelte';
	import DashboardFlowPanel from '$lib/components/DashboardFlowPanel.svelte';
	import DashboardZHeightPanel from '$lib/components/DashboardZHeightPanel.svelte';
	import DashboardPelletPanel from '$lib/components/DashboardPelletPanel.svelte';

	const pageCount = 5;

	let emblaApi: EmblaCarouselType | undefined = $state();
	let selectedIndex = $state(0);
	let visibleCount = $state(1);

	const options: EmblaOptionsType = {
		axis: 'x',
		loop: true,
		align: 'start',
		startIndex: 2
	};

	const onInit = (event: CustomEvent<EmblaCarouselType>): void => {
		emblaApi = event.detail;
		selectedIndex = emblaApi.selectedScrollSnap();
		emblaApi.on('select', () => {
			selectedIndex = emblaApi!.selectedScrollSnap();
		});
	};

	const scrollTo = (index: number): void => {
		emblaApi?.scrollTo(index);
	};

	const isDotActive = (index: number): boolean => {
		const diff = (index - selectedIndex + pageCount) % pageCount;
		return diff < visibleCount;
	};

	const updateVisibleCount = (): void => {
		// Stesse condizioni delle media query in fondo al file: l'altezza serve a tenere il
		// telefono in orizzontale sul layout a una slide (vedi i breakpoint in app.css).
		if (window.matchMedia('(min-width: 1200px) and (min-height: 600px)').matches) visibleCount = 5;
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
	<div class="embla" use:emblaCarouselSvelte={{ options, plugins: [] }} onemblaInit={onInit}>
		<div class="embla__container">
			<div class="embla__slide">
				<DashboardZHeightPanel />
			</div>
			<div class="embla__slide">
				<DashboardPelletPanel />
			</div>
			<div class="embla__slide">
				<DashboardJobInfoCard />
			</div>
			<div class="embla__slide">
				<DashboardTemperaturePanel />
			</div>
			<div class="embla__slide">
				<DashboardFlowPanel />
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

	.dots {
		display: flex;
		gap: 6px;
		flex-shrink: 0;
	}

	@media (min-width: 1200px) and (min-height: 600px) {
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
