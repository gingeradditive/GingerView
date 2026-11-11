<script lang="ts">
	import type { Component } from 'svelte';
	import { fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getMoonrakerApiUrl } from '$lib/services/config';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import MaterialType from '$lib/illustrations/MaterialType.svelte';
	import MaterialDry from '$lib/illustrations/MaterialDry.svelte';
	import MaterialQuantity from '$lib/illustrations/MaterialQuantity.svelte';
	import TubesEmpty from '$lib/illustrations/TubesEmpty.svelte';
	import NozzleClean from '$lib/illustrations/NozzleClean.svelte';
	import BedClear from '$lib/illustrations/BedClear.svelte';
	import GlassSpray from '$lib/illustrations/GlassSpray.svelte';
	import DryerValve from '$lib/illustrations/DryerValve.svelte';

	// Uno step per controllo, ognuno col suo disegno: la checklist è solo un promemoria
	// (niente spunte), chi la conosce passa con "Next, Next, Next" senza spostare il dito.
	// Uno step può avere più disegni affiancati, uno per controllo (il materiale ne ha tre).
	// `hint` è una riga più piccola sotto il testo, per dire perché il controllo conta.
	type WizardStep = {
		title: string;
		text: string;
		hint?: string;
		illustrations: Component[];
	};

	const steps: WizardStep[] = [
		{
			title: 'Material check',
			text: 'Check material type, dryness and quantity',
			illustrations: [MaterialType, MaterialDry, MaterialQuantity]
		},
		{
			title: 'Feed tubes',
			text: 'Feed tubes are completely clear, with no leftover pellets',
			hint: 'Even a single pellet from the last print can contaminate the new one',
			illustrations: [TubesEmpty]
		},
		{ title: 'Nozzle check', text: 'Nozzle is clean', illustrations: [NozzleClean] },
		{ title: 'Bed check', text: 'Nothing left on the bed', illustrations: [BedClear] },
		{
			title: 'Bed preparation',
			text: 'Give the glass a coat of protective spray',
			illustrations: [GlassSpray]
		},
		{ title: 'Material feed', text: "Open the dryer's slide gate", illustrations: [DryerValve] }
	];

	let {
		isOpen,
		filepath,
		thumbnailUrl = null,
		onCancel,
		onStarted
	}: {
		isOpen: boolean;
		filepath: string;
		thumbnailUrl?: string | null;
		onCancel: () => void;
		onStarted: () => void;
	} = $props();

	let stepIndex = $state(0);
	// +1 avanti, -1 indietro: da che lato entra lo step nuovo.
	let direction = $state(1);
	let starting = $state(false);
	let startError = $state('');

	$effect(() => {
		if (isOpen) {
			stepIndex = 0;
			startError = '';
		}
	});

	const isLastStep = $derived(stepIndex === steps.length - 1);
	const step = $derived(steps[stepIndex]);
	const fileName = $derived(filepath.split('/').pop() ?? filepath);

	// Le transizioni di Svelte non passano dal CSS: il "movimento ridotto" di app.css non le
	// ferma, va chiesto qui.
	const reducedMotion =
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	const cancel = (): void => {
		if (starting) return;
		onCancel();
	};

	const back = (): void => {
		if (starting) return;
		if (stepIndex === 0) {
			onCancel();
			return;
		}
		direction = -1;
		startError = '';
		stepIndex -= 1;
	};

	const proceed = async (): Promise<void> => {
		if (starting) return;

		if (!isLastStep) {
			direction = 1;
			stepIndex += 1;
			return;
		}

		starting = true;
		startError = '';
		try {
			const res = await fetch(
				`${getMoonrakerApiUrl()}/printer/print/start?filename=${encodeURIComponent(filepath)}`,
				{ method: 'POST' }
			);
			// fetch non lancia sugli errori HTTP: senza questo controllo un avvio rifiutato
			// (stampa già in corso, file sparito) portava comunque alla dashboard.
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				throw new Error(body?.error?.message ?? `The printer answered ${res.status}`);
			}
			// Close the wizard/details popup before navigating away, so we're not
			// invoking callbacks on components SvelteKit is already tearing down.
			onStarted();
			await goto(resolve('/'));
		} catch (error) {
			console.error('Print start failed', error);
			startError = error instanceof Error ? error.message : "Couldn't start the print";
		} finally {
			starting = false;
		}
	};
</script>

{#if isOpen}
	<Sheet
		label={`Print setup — step ${stepIndex + 1} of ${steps.length}: ${step.title}`}
		onClose={cancel}
		dismissible={false}
		layer={1}
		size="wide"
		panelClass="wizard-panel"
	>
		{#snippet header()}
			<div class="file-row">
				<img
					class="thumb"
					src={thumbnailUrl ?? '/error-thumbnail.png'}
					alt=""
					width="44"
					height="44"
				/>
				<div class="file-text">
					<h2 class="sheet-title">Print setup</h2>
					<p class="sheet-subtitle file-name">{fileName}</p>
				</div>
			</div>
		{/snippet}

		{#key stepIndex}
			<div
				class="step"
				in:fly={{ x: direction * 48, duration: reducedMotion ? 0 : 240, opacity: 0 }}
			>
				<div class="check">
					<div class="art" class:multi={step.illustrations.length > 1}>
						{#each step.illustrations as Illustration, i (i)}
							<div class="art-item"><Illustration /></div>
						{/each}
					</div>
					<p class="check-text">{step.text}</p>
					{#if step.hint}
						<p class="check-hint">{step.hint}</p>
					{/if}
				</div>
			</div>
		{/key}

		<!-- Sotto il disegno, appena sopra Back/Next: si vede a che punto si è mentre si va avanti. -->
		<div class="progress-bar" aria-hidden="true">
			{#each steps as _, index (index)}
				<div class="progress-segment" class:filled={index <= stepIndex}></div>
			{/each}
		</div>

		{#if startError}
			<p class="sheet-error" role="alert">Print not started: {startError}</p>
		{/if}

		{#snippet footer()}
			<button type="button" class="btn btn-secondary" disabled={starting} onclick={back}>
				{stepIndex === 0 ? 'Cancel' : 'Back'}
			</button>
			<!-- svelte-ignore a11y_autofocus -->
			<button type="button" class="btn btn-primary" disabled={starting} autofocus onclick={proceed}>
				{#if starting}
					Starting…
				{:else if isLastStep}
					{startError ? 'Try again' : 'Start print'}
				{:else}
					Next
				{/if}
			</button>
		{/snippet}
	</Sheet>
{/if}

<style>
	/* Altezza fissa su tutti gli step: il footer non si sposta mai, e "Next" resta sotto il
	   dito qualunque sia la lunghezza del testo. */
	:global(.wizard-panel) {
		height: min(620px, calc(100dvh - 48px));
	}

	@media (max-width: 767.98px) {
		:global(.wizard-panel) {
			height: min(680px, calc(100dvh - 24px));
		}
	}

	/* Testata, titoli, card e testi come nei popup di Home e Heat & extrude: al posto
	   dell'icona c'è l'anteprima del file. */
	.file-row {
		display: flex;
		align-items: flex-start;
		gap: 14px;
		min-width: 0;
	}

	.thumb {
		flex-shrink: 0;
		width: 44px;
		height: 44px;
		border-radius: 12px;
		object-fit: contain;
		background: var(--color-background);
	}

	.file-text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.file-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.progress-bar {
		flex-shrink: 0;
		margin-top: 16px;
		display: flex;
		gap: 6px;
	}

	.progress-segment {
		flex: 1;
		height: 6px;
		border-radius: 3px;
		background: var(--color-surface-sunken);
		transition: background-color 0.25s ease;
	}

	.progress-segment.filled {
		background: var(--color-red);
	}

	/* Lo step prende tutto lo spazio, la barra degli step resta in fondo. */
	:global(.wizard-panel .sheet-body) {
		display: flex;
		flex-direction: column;
	}

	.step {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.check {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 10px 20px 16px;
		border-radius: 14px;
		background: var(--color-white);
		box-shadow: inset 0 0 0 1px var(--color-border-light);
	}

	.art {
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.art-item {
		flex: 1;
		min-width: 0;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.art :global(.gv-illu) {
		max-height: 260px;
	}

	/* Più disegni (il materiale ne ha tre): a triangolo, il primo in alto al centro e gli
	   altri due sotto, su tutti gli schermi. */
	.art.multi {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		grid-template-rows: repeat(2, minmax(0, 1fr));
		gap: 4px 8px;
	}

	/* Le file si stringono verso il centro: quello sopra appoggiato in basso, gli altri
	   due in alto, così sul telefono non resta un buco in mezzo. */
	.art.multi .art-item {
		min-height: 0;
		align-items: flex-start;
	}

	.art.multi .art-item:first-child {
		grid-column: 1 / -1;
		justify-self: center;
		width: 50%;
		align-items: flex-end;
	}

	.art.multi :global(.gv-illu) {
		height: auto;
		max-height: 100%;
	}

	.check-text {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 600;
		line-height: 1.35;
		color: var(--color-text-secondary);
		text-align: center;
	}

	.check-hint {
		margin: -6px 0 0;
		font-size: 0.8rem;
		font-weight: 500;
		line-height: 1.35;
		color: var(--color-text-subtle);
		text-align: center;
	}

	.sheet-error {
		margin-top: 12px;
	}
</style>
