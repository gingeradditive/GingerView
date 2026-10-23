<script lang="ts">
	import Fraction from '$lib/components/Fraction.svelte';
	import { subscribeWhileVisible } from '$lib/services/panel-subscription.svelte';

	/** Falso quando la slide è fuori dalla viewport del carosello: l'iscrizione si ferma. */
	let { visible = true }: { visible?: boolean } = $props();

	type ZHeightStatus = {
		print_stats?: { state?: string };
		toolhead?: { position?: number[]; axis_maximum?: number[] };
		gcode_move?: { gcode_position?: number[] };
	};

	const dataSource = 'dashboard-z-height';
	const dataQuery = 'toolhead=position,axis_maximum&gcode_move=gcode_position&print_stats=state';
	const sectionHeight = 100;

	let currentHeight = $state(0);
	let maxHeight = $state(950);
	let isIdle = $state(true);

	let fillPercentage = $derived(
		maxHeight > 0 ? Math.min(100, (currentHeight / maxHeight) * 100) : 0
	);

	// Una tacca ogni 10cm, sulla stessa scala del riempimento (l'altezza vera della
	// macchina). Senza quelle troppo vicine alla cima, dove l'etichetta uscirebbe dall'asta.
	let sections = $derived(
		Array.from({ length: Math.floor(maxHeight / sectionHeight) }, (_, i) => {
			const value = (i + 1) * sectionHeight;
			return {
				bottom: (value / maxHeight) * 100,
				label: value === 1000 ? '1m' : `${value / 10}cm`
			};
		}).filter((section) => section.bottom <= 96)
	);

	const updateZHeight = (status: ZHeightStatus): void => {
		const printState = status.print_stats?.state ?? 'standby';
		isIdle = printState !== 'printing' && printState !== 'paused';

		const toolhead = status.toolhead;
		if (toolhead) {
			if (Array.isArray(toolhead.axis_maximum) && toolhead.axis_maximum.length > 2) {
				maxHeight = toolhead.axis_maximum[2];
			}
		}

		const gcodeMove = status.gcode_move;
		if (
			gcodeMove &&
			Array.isArray(gcodeMove.gcode_position) &&
			gcodeMove.gcode_position.length > 2
		) {
			currentHeight = Math.max(0, gcodeMove.gcode_position[2]);
		} else if (toolhead && Array.isArray(toolhead.position) && toolhead.position.length > 2) {
			currentHeight = Math.max(0, toolhead.position[2]);
		}
	};

	subscribeWhileVisible<ZHeightStatus>(
		dataSource,
		() => dataQuery,
		updateZHeight,
		() => visible
	);
</script>

<section class="z-height-panel" aria-label="Z Height">
	<div class="z-progress-container">
		<div class="z-progress-bar">
			<div class="z-progress-fill" style="height: {fillPercentage}%"></div>
			<!-- Section marks and labels -->
			<div class="z-marks">
				<!-- Tacche posizionali: l'indice è la loro identità, non c'è riordino. -->
				{#each sections as section, i (i)}
					<div class="z-mark" style="bottom: {section.bottom}%"></div>
				{/each}
			</div>
			<!-- Le etichette due volte: grigie sul bianco e, ritagliata sul riempimento,
			     una copia bianca che resta leggibile sul rosso. -->
			{#each [false, true] as onFill (onFill)}
				<div
					class="z-labels"
					class:on-fill={onFill}
					style={onFill ? `clip-path: inset(${100 - fillPercentage}% 0 0 0)` : undefined}
					aria-hidden="true"
				>
					{#each sections as section, i (i)}
						<div class="z-label-mark" style="bottom: {section.bottom}%">
							{section.label}
						</div>
					{/each}
				</div>
			{/each}
		</div>
	</div>
	<div class="z-info">
		<span class="z-label">Z HEIGHT</span>
		{#if isIdle}
			<span class="z-value">To infinity and beyond!</span>
			<span class="z-value-sub">Well… one meter, actually&nbsp;:)</span>
		{:else}
			<span class="z-value"
				><Fraction value={currentHeight.toFixed(1)} total={String(maxHeight)} unit="mm" /></span
			>
		{/if}
	</div>
</section>

<style>
	.z-height-panel {
		background: var(--color-white);
		border-radius: 19.2px;
		padding: 0;
		display: flex;
		align-items: stretch;
		height: 100%;
		box-sizing: border-box;
		box-shadow: var(--shadow-panel);
		overflow: hidden;
	}

	.z-progress-container {
		position: relative;
		/* Nelle colonne strette (5 pannelli su un portatile) l'asta cede spazio al testo. */
		width: min(80px, 30%);
		height: 100%;
		flex-shrink: 0;
	}

	.z-progress-bar {
		position: relative;
		width: 100%;
		height: 100%;
		background: var(--color-white);
		border-radius: 0;
		overflow: hidden;
		border-right: 1px solid var(--color-black-pure);
	}

	.z-progress-fill {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		background: var(--color-red);
		border-radius: 0;
		transition: height 0.3s ease;
	}

	.z-marks {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		pointer-events: none;
	}

	.z-mark {
		position: absolute;
		left: 0;
		right: 60%;
		height: 1px;
		background: var(--color-black-pure);
	}

	/* Nella metà destra dell'asta, accanto alle tacche: prima stavano fuori dall'asta,
	   che le tagliava, e non si vedevano. */
	.z-labels {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.z-labels.on-fill {
		color: var(--color-white);
		transition: clip-path 0.3s ease;
	}

	.z-label-mark {
		position: absolute;
		right: 4px;
		font-size: 0.65rem;
		font-weight: 600;
		color: var(--color-text-subtle);
		transform: translateY(50%);
		white-space: nowrap;
	}

	.on-fill .z-label-mark {
		color: var(--color-white);
	}

	.z-info {
		display: flex;
		flex-direction: column;
		gap: calc(var(--dashboard-title-size) * 0.25);
		flex: 1;
		min-width: 0;
		padding: 20px 12px;
		justify-content: center;
		align-items: center;
		text-align: center;
		/* Le dimensioni sono quelle comuni alle card; il limite in cqw interviene solo se la
		   colonna è così stretta che "HEIGHT" ne uscirebbe. */
		container-type: inline-size;
	}

	/* Titolo, sottotitolo e battuta: stessi font di FLOW, "Let me extrude!" e
	   "Pick a file and let's go" (ma grigia: qui non è un link). */
	.z-label {
		font-size: min(var(--dashboard-title-size), 22cqw);
		font-weight: 700;
		color: var(--color-black);
		line-height: 1.1;
		letter-spacing: 0.02em;
	}

	.z-value {
		font-size: min(var(--dashboard-subtitle-size), 17cqw);
		color: var(--color-text-soft);
		font-weight: 500;
		line-height: 1.3;
	}

	.z-value-sub {
		font-size: 0.95rem;
		color: var(--color-text-disabled);
		font-weight: 600;
	}
</style>
