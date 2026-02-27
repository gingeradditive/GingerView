<script lang="ts">
	import PrintCard from './PrintCard.svelte';
	import CurrentDirectory from './CurrentDirectory.svelte';
	import type { PrintItem } from '$lib/types/print';
	import { mdiFolderPlus, mdiUpload } from '@mdi/js';

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
	];
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
		{#each mockPrints as item (item.id)}
			<PrintCard {item} />
		{/each}
	</div>
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
