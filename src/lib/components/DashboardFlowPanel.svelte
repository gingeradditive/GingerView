<script lang="ts">
	export let flowValue = 550;

	const minValue = 0;
	const maxValue = 800;
	const radius = 88;
	const circumference = 2 * Math.PI * radius;

	$: clampedValue = Math.min(maxValue, Math.max(minValue, flowValue));
	$: progress = (clampedValue - minValue) / (maxValue - minValue);
	$: strokeDasharray = `${progress * circumference} ${circumference}`;
</script>

<section class="flow-panel" aria-label="Flow Rate">
	<div class="flow-gauge">
		<svg viewBox="0 0 220 220" class="circular-progress" role="img" aria-label={`Flow ${Math.round(clampedValue)} mm³/s`}>
			<circle class="circle-bg" cx="110" cy="110" r={radius} />
			<circle class="circle" cx="110" cy="110" r={radius} stroke-dasharray={strokeDasharray} />
		</svg>
		<div class="gauge-content">
			<div class="flow-label">FLOW</div>
			<div class="flow-value">{Math.round(clampedValue)} mm³/s</div>
		</div>
	</div>
</section>

<style>
	.flow-panel {
		background: #ffffff;
		border-radius: 16px;
		padding: 16px;
		width: 100%;
		aspect-ratio: 1 / 1;
		box-sizing: border-box;
		box-shadow: 0px 4px 3px 0px #00000040;
	}

	.flow-gauge {
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.circular-progress {
		width: 100%;
		height: 100%;
		transform: rotate(-90deg);
	}

	.circle-bg {
		stroke: #828282;
		stroke-width: 10;
		fill: none;
		stroke-dasharray: none;
		stroke-linecap: round;
	}

	.circle {
		stroke: #d72e28;
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
		gap: 10px;
		text-align: center;
		pointer-events: none;
	}

	.flow-label {
		font-size: 1rem;
    	font-weight: 700;
    	color: #000000;
		color: #111111;
		line-height: 1.1;
		letter-spacing: 0.02em;
	}

	.flow-value {
		font-size: 0.85rem;
		font-weight: 500;
		color: #666666;
		line-height: 1.3;
	}
</style>
