<script lang="ts">
	import type { TimezoneEntry } from '$lib/data/timezones';
	import { MAP_HEIGHT, MAP_LAT_TOP, MAP_WIDTH, WORLD_LAND_PATH } from '$lib/data/world-map';

	/**
	 * Mappa del mondo con la fascia oraria selezionata evidenziata e un segnaposto
	 * sulla città della zona.
	 *
	 * È un elemento **decorativo**: serve a dare un riscontro immediato di "sto
	 * scegliendo questa parte del mondo", non a essere una carta dei fusi orari —
	 * i confini veri seguono quelli politici. Chi vuole il dato esatto legge
	 * l'identificatore e l'offset scritti sotto.
	 */
	let {
		zone,
		offsetMinutes,
		label
	}: {
		/** Zona selezionata; `null` se l'identificatore non è nel nostro elenco. */
		zone: TimezoneEntry | null;
		offsetMinutes: number;
		label: string;
	} = $props();

	/** Confini fra fasce: ogni 15° a partire da 7.5°, cioè mezzo fuso da Greenwich. */
	const separators = Array.from({ length: 24 }, (_, index) => 7.5 + index * 15);

	/**
	 * Centro della fascia evidenziata, in unità di mappa (1 unità = 1 grado).
	 *
	 * Si ricava dalla **longitudine della città**, non dall'offset: così la fascia
	 * contiene sempre il segnaposto. Centrandola sull'offset succederebbe il
	 * contrario ogni volta che l'ora locale non corrisponde al meridiano —
	 * d'estate con l'ora legale (Roma è a 12°E ma segna UTC+2, cioè il meridiano
	 * 30°E) e tutto l'anno dove il fuso è una scelta politica (Spagna, Argentina,
	 * Cina). Un riquadro rosso lontano dal punto rosso si legge come un errore.
	 *
	 * Resta l'offset per le zone che non sono nel nostro elenco e di cui quindi
	 * non conosciamo le coordinate.
	 */
	let bandCenter = $derived(
		MAP_WIDTH / 2 + (zone ? Math.round(zone.lon / 15) * 15 : Math.round(offsetMinutes / 60) * 15)
	);

	let pinX = $derived(zone ? ((zone.lon + 180) / MAP_WIDTH) * 100 : 50);
	// Le zone antartiche stanno sotto il ritaglio della mappa: il segnaposto si
	// ferma sul bordo invece di uscire dal riquadro.
	let pinY = $derived(
		zone ? Math.min(97, Math.max(3, ((MAP_LAT_TOP - zone.lat) / MAP_HEIGHT) * 100)) : 50
	);

	/** L'etichetta resta staccata dai bordi anche quando il segnaposto è sull'orlo. */
	let labelX = $derived(Math.min(86, Math.max(14, pinX)));
	/** Sopra il segnaposto, tranne quando non c'è spazio e finirebbe fuori. */
	let labelBelow = $derived(pinY < 22);
</script>

<div class="map">
	<svg viewBox="0 0 {MAP_WIDTH} {MAP_HEIGHT}" role="img" aria-label="World map, {label}">
		<rect class="ocean" x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} />

		{#each separators as x (x)}
			<line class="separator" x1={x} y1="0" x2={x} y2={MAP_HEIGHT} />
		{/each}

		<path class="land" d={WORLD_LAND_PATH} />

		<!--
			Tre copie della stessa fascia, sfalsate di un giro: quella che serve è
			sempre dentro il viewBox e le altre due restano fuori. Evita di dover
			spezzare a mano la fascia a cavallo dell'antimeridiano, quella delle zone
			del Pacifico attorno ai 180° (Auckland, Fiji, Kamchatka).
		-->
		{#each [-MAP_WIDTH, 0, MAP_WIDTH] as wrap (wrap)}
			<rect
				class="band"
				x="-7.5"
				y="0"
				width="15"
				height={MAP_HEIGHT}
				style="transform: translateX({bandCenter + wrap}px)"
			/>
		{/each}
	</svg>

	{#if zone}
		<span class="pin" style="left: {pinX}%; top: {pinY}%"></span>
		<span class="label" class:below={labelBelow} style="left: {labelX}%; top: {pinY}%">
			{label}
		</span>
	{/if}
</div>

<style>
	.map {
		position: relative;
		/*
			Il rapporto della carta è fisso, quindi su uno schermo largo una mappa a
			tutta larghezza diventerebbe alta mezzo metro: oltre questa misura resta
			un riquadro centrato.
		*/
		width: 100%;
		max-width: 620px;
		margin: 0 auto;
		border-radius: 16px;
		overflow: hidden;
		background: #eef2f7;
		flex-shrink: 0;
	}
	.map svg {
		display: block;
		width: 100%;
		height: auto;
	}
	.ocean {
		fill: #eef2f7;
	}
	.land {
		fill: #ccd5e0;
	}
	.separator {
		stroke: #ffffff;
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
		opacity: 0.7;
	}
	.band {
		fill: #d72e28;
		fill-opacity: 0.16;
		stroke: #d72e28;
		stroke-opacity: 0.45;
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
		transition: transform 350ms ease;
	}
	.pin {
		position: absolute;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: #d72e28;
		border: 2px solid #ffffff;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
		transform: translate(-50%, -50%);
		transition:
			left 350ms ease,
			top 350ms ease;
		pointer-events: none;
	}
	.label {
		position: absolute;
		transform: translate(-50%, calc(-100% - 12px));
		background: rgba(34, 34, 34, 0.88);
		color: #ffffff;
		font-size: 0.8rem;
		font-weight: 600;
		white-space: nowrap;
		padding: 4px 10px;
		border-radius: 999px;
		transition:
			left 350ms ease,
			top 350ms ease;
		pointer-events: none;
	}
	.label.below {
		transform: translate(-50%, 12px);
	}
</style>
