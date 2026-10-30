<script lang="ts">
	import { onMount } from 'svelte';
	import { ChevronRight, LoaderCircle, Play, Search, SquareFunction } from 'lucide-svelte';
	import { modal } from '$lib/actions/modal';
	import { sendGcode, describeError } from '$lib/services/moonraker-gcode';
	import { fetchMacros, macroCommand, type Macro } from '$lib/services/moonraker-macros';
	import { toastActions } from '$lib/stores/toastStore';

	let macros = $state<Macro[]>([]);
	let isLoading = $state(true);
	let loadError = $state('');
	let query = $state('');

	let selected = $state<Macro | null>(null);
	let values = $state<Record<string, string>>({});
	let isRunning = $state(false);

	// Le macro della G2 sono tante: si cerca sia nel nome sia nella descrizione.
	const visible = $derived.by(() => {
		const needle = query.trim().toLowerCase();
		if (!needle) return macros;
		return macros.filter(
			(macro) =>
				macro.name.toLowerCase().includes(needle) ||
				macro.description?.toLowerCase().includes(needle)
		);
	});

	const command = $derived(selected ? macroCommand(selected.name, values) : '');

	async function load() {
		isLoading = true;
		loadError = '';
		try {
			macros = await fetchMacros();
		} catch (error) {
			loadError = describeError(error);
		} finally {
			isLoading = false;
		}
	}

	function open(macro: Macro) {
		selected = macro;
		values = Object.fromEntries(macro.params.map((param) => [param.name, param.default ?? '']));
	}

	// Mentre la macro gira la finestra resta aperta: chiuderla a metà farebbe
	// credere che sia stata annullata, e Kalico invece la porta a termine.
	function close() {
		if (isRunning) return;
		selected = null;
	}

	async function run() {
		if (!selected || isRunning) return;
		isRunning = true;
		const name = selected.name;
		const ok = await sendGcode(command, `${name} didn't run`);
		isRunning = false;
		if (ok) {
			toastActions.success('klipper', `${name} done`, command);
			selected = null;
		}
	}

	onMount(load);
</script>

<svelte:head>
	<title>Macros · G2</title>
</svelte:head>

<section class="macros-page">
	<div class="macros-card">
		<header class="macros-header">
			<h1>Macros</h1>
		</header>

		<label class="search">
			<Search />
			<input
				type="search"
				placeholder="Search macros"
				bind:value={query}
				spellcheck="false"
				autocapitalize="off"
				aria-label="Search macros"
			/>
		</label>

		{#if isLoading}
			<p class="status"><LoaderCircle class="spin" /> Loading the macros…</p>
		{:else if loadError}
			<div class="status">
				<p>{loadError}</p>
				<button type="button" class="retry-btn" onclick={load}>Try again</button>
			</div>
		{:else if visible.length === 0}
			<p class="status">
				{query ? 'No macro matches your search.' : 'This printer has no macros.'}
			</p>
		{:else}
			<div class="macro-list">
				{#each visible as macro (macro.name)}
					<button type="button" class="macro-row" onclick={() => open(macro)}>
						<span class="icon"><SquareFunction /></span>
						<div class="row-text">
							<!-- Nomi lunghi in colonna: a capo dopo un `_`, non a metà parola. -->
							<h2>
								{#each macro.name.split('_') as part, index (index)}{#if index > 0}_<wbr
										/>{/if}{part}{/each}
							</h2>
							{#if macro.description}
								<p>{macro.description}</p>
							{/if}
							{#if macro.params.length > 0}
								<span class="chip">
									{macro.params.length}
									{macro.params.length === 1 ? 'parameter' : 'parameters'}
								</span>
							{/if}
						</div>
						<span class="chevron"><ChevronRight /></span>
					</button>
				{/each}
			</div>
		{/if}
	</div>
</section>

{#if selected}
	<!-- svelte-ignore a11y_click_events_have_key_events,a11y_no_noninteractive_element_interactions -->
	<div
		class="modal-overlay"
		role="dialog"
		aria-modal="true"
		aria-label={selected.name}
		tabindex="-1"
		onclick={close}
		use:modal={{ onClose: close }}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events,a11y_no_noninteractive_element_interactions -->
		<div class="modal-content" role="document" onclick={(e) => e.stopPropagation()}>
			<h3>{selected.name}</h3>
			{#if selected.description}
				<p class="description">{selected.description}</p>
			{/if}

			<form
				class="params"
				onsubmit={(e) => {
					e.preventDefault();
					run();
				}}
			>
				{#each selected.params as param (param.name)}
					<label class="field">
						<span>{param.name}</span>
						<input
							type="text"
							bind:value={values[param.name]}
							placeholder={param.default === undefined ? 'Not set' : ''}
							spellcheck="false"
							autocapitalize="off"
							disabled={isRunning}
						/>
					</label>
				{/each}

				<code class="preview">{command}</code>

				<div class="modal-actions">
					<button type="button" class="modal-cancel" onclick={close} disabled={isRunning}>
						Cancel
					</button>
					<button type="submit" class="modal-confirm" disabled={isRunning}>
						{#if isRunning}
							<LoaderCircle class="spin" /> Running…
						{:else}
							<Play /> Run
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<style>
	.macros-page {
		padding: 24px 24px calc(112px + var(--safe-bottom));
		box-sizing: border-box;
	}
	.macros-card {
		background: var(--color-white);
		border-radius: 20px;
		box-shadow: var(--shadow-float);
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		box-sizing: border-box;
	}
	.macros-header h1 {
		margin: 0;
		font-size: 2rem;
		font-weight: 700;
		color: var(--color-text-secondary);
	}
	.search {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0 14px;
		border: 1px solid var(--color-border-light);
		border-radius: 14px;
		background: var(--color-background);
		color: var(--color-text-muted);
	}
	.search :global(svg) {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
	}
	.search input {
		flex: 1;
		min-width: 0;
		height: 44px;
		border: none;
		background: transparent;
		font-size: 1rem;
		font-family: inherit;
		color: var(--color-black);
	}
	.search input:focus {
		outline: none;
	}
	.status {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 12px;
		margin: 8px 4px;
		color: var(--color-text-soft);
	}
	p.status {
		flex-direction: row;
		align-items: center;
	}
	.status p {
		margin: 0;
	}
	.retry-btn {
		border: none;
		background: var(--color-red);
		color: var(--color-white);
		border-radius: 14px;
		padding: 10px 20px;
		font-weight: 700;
	}
	/* Una colonna sul telefono, due sul tablet, tre sul computer. Le righe di una
	   stessa fila hanno la stessa altezza, quindi i bordi dell'ultima fila stanno
	   tutti sul fondo: il clip li toglie insieme. */
	.macro-list {
		display: grid;
		grid-template-columns: 1fr;
		column-gap: 32px;
		clip-path: inset(0 0 1px 0);
	}
	@media (min-width: 768px) {
		.macro-list {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (min-width: 1200px) {
		.macro-list {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	.macro-row {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 14px 4px;
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--color-surface-sunken);
		text-align: left;
		cursor: pointer;
		color: inherit;
	}
	.icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		color: var(--color-text-muted);
		flex-shrink: 0;
	}
	.row-text {
		flex: 1;
		min-width: 0;
	}
	.row-text h2 {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 700;
		overflow-wrap: anywhere;
	}
	.row-text p {
		margin: 2px 0 0;
		font-size: 0.85rem;
		color: var(--color-text-subtle);
	}
	.chip {
		display: inline-block;
		margin-top: 6px;
		padding: 4px 10px;
		border-radius: 999px;
		background: var(--color-surface-sunken);
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-soft);
		white-space: nowrap;
	}
	.chevron {
		display: inline-flex;
		color: var(--color-gray-light);
		flex-shrink: 0;
	}
	@media (max-width: 767.98px) {
		.macros-page {
			padding: 16px 16px calc(112px + var(--safe-bottom));
		}
		.macros-card {
			padding: 20px 16px;
		}
	}

	.modal-overlay {
		position: fixed;
		inset: 0;
		background: linear-gradient(
			135deg,
			rgba(var(--rgb-gray-mid), 0.3),
			rgba(var(--rgb-gray-mid), 0.22)
		);
		backdrop-filter: blur(12px) saturate(130%);
		-webkit-backdrop-filter: blur(12px) saturate(130%);
		z-index: 3000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
		box-sizing: border-box;
	}
	.modal-content {
		background: var(--color-white);
		border-radius: 16px;
		padding: 24px;
		max-width: 420px;
		width: 100%;
		max-height: 100%;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		box-shadow: var(--shadow-panel);
		box-sizing: border-box;
	}
	.modal-content h3 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--color-black);
		overflow-wrap: anywhere;
	}
	.description {
		margin: 6px 0 0;
		font-size: 0.9rem;
		color: var(--color-text-soft);
	}
	.params {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-top: 16px;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.field span {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-text-soft);
	}
	.field input {
		border: 1px solid var(--color-gray);
		border-radius: 10px;
		padding: 10px 12px;
		font-size: 1rem;
		font-family: inherit;
		color: var(--color-black);
	}
	.field input:focus {
		outline: none;
		border-color: var(--color-red);
	}
	.preview {
		padding: 10px 12px;
		border-radius: 10px;
		background: var(--color-surface-sunken);
		font-size: 0.85rem;
		color: var(--color-text-secondary);
		overflow-wrap: anywhere;
	}
	.modal-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
		margin-top: 8px;
	}
	.modal-cancel {
		padding: 8px 20px;
		border: 1px solid var(--color-gray);
		border-radius: 8px;
		background: var(--color-white);
		cursor: pointer;
		font-size: 0.9rem;
		color: var(--color-text-soft);
	}
	.modal-cancel:hover:not(:disabled) {
		background-color: var(--color-background);
	}
	.modal-confirm {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 20px;
		border: none;
		border-radius: 8px;
		background: var(--color-red);
		color: var(--color-white);
		cursor: pointer;
		font-size: 0.9rem;
		transition: background-color 0.15s;
	}
	.modal-confirm :global(svg) {
		width: 18px;
		height: 18px;
	}
	.modal-confirm:hover:not(:disabled) {
		background: var(--color-red-dark);
	}
	.modal-cancel:disabled,
	.modal-confirm:disabled {
		opacity: 0.6;
		cursor: default;
	}
</style>
