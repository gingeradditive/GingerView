<script lang="ts">
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

	const options: EmblaOptionsType = {
		axis: 'x',
		loop: true
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
</script>

<div class="dashboard-carousel">
	<div class="embla" use:emblaCarouselSvelte={{ options, plugins: [] }} onemblaInit={onInit}>
		<div class="embla__container">
			<div class="embla__slide">
				<DashboardJobInfoCard />
			</div>
			<div class="embla__slide">
				<DashboardTemperaturePanel />
			</div>
			<div class="embla__slide">
				<DashboardFlowPanel />
			</div>
			<div class="embla__slide">
				<DashboardZHeightPanel />
			</div>
			<div class="embla__slide">
				<DashboardPelletPanel />
			</div>
		</div>
	</div>
	<div class="dots">
		{#each Array(pageCount) as _, index (index)}
			<button
				class="dot"
				class:active={selectedIndex === index}
				aria-label={`Pagina ${index + 1}`}
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
