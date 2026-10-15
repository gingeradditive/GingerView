<script lang="ts">
	import type { Snippet } from 'svelte';
	import { modal } from '$lib/actions/modal';
	import { portal } from '$lib/actions/portal';
	import ModalCloseButton from '$lib/components/ModalCloseButton.svelte';

	/**
	 * La base comune di tutte le finestre modali.
	 *
	 * Su telefono (portrait) è un bottom sheet: sale dal basso, a tutta larghezza, con le
	 * azioni sotto il pollice. Da tablet in su è una card centrata. Overlay, portal, focus
	 * trap ed Escape sono qui una volta sola invece che copiati in ogni dialog.
	 *
	 * - `onClose`: Escape e la X (se `showClose`). Senza, la finestra non si chiude da sola
	 *   (avvio stampa in corso, aggiornamento in corso).
	 * - `dismissible`: anche tap sullo sfondo e trascinamento verso il basso chiudono. Da
	 *   lasciare `false` dove chiudere per sbaglio fa perdere qualcosa (il wizard).
	 * - `header` / `footer`: restano fermi, scorre solo il corpo. Le azioni nel footer
	 *   seguono una regola sola: secondaria a sinistra, primaria a destra (`.btn-*` in app.css).
	 *
	 *     {#if open}
	 *       <Sheet label="Rename" onClose={close}>
	 *         {#snippet header()}<h3>Rename</h3>{/snippet}
	 *         …
	 *         {#snippet footer()}<button class="btn btn-secondary">Cancel</button>…{/snippet}
	 *       </Sheet>
	 *     {/if}
	 */
	let {
		label,
		onClose,
		dismissible = true,
		showClose = false,
		size = 'md',
		layer = 0,
		panelClass = '',
		header,
		children,
		footer
	}: {
		label: string;
		onClose?: () => void;
		dismissible?: boolean;
		showClose?: boolean;
		size?: 'sm' | 'md' | 'wide' | 'lg';
		/** 1 per una finestra aperta sopra un'altra (conferma sopra un dettaglio). */
		layer?: number;
		panelClass?: string;
		header?: Snippet;
		children?: Snippet;
		footer?: Snippet;
	} = $props();

	const canDismiss = $derived(dismissible && !!onClose);

	const onBackdrop = (e: MouseEvent): void => {
		if (e.target === e.currentTarget && canDismiss) onClose?.();
	};

	// Trascinamento verso il basso dalla maniglia o dall'intestazione (solo telefono, dove
	// la maniglia si vede). Oltre 90px chiude, sotto torna su.
	let dragStart = $state<number | null>(null);
	let dragOffset = $state(0);

	const onDragStart = (e: PointerEvent): void => {
		if (!canDismiss || e.pointerType === 'mouse') return;
		if ((e.target as HTMLElement).closest('button, input, a, select, textarea')) return;
		dragStart = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	};

	const onDragMove = (e: PointerEvent): void => {
		if (dragStart === null) return;
		dragOffset = Math.max(0, e.clientY - dragStart);
	};

	const onDragEnd = (): void => {
		if (dragStart === null) return;
		const close = dragOffset > 90;
		dragStart = null;
		dragOffset = 0;
		if (close) onClose?.();
	};
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
	class="sheet-overlay"
	role="dialog"
	aria-modal="true"
	aria-label={label}
	tabindex="-1"
	style:z-index={3000 + layer * 100}
	use:portal
	use:modal={{ onClose, focusFirst: false }}
	onclick={onBackdrop}
>
	<div
		class="sheet-panel size-{size} {panelClass}"
		class:dragging={dragStart !== null}
		style:transform={dragOffset ? `translateY(${dragOffset}px)` : undefined}
	>
		<div
			class="sheet-grab"
			role="presentation"
			onpointerdown={onDragStart}
			onpointermove={onDragMove}
			onpointerup={onDragEnd}
			onpointercancel={onDragEnd}
		>
			<div class="sheet-handle" class:hidden={!canDismiss} aria-hidden="true"></div>
			{#if header}
				<header class="sheet-header" class:with-close={showClose && onClose}>
					{@render header()}
				</header>
			{/if}
		</div>
		{#if showClose && onClose}
			<ModalCloseButton {onClose} />
		{/if}
		<div class="sheet-body">
			{@render children?.()}
		</div>
		{#if footer}
			<footer class="sheet-footer">
				{@render footer()}
			</footer>
		{/if}
	</div>
</div>

<style>
	.sheet-overlay {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
		box-sizing: border-box;
		background: linear-gradient(
			135deg,
			rgba(var(--rgb-gray-mid), 0.3),
			rgba(var(--rgb-gray-mid), 0.22)
		);
		backdrop-filter: blur(12px) saturate(130%);
		-webkit-backdrop-filter: blur(12px) saturate(130%);
		animation: sheet-fade 0.2s ease-out;
	}

	/* Il focus d'apertura sta qui (vedi `focusFirst` in modal.ts): niente anello. */
	.sheet-overlay:focus {
		outline: none;
	}

	.sheet-panel {
		position: relative;
		display: flex;
		flex-direction: column;
		width: 100%;
		max-height: min(720px, calc(100dvh - 48px));
		box-sizing: border-box;
		background: var(--color-white);
		border-radius: 20px;
		box-shadow: 0 12px 40px rgba(var(--rgb-black), 0.18);
		overflow: hidden;
		animation: sheet-pop 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.1);
	}

	.size-sm {
		max-width: 380px;
	}
	.size-md {
		max-width: 460px;
	}
	.size-wide {
		max-width: 620px;
	}
	.size-lg {
		max-width: 820px;
	}

	.sheet-grab {
		flex-shrink: 0;
	}

	.sheet-handle {
		display: none;
	}

	.sheet-header {
		padding: 24px 24px 0;
	}

	.sheet-header.with-close {
		padding-right: 68px;
	}

	.sheet-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 16px 24px;
	}

	.sheet-footer {
		flex-shrink: 0;
		display: flex;
		gap: 10px;
		padding: 12px 24px 24px;
	}

	/* Le azioni si dividono la riga in parti uguali: la primaria (ultima) resta sempre
	   nello stesso punto, qualunque sia l'etichetta. */
	.sheet-footer > :global(*) {
		flex: 1 1 0;
		min-width: 0;
	}

	@media (max-width: 767.98px) {
		.sheet-overlay {
			align-items: flex-end;
			padding: 0;
		}

		.sheet-panel {
			max-width: none;
			max-height: calc(100dvh - 24px);
			border-radius: 22px 22px 0 0;
			animation: sheet-up 0.28s cubic-bezier(0.2, 0.9, 0.3, 1);
			transition: transform 0.2s ease-out;
		}

		.sheet-panel.dragging {
			transition: none;
		}

		.sheet-grab {
			touch-action: none;
		}

		.sheet-handle {
			display: block;
			width: 40px;
			height: 5px;
			margin: 10px auto 0;
			border-radius: 3px;
			background: var(--color-divider);
		}

		.sheet-handle.hidden {
			visibility: hidden;
		}

		.sheet-header {
			padding: 12px 20px 0;
		}

		.sheet-body {
			padding: 14px 20px;
		}

		.sheet-footer {
			padding: 10px 20px calc(16px + var(--safe-bottom));
		}

		.sheet-panel :global(.modal-close) {
			top: 18px;
		}
	}

	@keyframes sheet-fade {
		from {
			opacity: 0;
		}
	}

	@keyframes sheet-pop {
		from {
			opacity: 0;
			transform: translateY(12px) scale(0.97);
		}
	}

	@keyframes sheet-up {
		from {
			transform: translateY(100%);
		}
	}
</style>
