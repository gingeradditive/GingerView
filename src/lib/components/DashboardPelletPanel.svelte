<script lang="ts">
	// TODO: Pellet level display - fill visualization with current/max KG
</script>

<section class="pellet-panel" aria-label="Pellet Level">
	<div class="pellet-visual">
		<div class="pellet-fill"></div>
	</div>
	<div class="pellet-info">
		<span class="pellet-label">PELLET</span>
		<span class="pellet-value">-- / -- KG</span>
	</div>
</section>

<style>
	.pellet-panel {
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
		overflow: hidden;
		position: relative;
		box-shadow: 0px 4px 3px 0px #00000040;
	}

	.pellet-visual {
		width: 100%;
		height: 60px;
		background: #f0f0f0;
		border-radius: 8px;
		overflow: hidden;
		position: relative;
	}

	.pellet-fill {
		position: absolute;
		bottom: 0;
		left: 0;
		width: 100%;
		height: 0%;
		background: #d72e28;
		transition: height 0.3s ease;
	}

	.pellet-info {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}

	.pellet-label {
		font-size: 1.1rem;
		font-weight: 700;
		color: #111111;
	}

	.pellet-value {
		font-size: 0.95rem;
		color: #666666;
	}
</style>
