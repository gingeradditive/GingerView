<script lang="ts">
	import { FoldVertical } from 'lucide-svelte';
	import ZOffsetSheet from '$lib/components/ZOffsetSheet.svelte';
	import { subscribeWhileVisible } from '$lib/services/panel-subscription.svelte';

	/** Falso quando la slide è fuori dalla viewport del carosello: l'iscrizione si ferma. */
	let { visible = true }: { visible?: boolean } = $props();

	type ZHeightStatus = {
		print_stats?: { state?: string };
		toolhead?: { position?: number[]; axis_maximum?: number[]; homed_axes?: string };
		gcode_move?: { gcode_position?: number[]; homing_origin?: number[] };
	};

	const dataSource = 'dashboard-z-height';
	const dataQuery =
		'toolhead=position,axis_maximum,homed_axes&gcode_move=gcode_position,homing_origin&print_stats=state';
	const sectionHeight = 100;

	let currentHeight = $state(0);
	let maxHeight = $state(950);
	let isIdle = $state(true);
	// Lo z-offset attuale serve solo al popup che lo regola: in card non si mostra.
	let zOffset = $state(0);
	let zOffsetOpen = $state(false);
	// Senza home (avvio, motori spenti, dopo un restart) Kalico continua a riportare l'ultima
	// posizione, ma la testa può essere stata spostata a mano: la Z non è nota. Falso finché
	// non arriva il primo dato, per non mostrare un numero che potrebbe essere falso.
	let zHomed = $state(false);
	const openZOffset = () => {
		if (zHomed) zOffsetOpen = true;
	};

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
		if (typeof toolhead?.homed_axes === 'string') zHomed = toolhead.homed_axes.includes('z');
		if (toolhead) {
			if (Array.isArray(toolhead.axis_maximum) && toolhead.axis_maximum.length > 2) {
				maxHeight = toolhead.axis_maximum[2];
			}
		}

		const gcodeMove = status.gcode_move;
		const origin = gcodeMove?.homing_origin;
		if (Array.isArray(origin) && origin.length > 2) zOffset = origin[2];

		// La Z reale della testa (toolhead), z-offset compreso; il G-code solo se manca.
		if (toolhead && Array.isArray(toolhead.position) && toolhead.position.length > 2) {
			currentHeight = Math.max(0, toolhead.position[2]);
		} else if (
			gcodeMove &&
			Array.isArray(gcodeMove.gcode_position) &&
			gcodeMove.gcode_position.length > 2
		) {
			currentHeight = Math.max(0, gcodeMove.gcode_position[2]);
		}
	};

	subscribeWhileVisible<ZHeightStatus>(
		dataSource,
		() => dataQuery,
		updateZHeight,
		() => visible
	);
</script>

<!-- Tutta la card apre lo z-offset (se la Z è nota); da tastiera e lettore di schermo c'è il
     pulsante. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<section class="z-height-panel" class:unknown={!zHomed} aria-label="Z Height" onclick={openZOffset}>
	<div class="z-progress-container">
		<div class="z-progress-bar">
			<!-- Z non nota: asta piena a strisce, come la barra "in preparazione". -->
			<div class="z-progress-fill" style="height: {zHomed ? fillPercentage : 100}%"></div>
			<!-- Section marks and labels -->
			<div class="z-marks">
				<!-- Tacche posizionali: l'indice è la loro identità, non c'è riordino. -->
				{#each sections as section, i (i)}
					<div class="z-mark" style="bottom: {section.bottom}%"></div>
				{/each}
			</div>
			<!-- Le etichette due volte: grigie sul bianco e, ritagliata sul riempimento,
			     una copia bianca che resta leggibile sul rosso. -->
			{#each zHomed ? [false, true] : [false] as onFill (onFill)}
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
		<!-- Sempre visibile, senza "/ massimo": solo la Z reale, o "—" se non è nota. -->
		<span class="z-value">{zHomed ? `${currentHeight.toFixed(1)} mm` : '—'}</span>
		<button
			type="button"
			class="z-offset-btn"
			disabled={!zHomed}
			onclick={(event) => {
				event.stopPropagation();
				openZOffset();
			}}
		>
			<FoldVertical size={24} />
			Z Offset
		</button>
	</div>
</section>

<ZOffsetSheet
	isOpen={zOffsetOpen}
	offset={zOffset}
	printing={!isIdle}
	onClose={() => (zOffsetOpen = false)}
/>

<style>
	.z-height-panel {
		cursor: pointer;
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

	/* Z non nota: le strisce ferme della barra "in preparazione" (DashboardControlPanel),
	   senza animazione perché non sta succedendo niente. */
	.unknown .z-progress-fill {
		background-color: var(--color-divider);
		background-image: repeating-linear-gradient(
			-45deg,
			rgba(var(--rgb-red), 0.18) 0 12px,
			transparent 12px 24px
		);
		transition: none;
	}

	.z-height-panel.unknown {
		cursor: default;
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
		/* Titolo e valore al centro della card, alla stessa altezza di FEEDING e FLOW: lo
		   spazio in alto è uguale a quello che in basso tiene libero il pulsante. */
		padding: 92px 12px;
		position: relative;
		justify-content: center;
		align-items: center;
		text-align: center;
		/* Le dimensioni sono quelle comuni alle card; il limite in cqw interviene solo se la
		   colonna è così stretta che "HEIGHT" ne uscirebbe. */
		container-type: inline-size;
	}

	/* Titolo e valore: stessi font delle altre card (vedi DashboardCarousel). */
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

	/* Il pulsante resta in fondo alla card.
	   Font e altezza come "Disable motors" (ToolheadPosition). */
	.z-offset-btn {
		position: absolute;
		left: 12px;
		right: 12px;
		bottom: 16px;
		background: var(--color-white);
		border: 1px solid var(--color-border-light);
		border-radius: 16px;
		box-sizing: border-box;
		padding: 17px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		color: var(--color-text-muted);
		font-family: inherit;
		font-size: 1.2rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		white-space: nowrap;
		cursor: pointer;
	}

	.z-offset-btn:hover:not(:disabled) {
		background: var(--color-background);
	}

	.z-offset-btn:disabled {
		cursor: default;
		opacity: 0.5;
	}

	.z-offset-btn :global(svg) {
		flex-shrink: 0;
	}
</style>
