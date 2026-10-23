<script lang="ts">
	import { Play } from 'lucide-svelte';
	import type { PrintItem } from '$lib/types/print';
	import { formatEstimatedTime } from '$lib/services/moonraker-files';
	import PrintStartWizard from '$lib/components/PrintStartWizard.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import StatTile from '$lib/components/ui/StatTile.svelte';

	let {
		item,
		isOpen,
		onClose
	}: {
		item: PrintItem | null;
		isOpen: boolean;
		onClose: () => void;
	} = $props();

	let showPrintWizard = $state(false);

	function handlePrintClick(): void {
		showPrintWizard = true;
	}

	function cancelPrintWizard(): void {
		showPrintWizard = false;
	}

	function handlePrintStarted(): void {
		showPrintWizard = false;
		onClose();
	}

	function formatNozzleDiameter(value?: number): string {
		if (value == null || value <= 0) return '--';
		return `${value} mm`;
	}

	function formatFilamentWeight(value?: number): string {
		if (value == null || value <= 0) return '--';
		return `${Math.round(value)} g`;
	}

	function getDurationValue(file: PrintItem): string {
		return formatEstimatedTime(file.lastPrintDuration ?? file.printTime);
	}
</script>

{#if isOpen && item}
	<Sheet label={item.name} {onClose} showClose size="lg">
		{#snippet header()}
			<h2 class="sheet-title name">{item.name}</h2>
			<p class="sheet-subtitle">{item.filamentName || item.material || '--'}</p>
		{/snippet}

		<div class="layout">
			<div class="preview">
				<img
					src={item.imageUrl ?? '/error-thumbnail.png'}
					alt={item.name}
					width="500"
					height="500"
				/>
			</div>

			<div class="stats">
				<StatTile label="Print time" value={getDurationValue(item)} iconSrc="/PrintTime.svg" />
				<StatTile
					label="Weight"
					value={formatFilamentWeight(item.filamentWeight)}
					iconSrc="/Weight.svg"
				/>
				<StatTile
					label="Nozzle"
					value={formatNozzleDiameter(item.nozzleDiameter)}
					iconSrc="/Nozzle.svg"
				/>
				<StatTile
					label="Material"
					value={item.filamentType || item.material || '--'}
					iconSrc="/Material.svg"
				/>
			</div>
		</div>

		{#snippet footer()}
			<button class="btn btn-primary print" type="button" onclick={handlePrintClick}>
				<Play size={20} fill="currentColor" />
				Print!
			</button>
		{/snippet}
	</Sheet>

	<PrintStartWizard
		isOpen={showPrintWizard}
		filepath={item.filepath}
		thumbnailUrl={item.imageUrl}
		onCancel={cancelPrintWizard}
		onStarted={handlePrintStarted}
	/>
{/if}

<style>
	.name {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		overflow-wrap: anywhere;
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
		gap: 20px;
	}

	/* La miniatura non decide l'altezza della riga: è alta quanto i quattro valori
	   accanto, e l'immagine ci sta dentro senza deformarsi. */
	.preview {
		position: relative;
		min-height: 0;
		border-radius: 18px;
		background: var(--color-surface-soft);
	}

	.preview img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
	}

	.print {
		min-height: 56px;
		font-size: 1.1rem;
	}

	@media (max-width: 767.98px) {
		.layout {
			grid-template-columns: 1fr;
			gap: 14px;
		}

		/* In colonna non c'è niente accanto da cui prendere l'altezza. */
		.preview {
			height: 200px;
		}

		.stats {
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: 8px;
		}
	}
</style>
