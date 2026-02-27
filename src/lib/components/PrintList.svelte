<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import PrintCard from './PrintCard.svelte';
	import CurrentDirectory from './CurrentDirectory.svelte';
	import type { PrintItem } from '$lib/types/print';
	import { mdiFolderPlus, mdiUpload } from '@mdi/js';

	const PAGE_SIZE = 20;

	const mockPrints: PrintItem[] = [
		{ id: 1, name: 'Benchy', material: 'PLA', duration: '6h 25 min' },
		{ id: 2, name: 'Calibration Cube', material: 'PETG', duration: '45 min' },
		{ id: 3, name: 'Vase Mode Pot', material: 'PLA+', duration: '3h 10 min' },
		{ id: 4, name: 'Articulated Dragon', material: 'TPU', duration: '14h 00 min' },
		{ id: 5, name: 'Phone Stand', material: 'ABS', duration: '2h 50 min' },
		{ id: 6, name: 'Gear Set', material: 'PETG', duration: '5h 30 min' },
		{ id: 7, name: 'Miniature Tower', material: 'Resin', duration: '1h 20 min' },
		{ id: 8, name: 'Cable Organizer', material: 'PLA', duration: '1h 05 min' },
		{ id: 9, name: 'Tool Holder', material: 'ASA', duration: '4h 40 min' },
		{ id: 10, name: 'Lattice Sphere', material: 'PLA+', duration: '8h 15 min' },
		{ id: 11, name: 'Octocat Figure', material: 'ABS', duration: '7h 00 min' },
		{ id: 12, name: 'Very Long Articulated Dragon with Wings Extended', material: 'PETG', duration: '3h 35 min' },
		{ id: 13, name: 'Mechanical Keyboard Case', material: 'PLA', duration: '12h 30 min' },
		{ id: 14, name: 'Plant Pot', material: 'PETG', duration: '2h 15 min' },
		{ id: 15, name: 'Dice Tower', material: 'ABS', duration: '9h 45 min' },
		{ id: 16, name: 'Wall Mount Shelf', material: 'PLA+', duration: '3h 20 min' },
		{ id: 17, name: 'Flexible Octopus', material: 'TPU', duration: '1h 50 min' },
		{ id: 18, name: 'Camera Lens Cap', material: 'Resin', duration: '0h 45 min' },
		{ id: 19, name: 'Desk Organizer', material: 'PETG', duration: '6h 10 min' },
		{ id: 20, name: 'Honeycomb Storage Box', material: 'PLA', duration: '4h 30 min' },
		{ id: 21, name: 'Spiral Vase', material: 'PLA+', duration: '5h 00 min' },
		{ id: 22, name: 'Robot Arm Parts', material: 'ABS', duration: '11h 20 min' },
		{ id: 23, name: 'Coaster Set', material: 'PETG', duration: '1h 30 min' },
		{ id: 24, name: 'Pencil Holder', material: 'PLA', duration: '2h 40 min' },
		{ id: 25, name: ' articulated Worm', material: 'TPU', duration: '3h 15 min' },
		{ id: 26, name: 'Mini Chess Set', material: 'Resin', duration: '7h 50 min' },
		{ id: 27, name: 'Cable Management Clip', material: 'PLA+', duration: '0h 30 min' },
		{ id: 28, name: '3D Puzzle Cube', material: 'PETG', duration: '4h 10 min' },
		{ id: 29, name: 'Wall Hook Set', material: 'ABS', duration: '2h 55 min' },
		{ id: 30, name: 'Gears of War Figure', material: 'PLA', duration: '16h 40 min' },
	];

	let visibleCount = Math.min(PAGE_SIZE, mockPrints.length);
	$: visiblePrints = mockPrints.slice(0, visibleCount);
	$: hasMore = visibleCount < mockPrints.length;

	let sentinel: HTMLElement;
	let observer: IntersectionObserver;

	function loadMore() {
		if (hasMore) {
			visibleCount = Math.min(visibleCount + PAGE_SIZE, mockPrints.length);
		}
	}

	onMount(() => {
		observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) loadMore();
			},
			{ rootMargin: '200px' }
		);
		if (sentinel) observer.observe(sentinel);
	});

	onDestroy(() => {
		observer?.disconnect();
	});
</script>

<div class="print-list-page">
	<div class="page-header">
		<CurrentDirectory />
		<div class="header-actions">
			<button class="action-btn" title="Crea Cartella">
				<svg width="39" height="39" viewBox="0 0 24 24" fill="#D72E28">
					<path d={mdiFolderPlus} />
				</svg>
			</button>
			<button class="action-btn" title="Upload File">
				<svg width="39" height="39" viewBox="0 0 24 24" fill="#D72E28">
					<path d={mdiUpload} />
				</svg>
			</button>
		</div>
	</div>

	<div class="grid">
		{#each visiblePrints as item (item.id)}
			<PrintCard {item} />
		{/each}
	</div>

	{#if hasMore}
		<div bind:this={sentinel} class="sentinel"></div>
	{/if}
</div>

<style>
	.print-list-page {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 12px;
	}

	.header-actions {
		display: flex;
		gap: 12px;
		align-items: center;
	}

	.action-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 8px;
		background: transparent;
		border: none;
		cursor: pointer;
		transition: opacity 0.2s;
	}

	.action-btn:hover {
		opacity: 0.7;
	}

	
	.grid {
		display: flex;
		flex-wrap: wrap;
		gap: 24px;
		justify-content: center;
	}
</style>
