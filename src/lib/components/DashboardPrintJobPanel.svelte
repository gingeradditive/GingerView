<script lang="ts">
	// TODO: Print job info - name, material, 3D preview, stop/pause buttons, progress bar
</script>

<section class="print-job-panel" aria-label="Print Job Info">
	<div class="job-header">
		<div class="job-info">
			<span class="job-name">--</span>
			<span class="job-material">--</span>
		</div>
		<div class="job-preview"></div>
		<div class="job-controls">
			<button class="control-btn stop" aria-label="Stop">&#9632;</button>
			<button class="control-btn pause" aria-label="Pause">&#10074;&#10074;</button>
		</div>
	</div>
	<div class="progress-bar">
		<div class="progress-times">
			<span class="elapsed">--:--:--</span>
			<span class="percentage">--%</span>
			<span class="remaining">--:--:--</span>
			<span class="eta">ETA: --:--</span>
		</div>
		<div class="progress-track">
			<div class="progress-fill" style="width: 0%"></div>
		</div>
	</div>
</section>

<style>
	.print-job-panel {
		background: #ffffff;
		border-radius: 16px;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		height: 100%;
		box-sizing: border-box;
		box-shadow: 0px 4px 3px 0px #00000040;
	}

	.job-header {
		display: flex;
		align-items: center;
		gap: 12px;
		flex: 1;
	}

	.job-info {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.job-name {
		font-size: 1.5rem;
		font-weight: 700;
		color: #111111;
	}

	.job-material {
		font-size: 0.85rem;
		color: #666666;
	}

	.job-preview {
		width: 80px;
		height: 80px;
		background: #f0f0f0;
		border-radius: 8px;
		margin-left: auto;
	}

	.job-controls {
		display: flex;
		gap: 8px;
	}

	.control-btn {
		width: 44px;
		height: 44px;
		border-radius: 8px;
		border: none;
		background: #d72e28;
		color: #ffffff;
		font-size: 1rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.progress-bar {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.progress-times {
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 0.8rem;
		color: #666666;
	}

	.percentage {
		font-size: 1.1rem;
		font-weight: 700;
		color: #d72e28;
	}

	.elapsed {
		background: #d72e28;
		color: #ffffff;
		padding: 4px 10px;
		border-radius: 4px;
		font-weight: 600;
	}

	.remaining, .eta {
		color: #888888;
	}

	.progress-track {
		width: 100%;
		height: 6px;
		background: #e0e0e0;
		border-radius: 3px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: #d72e28;
		border-radius: 3px;
		transition: width 0.3s ease;
	}
</style>
