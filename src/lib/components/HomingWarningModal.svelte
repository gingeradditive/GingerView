<script lang="ts">
	import { mdiHome, mdiPrinter3dNozzle } from '@mdi/js';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import { fitText } from '$lib/actions/fit-text';
	import NozzleClean from '$lib/illustrations/NozzleClean.svelte';
	import BedClear from '$lib/illustrations/BedClear.svelte';

	// Gli stessi due controlli dello step "Nozzle & bed" del wizard di stampa, con gli stessi
	// disegni, prima di ogni movimento automatico della testa. `action` dice cosa sta per
	// succedere: "Confirm" da solo non lo diceva.
	// `allowInPlace` (solo per l'estrusione) aggiunge l'interruttore per
	// estrudere dove sta la testa, senza homing né spostamento.
	let {
		isOpen,
		action = 'home',
		allowInPlace = false,
		onConfirm,
		onCancel
	}: {
		isOpen: boolean;
		action?: 'home' | 'extrude';
		allowInPlace?: boolean;
		onConfirm: (options: { inPlace: boolean }) => void;
		onCancel: () => void;
	} = $props();

	const showInPlace = $derived(action === 'extrude' && allowInPlace);
	let inPlace = $state(false);

	// Spento a ogni apertura: saltare homing e spostamento va scelto ogni volta.
	$effect(() => {
		if (isOpen) inPlace = false;
	});

	const copy = $derived(
		action === 'extrude'
			? {
					title: 'Heat & extrude',
					text: 'Heats the nozzle and extrudes some material.',
					lead: 'Before extruding, make sure:',
					confirm: 'Heat & extrude'
				}
			: {
					title: 'Home the printer',
					text: 'The print head will move to the endstops to find its home position.',
					lead: 'Before homing, make sure:',
					confirm: 'Home'
				}
	);
</script>

{#if isOpen}
	<Sheet label={copy.title} onClose={onCancel} size="md" panelClass="homing-sheet">
		{#snippet header()}
			<div class="head">
				<span class="badge" aria-hidden="true">
					<!-- La stessa icona del pulsante che apre il popup (Heat & extrude, Home). -->
					<svg viewBox="0 0 24 24" class="badge-icon">
						<path d={action === 'extrude' ? mdiPrinter3dNozzle : mdiHome} />
					</svg>
				</span>
				<div class="head-text">
					<h3 class="sheet-title">{copy.title}</h3>
					<!-- Su una riga: il popup è largo abbastanza. Se non lo è, il font si riduce
					     quanto serve; sul telefono va a capo (vedi lo stile). -->
					<p class="sheet-subtitle one-line" use:fitText={copy.text}>{copy.text}</p>
				</div>
			</div>
		{/snippet}

		<p class="lead">{copy.lead}</p>
		<ul class="checks">
			<li class="check">
				<div class="art"><NozzleClean /></div>
				<span>Nozzle is clean</span>
			</li>
			<li class="check">
				<div class="art"><BedClear /></div>
				<span>Bed is clear</span>
			</li>
		</ul>

		{#if showInPlace}
			<button
				type="button"
				class="in-place"
				role="switch"
				aria-checked={inPlace}
				onclick={() => (inPlace = !inPlace)}
			>
				<span class="in-place-text">
					<span class="in-place-title">Extrude in place</span>
					<span class="in-place-hint"
						>Extrudes at the current position, without homing.<br />Works with motors disabled.</span
					>
				</span>
				<span class="track" class:on={inPlace} aria-hidden="true"><span class="thumb"></span></span>
			</button>
		{/if}

		{#snippet footer()}
			<button type="button" class="btn btn-secondary" onclick={onCancel}>Cancel</button>
			<button
				type="button"
				class="btn btn-primary"
				onclick={() => onConfirm({ inPlace: showInPlace && inPlace })}>{copy.confirm}</button
			>
		{/snippet}
	</Sheet>
{/if}

<style>
	.badge-icon {
		width: 22px;
		height: 22px;
		fill: currentColor;
	}

	/* Più largo della taglia md (460px): la frase sotto il titolo sta su una riga. */
	:global(.sheet-panel.size-md.homing-sheet) {
		max-width: 620px;
	}

	.head-text {
		min-width: 0;
	}

	.one-line {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Sul telefono il popup è già largo quanto lo schermo e la frase dell'homing non ci sta
	   nemmeno al font minimo: va a capo invece di essere tagliata. */
	@media (max-width: 767.98px) {
		.one-line {
			white-space: normal;
			overflow: visible;
		}
	}

	.head {
		display: flex;
		align-items: flex-start;
		gap: 14px;
	}

	.badge {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 12px;
		background: var(--color-danger-bg);
		color: var(--color-red);
	}

	.lead {
		margin: 0 0 10px;
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--color-text-muted);
	}

	.checks {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.check {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 10px;
		border-radius: 14px;
		box-shadow: inset 0 0 0 1px var(--color-border-light);
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--color-text-secondary);
		text-align: center;
	}

	.art {
		width: 100%;
		height: 96px;
	}

	/* Una riga di impostazione, non una card: le card sopra sono controlli da guardare, questa
	   si tocca. L'interruttore è ben visibile anche da spento. */
	.in-place {
		margin-top: 16px;
		width: 100%;
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 0;
		border: none;
		background: none;
		text-align: left;
		cursor: pointer;
	}

	.in-place-text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.in-place-title {
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--color-black);
	}

	.in-place-hint {
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--color-text-subtle);
	}

	.track {
		flex-shrink: 0;
		position: relative;
		width: 52px;
		height: 30px;
		border-radius: 15px;
		background: var(--color-text-subtle);
		transition: background 0.2s ease;
	}

	.in-place:hover .track:not(.on) {
		background: var(--color-text-muted);
	}

	.track.on {
		background: var(--color-red);
	}

	.thumb {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--color-white);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
		transition: transform 0.2s ease;
	}

	.track.on .thumb {
		transform: translateX(22px);
	}

	.in-place:focus-visible .track {
		outline: 2px solid var(--color-red);
		outline-offset: 2px;
	}
</style>
