<script lang="ts">
	import { House, Flame } from 'lucide-svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import NozzleClean from '$lib/illustrations/NozzleClean.svelte';
	import BedClear from '$lib/illustrations/BedClear.svelte';

	// Gli stessi due controlli dello step "Nozzle & bed" del wizard di stampa, con gli stessi
	// disegni, prima di ogni movimento automatico della testa. `action` dice cosa sta per
	// succedere: "Confirm" da solo non lo diceva.
	let {
		isOpen,
		action = 'home',
		onConfirm,
		onCancel
	}: {
		isOpen: boolean;
		action?: 'home' | 'extrude';
		onConfirm: () => void;
		onCancel: () => void;
	} = $props();

	const copy = $derived(
		action === 'extrude'
			? {
					title: 'Heat & extrude',
					text: 'The head homes if needed, moves to the purge position, heats up and extrudes.',
					confirm: 'Heat & extrude'
				}
			: {
					title: 'Home the printer',
					text: 'The head and the bed move to their end stops to find the zero position.',
					confirm: 'Home'
				}
	);
</script>

{#if isOpen}
	<Sheet label={copy.title} onClose={onCancel} size="md">
		{#snippet header()}
			<div class="head">
				<span class="badge" aria-hidden="true">
					{#if action === 'extrude'}
						<Flame size={22} />
					{:else}
						<House size={22} />
					{/if}
				</span>
				<div>
					<h3 class="sheet-title">{copy.title}</h3>
					<p class="sheet-subtitle">{copy.text}</p>
				</div>
			</div>
		{/snippet}

		<p class="lead">Before it starts, check that:</p>
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

		{#snippet footer()}
			<button type="button" class="btn btn-secondary" onclick={onCancel}>Cancel</button>
			<button type="button" class="btn btn-primary" onclick={onConfirm}>{copy.confirm}</button>
		{/snippet}
	</Sheet>
{/if}

<style>
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
</style>
