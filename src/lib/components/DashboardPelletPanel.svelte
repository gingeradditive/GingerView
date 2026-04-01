<script lang="ts">
	let currentPellet = 2.5;
	let maxPellet = 5;
	let percentage = (currentPellet / maxPellet) * 100;
</script>

<section class="pellet-panel" aria-label="Pellet Level">
	<div class="pellet-visual">
		<div class="pellet-fill" style="height: {percentage}%"></div>
		<div class="pellet-text">
			<span class="pellet-label">PELLET</span>
			<span class="pellet-value">{currentPellet}/{maxPellet} KG</span>
		</div>
	</div>
</section>

<style>
	.pellet-panel {
		background: #ffffff;
		border-radius: 16px;
		padding: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		box-sizing: border-box;
		overflow: hidden;
		position: relative;
		box-shadow: 0px 4px 3px 0px #00000040;
	}

	.pellet-visual {
		width: 100%;
		height: 100%;
		background: #ffffff;
		border-radius: 16px;
		overflow: hidden;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.pellet-fill {
		position: absolute;
		bottom: 0;
		left: 0;
		width: 100%;
		background: #D72E28;
		transition: height 0.3s ease;
		z-index: 1;
	}

	.pellet-text {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		z-index: 2;
		color: #000000;
		text-align: center;
	}

	.pellet-label {
		font-size: 1rem;
		font-weight: 700;
		color: #000000;
	}

	.pellet-value {
		font-size: 0.85rem;
		color: #000000;
		font-weight: 500;
	}
</style>
