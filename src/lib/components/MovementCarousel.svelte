<script lang="ts">
	import { onMount } from 'svelte';
	import emblaCarouselSvelte from 'embla-carousel-svelte';
	import type { EmblaCarouselType, EmblaOptionsType } from 'embla-carousel';
	import ToolheadPosition from '$lib/components/ToolheadPosition.svelte';
	import ExtrudeDialog from '$lib/components/ExtrudeDialog.svelte';

	const pageCount = 2;

	let emblaApi: EmblaCarouselType | undefined = $state();
	let selectedIndex = $state(0);
	let visibleCount = $state(1);

	const options: EmblaOptionsType = {
		axis: 'x',
		loop: true,
		align: 'start'
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
		// Stessa condizione della media query in fondo al file (vedi i breakpoint in app.css).
		if (window.matchMedia('(min-width: 768px) and (min-height: 600px)').matches) visibleCount = 2;
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
				<ToolheadPosition />
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
				aria-label={`Pagina ${index + 1}`}
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

		.dots {
			display: none;
		}
	}

	.dots {
		display: flex;
		gap: 6px;
		flex-shrink: 0;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		border: none;
		background: #d9d9d9;
		padding: 0;
		cursor: pointer;
	}

	.dot.active {
		background: #828282;
	}
</style>
