<script lang="ts">
	import { ArrowLeft, ArrowRight, Pointer } from 'lucide-svelte';

	/**
	 * La scritta sotto i caroselli della dashboard e di Movement: "← [dito] Swipe to see more →".
	 *
	 * Sostituisce i puntini: gli utenti non capivano dal telefono che le card si scorrono, e
	 * sapere su quale card si è non serviva a nessuno. Qui si dice solo il gesto, con il dito
	 * che lo mima. Non è un pulsante: si scorre sulle card, non qui.
	 *
	 * Il genitore la nasconde dove le card stanno tutte a schermo.
	 */
</script>

<p class="swipe-hint-label">
	<ArrowLeft class="arrow" size={14} strokeWidth={2.4} aria-hidden="true" />
	<span class="finger" aria-hidden="true"><Pointer size={16} strokeWidth={2.2} /></span>
	<span>Swipe to see more</span>
	<ArrowRight class="arrow" size={14} strokeWidth={2.4} aria-hidden="true" />
</p>

<style>
	/* Solo testo, senza sfondo né bordo: con la pillola bianca sembrava un pulsante. */
	.swipe-hint-label {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		margin: 0;
		padding: 4px 0;
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.01em;
		/* A metà tra --color-text-muted e --color-text-soft: scuro, ma un filo meno del testo. */
		--swipe-hint-color: color-mix(in srgb, var(--color-text-muted) 50%, var(--color-text-soft));
		color: var(--swipe-hint-color);
		white-space: nowrap;
		user-select: none;
		pointer-events: none;
	}

	.swipe-hint-label :global(.arrow) {
		color: var(--swipe-hint-color);
	}

	/* Il dito va e viene in orizzontale, piano: mima il gesto senza attirare troppo. */
	.finger {
		display: inline-flex;
		color: var(--color-text-muted);
		animation: finger-swipe 2.4s ease-in-out infinite;
	}

	@keyframes finger-swipe {
		0%,
		100% {
			transform: translateX(-3px) rotate(-8deg);
		}
		50% {
			transform: translateX(3px) rotate(8deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.finger {
			animation: none;
		}
	}
</style>
