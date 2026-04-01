<script lang="ts">
	// TODO: Z Height display - current height / max height with vertical indicator
</script>

<section class="z-height-panel" aria-label="Z Height">
	<div class="z-indicator"></div>
	<div class="z-info">
		<span class="z-label">Z HEIGHT</span>
		<span class="z-value">-- / -- mm</span>
	</div>
</section>

<style>
	.z-height-panel {
		background: #ffffff;
		border-radius: 16px;
		padding: 20px;
		display: flex;
		align-items: center;
		gap: 16px;
		height: 100%;
		box-sizing: border-box;
		box-shadow: 0px 4px 3px 0px #00000040;
	}

	.z-indicator {
		width: 4px;
		height: 80%;
		min-height: 60px;
		background: #e0e0e0;
		border-radius: 2px;
		position: relative;
	}

	.z-info {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.z-label {
		font-size: 1.1rem;
		font-weight: 700;
		color: #111111;
	}

	.z-value {
		font-size: 1rem;
		color: #666666;
	}
</style>
