<script lang="ts">
	// TODO: Flow rate display - circular gauge with mm³/s value
</script>

<section class="flow-panel" aria-label="Flow Rate">
	<div class="flow-gauge">
		<svg viewBox="0 0 100 100" class="gauge-ring">
			<circle cx="50" cy="50" r="40" fill="none" stroke="#e0e0e0" stroke-width="8" />
			<circle cx="50" cy="50" r="40" fill="none" stroke="#d72e28" stroke-width="8"
				stroke-dasharray="251.2" stroke-dashoffset="251.2"
				stroke-linecap="round" transform="rotate(-90 50 50)" />
		</svg>
	</div>
	<div class="flow-info">
		<span class="flow-label">FLOW</span>
		<span class="flow-value">-- mm³/s</span>
	</div>
</section>

<style>
	.flow-panel {
		background: #ffffff;
		border-radius: 16px;
		padding: 20px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		height: 100%;
		box-sizing: border-box;
		box-shadow: 0px 4px 3px 0px #00000040;
	}

	.flow-gauge {
		width: 100px;
		height: 100px;
	}

	.gauge-ring {
		width: 100%;
		height: 100%;
	}

	.flow-info {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}

	.flow-label {
		font-size: 1.1rem;
		font-weight: 700;
		color: #111111;
	}

	.flow-value {
		font-size: 0.95rem;
		color: #666666;
	}
</style>
