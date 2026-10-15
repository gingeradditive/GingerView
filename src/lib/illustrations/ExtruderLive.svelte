<script lang="ts">
	import ExtruderTemperatureCard from '$lib/components/ExtruderTemperatureCard.svelte';

	/**
	 * L'estrusore del pannello Heat & Extrude, nello stesso linguaggio del pannello
	 * temperature della dashboard: le zone sono le stesse card (numero, temperatura vera,
	 * target mentre scalda), sotto il triangolo dell'ugello e il piano.
	 *
	 * Da fermo fa vedere cosa succederà con i parametri scelti: la colata tratteggiata (linee
	 * impilate) è grande quanto l'Amount, il filo scorre alla Speed. Durante la sequenza la testa scorre
	 * a destra e sinistra mentre si posiziona (homing e move), le card si scaldano come in dashboard, il materiale scende e
	 * la colata cresce (extrude). Alla fine resta la colata piena con la spunta.
	 */
	type Phase = 'idle' | 'homing' | 'moving' | 'heating' | 'extruding';
	type Zone = { temperature: number | null; target: number | null };

	let {
		phase,
		outcome = null,
		amount,
		flowSeconds,
		fillSeconds,
		zones
	}: {
		phase: Phase;
		outcome?: 'done' | 'failed' | null;
		amount: 'low' | 'mid' | 'high';
		/** Quanto impiega un tratto del filo a scendere: più basso = più veloce. */
		flowSeconds: number;
		/** Durata stimata dell'estrusione, per far crescere la colata. */
		fillSeconds: number;
		zones: Zone[];
	} = $props();

	const idle = $derived(phase === 'idle' && !outcome);

	// La colata è una pila di linee, la più larga sotto: Amount decide quante e quanto larghe
	// (in `--u`, dall'alto in basso).
	const pileWidths = { low: [48, 72], mid: [42, 63, 84], high: [40, 58, 76, 94, 112] };
	const lines = $derived(pileWidths[amount]);

	// La testa scorre a destra e sinistra mentre si posiziona (homing e move). Con
	// un'animazione CSS, togliere la classe la riportava al centro di scatto nel passaggio a
	// Heat: con le Web Animations si legge dov'è e la si riaccompagna al centro.
	let head = $state<HTMLDivElement | null>(null);
	const positioning = $derived(phase === 'homing' || phase === 'moving');

	$effect(() => {
		const node = head;
		if (!node || !positioning) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const amplitude = node.offsetWidth * 0.18;
		const sway = node.animate(
			[
				{ transform: 'translateX(0)' },
				{ transform: `translateX(${-amplitude}px)` },
				{ transform: 'translateX(0)' },
				{ transform: `translateX(${amplitude}px)` },
				{ transform: 'translateX(0)' }
			],
			{ duration: 2400, iterations: Infinity, easing: 'ease-in-out' }
		);
		return () => {
			const current = getComputedStyle(node).transform;
			sway.cancel();
			if (current && current !== 'none') {
				node.animate([{ transform: current }, { transform: 'translateX(0)' }], {
					duration: 450,
					easing: 'ease-out'
				});
			}
		};
	});
	const extruding = $derived(phase === 'extruding');
	const done = $derived(outcome === 'done');
	const failed = $derived(outcome === 'failed');
</script>

<div class="live" style:--flow="{flowSeconds}s" style:--fill="{fillSeconds}s" aria-hidden="true">
	<div class="head" bind:this={head}>
		<div class="zones">
			{#each zones as zone, index (index)}
				<ExtruderTemperatureCard
					index={index + 1}
					temperature={zone.temperature}
					target={zone.target}
				/>
			{/each}
		</div>
		<img class="nozzle" src="/NozzleHead.svg" alt="" />
	</div>

	<div class="drop"></div>

	<div class="bed">
		<!-- Il filo parte sotto la punta e arriva al piano: la pila, disegnata dopo, lo copre. -->
		{#if idle}
			<div class="stream preview"></div>
		{:else if extruding}
			<div class="stream flowing"></div>
		{/if}
		{#key amount}
			<div
				class="pile"
				class:preview={idle}
				class:growing={extruding}
				class:hidden={!idle && !extruding && !done}
			>
				{#each lines as width, index (index)}
					<span
						class="line"
						style:--w={width}
						style:--i={lines.length - 1 - index}
						style:--n={lines.length}
					></span>
				{/each}
			</div>
		{/key}

		{#if done || failed}
			<span class="badge" class:failed>
				<svg viewBox="0 0 24 24" width="100%" height="100%">
					{#if done}
						<path d="M6 12.5 L10.5 17 L18 8" />
					{:else}
						<path d="M7 7 L17 17 M17 7 L7 17" />
					{/if}
				</svg>
			</span>
		{/if}
	</div>
</div>

<style>
	/*
	 * Tutto è in `--u` come nel pannello della dashboard: un pixel che si restringe quando
	 * lo spazio non basta. La pila è alta ~376u (quattro zone, ugello, filo, piano) e larga
	 * ~150u (il piano).
	 */
	.live {
		width: 100%;
		height: 100%;
		container-type: size;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.head,
	.drop,
	.bed {
		--u: min(1px, calc(100cqh / 376), calc(100cqw / 150));
	}

	.head {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: calc(var(--u) * 7);
	}

	.zones {
		display: flex;
		flex-direction: column;
		gap: calc(var(--u) * 6);
	}

	.nozzle {
		width: calc(var(--u) * 62);
		height: calc(var(--u) * 33);
		object-fit: contain;
	}

	/* Il filo parte poco sotto la punta, non attaccato al triangolo. */
	.drop {
		height: calc(var(--u) * 34);
		margin-top: calc(var(--u) * 6);
	}

	.stream {
		position: absolute;
		top: calc(var(--u) * -34);
		bottom: 0;
		left: 50%;
		transform: translateX(-50%);
		border-radius: 999px;
	}

	.pile {
		position: relative;
	}

	/* Da fermo: un filo sottile tratteggiato che scende alla velocità scelta. */
	.stream.preview {
		width: calc(var(--u) * 3);
		background: repeating-linear-gradient(
			180deg,
			var(--color-gray-light) 0 calc(var(--u) * 6),
			transparent calc(var(--u) * 6) calc(var(--u) * 12)
		);
		background-size: 100% calc(var(--u) * 12);
		animation: flow var(--flow) linear infinite;
	}

	.stream.flowing {
		width: calc(var(--u) * 8);
		background: repeating-linear-gradient(
			180deg,
			var(--color-red) 0 calc(var(--u) * 14),
			var(--color-red-dark) calc(var(--u) * 14) calc(var(--u) * 18)
		);
		background-size: 100% calc(var(--u) * 18);
		animation: flow-live var(--flow) linear infinite;
	}

	.bed {
		position: relative;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		width: calc(var(--u) * 150);
		height: calc(var(--u) * 56);
		border-bottom: calc(var(--u) * 10) solid var(--color-gray-light);
		border-radius: 0 0 calc(var(--u) * 4) calc(var(--u) * 4);
		box-sizing: content-box;
	}

	/* La colata: linee orizzontali impilate, la più larga sul piano. */
	.pile {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: calc(var(--u) * 2);
	}

	.pile.hidden {
		visibility: hidden;
	}

	.line {
		display: block;
		width: calc(var(--u) * var(--w));
		height: calc(var(--u) * 9);
		border-radius: calc(var(--u) * 4);
		background: var(--color-red);
		transform-origin: 50% 100%;
	}

	.pile.preview .line {
		/* Fondo pieno, così il filo tratteggiato non si vede attraverso la pila. */
		background:
			linear-gradient(rgba(var(--rgb-red), 0.06), rgba(var(--rgb-red), 0.06)), var(--color-white);
		border: calc(var(--u) * 1.5) dashed var(--color-red);
		box-sizing: border-box;
	}

	/* Durante l'estrusione le linee compaiono dal basso, una per volta, nel tempo stimato. */
	.pile.growing .line {
		opacity: 0;
		animation: lay calc(var(--fill) / var(--n)) ease-out forwards;
		animation-delay: calc(var(--fill) / var(--n) * var(--i));
	}

	.badge {
		position: absolute;
		right: 0;
		bottom: calc(var(--u) * 6);
		width: calc(var(--u) * 28);
		height: calc(var(--u) * 28);
		border-radius: 50%;
		background: var(--color-success-vivid);
	}

	.badge.failed {
		background: var(--color-red);
	}

	.badge path {
		fill: none;
		stroke: var(--color-white);
		stroke-width: 3;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	@keyframes flow {
		to {
			background-position: 0 calc(var(--u) * 12);
		}
	}

	@keyframes flow-live {
		to {
			background-position: 0 calc(var(--u) * 18);
		}
	}

	@keyframes lay {
		from {
			opacity: 1;
			transform: scaleX(0.1);
		}
		to {
			opacity: 1;
			transform: scaleX(1);
		}
	}
</style>
