<script lang="ts">
	import { subscribeWhileVisible } from '$lib/services/panel-subscription.svelte';

	/**
	 * La velocità di stampa, disegnata come FLOW: anello rosso che si riempie fino alla
	 * velocità massima della macchina (`toolhead.max_velocity`).
	 */

	/** Falso quando la slide è fuori dalla viewport del carosello: l'iscrizione si ferma. */
	let { visible = true }: { visible?: boolean } = $props();

	type SpeedStatus = {
		print_stats?: { state?: string };
		motion_report?: { live_velocity?: number };
		toolhead?: { max_velocity?: number };
	};

	const dataSource = 'dashboard-speed';
	const dataQuery = 'motion_report&print_stats&toolhead';
	const radius = 88;
	const circumference = 2 * Math.PI * radius;

	let speedValue = $state(0);
	let maxValue = $state(500);
	let isIdle = $state(true);

	let clampedValue = $derived(Math.min(maxValue, Math.max(0, speedValue)));
	let progress = $derived(isIdle ? 0 : clampedValue / maxValue);
	// Mai lungo zero: col tratto arrotondato resta almeno un pallino pieno, anche a 0 mm/s.
	let strokeDasharray = $derived(`${Math.max(progress * circumference, 0.01)} ${circumference}`);
	// A stampa ferma la velocità è zero, come il flusso in FLOW.
	let shownValue = $derived(isIdle ? 0 : clampedValue);

	const updateSpeed = (status: SpeedStatus): void => {
		const printState = status.print_stats?.state ?? 'standby';
		isIdle = printState !== 'printing' && printState !== 'paused';

		const max = status.toolhead?.max_velocity;
		if (typeof max === 'number' && max > 0) maxValue = max;

		const velocity = status.motion_report?.live_velocity;
		if (typeof velocity === 'number') speedValue = Math.abs(velocity);
	};

	subscribeWhileVisible<SpeedStatus>(
		dataSource,
		() => dataQuery,
		updateSpeed,
		() => visible
	);
</script>

<section class="speed-panel" aria-label="Print speed">
	<div class="speed-gauge">
		<svg
			viewBox="0 0 220 220"
			class="circular-progress"
			role="img"
			aria-label={`Speed ${Math.round(shownValue)} mm/s`}
		>
			<circle class="circle-bg" cx="110" cy="110" r={radius} />
			<circle class="circle" cx="110" cy="110" r={radius} stroke-dasharray={strokeDasharray} />
		</svg>
		<div class="gauge-content">
			<div class="speed-label">SPEED</div>
			<div class="speed-value">{Math.round(shownValue)} mm/s</div>
		</div>
	</div>
</section>

<style>
	.speed-panel {
		background: var(--color-white);
		border-radius: 19.2px;
		padding: 16px;
		width: 100%;
		height: 100%;
		box-sizing: border-box;
		box-shadow: var(--shadow-panel);
		display: flex;
		align-items: center;
		justify-content: center;
		/* Come FLOW: il gauge si misura sulla card, non sullo schermo. */
		container-type: size;
	}

	.speed-gauge {
		/* Lato del gauge: il quadrato più grande che sta nella card, come in FLOW. */
		--gauge: min(100cqw, 100cqh);
		position: relative;
		width: var(--gauge);
		height: var(--gauge);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.circular-progress {
		width: 100%;
		height: 100%;
		transform: rotate(90deg);
	}

	.circle-bg {
		stroke: var(--color-text-subtle);
		stroke-width: 10;
		fill: none;
		stroke-dasharray: none;
		stroke-linecap: round;
	}

	.circle {
		stroke: var(--color-red);
		stroke-width: 14;
		fill: none;
		stroke-linecap: round;
		transition: stroke-dasharray 0.3s ease;
	}

	.gauge-content {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: calc(var(--dashboard-title-size) * 0.25);
		/* Il testo resta dentro l'anello, come in FLOW. */
		padding: 0 calc(var(--gauge) * 0.2);
		text-align: center;
		pointer-events: none;
	}

	/* Dimensioni comuni a tutte le card, calcolate in DashboardCarousel. */
	.speed-label {
		font-size: var(--dashboard-title-size);
		font-weight: 700;
		color: var(--color-black);
		line-height: 1.1;
		letter-spacing: 0.02em;
	}

	.speed-value {
		font-size: var(--dashboard-subtitle-size);
		font-weight: 500;
		color: var(--color-text-soft);
		line-height: 1.3;
	}
</style>
