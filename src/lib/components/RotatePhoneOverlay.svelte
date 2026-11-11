<script lang="ts">
	import { Smartphone } from 'lucide-svelte';

	/**
	 * Sul telefono GingerView si usa solo in verticale: in orizzontale copre tutto e chiede
	 * di ruotarlo. Il tablet va bene in tutti e due i versi.
	 *
	 * Solo CSS, niente JS: compare con un touch screen in orizzontale alto meno di 500px.
	 * I telefoni in orizzontale stanno sotto i ~430px, il tablet più piccolo (iPad mini) è
	 * alto ~744px. Un portatile con la finestra bassa non ha `pointer: coarse`, quindi resta
	 * fuori.
	 */
</script>

<div class="rotate-phone" role="alert" aria-live="polite">
	<span class="phone" aria-hidden="true"><Smartphone size={56} strokeWidth={1.6} /></span>
	<h2>Rotate your phone</h2>
</div>

<style>
	.rotate-phone {
		display: none;
	}

	@media (orientation: landscape) and (max-height: 500px) and (pointer: coarse) {
		.rotate-phone {
			position: fixed;
			inset: 0;
			/* Sopra tutto, toast e avvisi compresi: in orizzontale nulla è usabile. */
			z-index: 20000;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 8px;
			padding: 24px;
			box-sizing: border-box;
			background: var(--color-background);
			text-align: center;
		}
	}

	.phone {
		display: inline-flex;
		margin-bottom: 8px;
		color: var(--color-red);
		animation: rotate-phone 2.4s ease-in-out infinite;
	}

	/* Il telefono parte sdraiato e si raddrizza: mima il gesto da fare. */
	@keyframes rotate-phone {
		0%,
		20% {
			transform: rotate(-90deg);
		}
		60%,
		100% {
			transform: rotate(0deg);
		}
	}

	h2 {
		margin: 0;
		font-size: 1.2rem;
		font-weight: 700;
		color: var(--color-black);
	}

	@media (prefers-reduced-motion: reduce) {
		.phone {
			animation: none;
		}
	}
</style>
