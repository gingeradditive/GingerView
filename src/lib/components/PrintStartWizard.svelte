<script lang="ts">
	import type { Component } from 'svelte';
	import { fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getMoonrakerApiUrl } from '$lib/services/config';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import MaterialCheck from '$lib/illustrations/MaterialCheck.svelte';
	import TubesEmpty from '$lib/illustrations/TubesEmpty.svelte';
	import NozzleClean from '$lib/illustrations/NozzleClean.svelte';
	import BedClear from '$lib/illustrations/BedClear.svelte';
	import GlassSpray from '$lib/illustrations/GlassSpray.svelte';
	import DryerValve from '$lib/illustrations/DryerValve.svelte';

	// Uno step per controllo, ognuno col suo disegno: la checklist è solo un promemoria
	// (niente spunte), chi la conosce passa con "Next, Next, Next" senza spostare il dito.
	type WizardStep = { title: string; text: string; illustration: Component };

	const steps: WizardStep[] = [
		{
			title: 'Material check',
			text: 'Right material, dry, and enough of it for this print',
			illustration: MaterialCheck
		},
		{ title: 'Feed tubes', text: 'Feed tubes are empty', illustration: TubesEmpty },
		{ title: 'Nozzle check', text: 'Nozzle is clean', illustration: NozzleClean },
		{ title: 'Bed check', text: 'Bed is clear', illustration: BedClear },
		{
			title: 'Bed preparation',
			text: 'Apply the protective glass spray',
			illustration: GlassSpray
		},
		{ title: 'Material feed', text: "Open the dryer's material valve", illustration: DryerValve }
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
			startError = error instanceof Error ? error.message : 'Could not start the print';
		} finally {
			starting = false;
		}
	};
</script>

{#if isOpen}
	<Sheet
		label={`Print start checklist — step ${stepIndex + 1} of ${steps.length}`}
		onClose={cancel}
		dismissible={false}
		showClose
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
					<span class="eyebrow">Ready to print</span>
					<span class="file-name">{fileName}</span>
				</div>
			</div>
			<div class="progress">
				<span class="progress-label">
					Step {stepIndex + 1} of {steps.length}
				</span>
				<div class="progress-bar" aria-hidden="true">
					{#each steps as _, index (index)}
						<div class="progress-segment" class:filled={index <= stepIndex}></div>
					{/each}
				</div>
			</div>
		{/snippet}

		{#key stepIndex}
			<div
				class="step"
				in:fly={{ x: direction * 48, duration: reducedMotion ? 0 : 240, opacity: 0 }}
			>
				<h3 class="sheet-title">{step.title}</h3>
				<div class="check">
					<div class="art">
						<step.illustration />
					</div>
					<p class="check-text">{step.text}</p>
				</div>
			</div>
		{/key}

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

	.file-row {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}

	.thumb {
		flex-shrink: 0;
		width: 44px;
		height: 44px;
		border-radius: 10px;
		object-fit: contain;
		background: var(--color-background);
	}

	.file-text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.eyebrow {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-text-subtle);
	}

	.file-name {
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--color-black);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.progress {
		margin-top: 16px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.progress-label {
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--color-red);
	}

	.progress-bar {
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

	.step {
		display: flex;
		flex-direction: column;
		gap: 14px;
		height: 100%;
	}

	.check {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px 20px 20px;
		border-radius: 16px;
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

	.art :global(.gv-illu) {
		max-height: 260px;
	}

	.check-text {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 600;
		line-height: 1.35;
		color: var(--color-text-secondary);
		text-align: center;
	}

	.sheet-error {
		margin-top: 12px;
	}
</style>
