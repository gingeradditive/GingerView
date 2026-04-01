<script lang="ts">
	// Mock data
	const jobName = 'Benchy';
	const jobMaterial = 'PETG GF 10 V2';
	const elapsed = '03:25:21';
	const remaining = '01:21:12';
	const eta = '18:05';
	const progress = 68;
</script>

<section class="print-job-panel" aria-label="Print Job Info">
	<div class="job-header">
		<div class="job-info">
			<span class="job-name">{jobName}</span>
			<span class="job-material">{jobMaterial}</span>
		</div>
		<div class="job-preview">
			<img src="/error-thumbnail.png" alt="Print preview" />
		</div>
		<div class="job-controls">
			<button class="control-btn stop" aria-label="Stop">
				<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
					<rect x="2" y="2" width="14" height="14" rx="2" fill="#d72e28" />
				</svg>
			</button>
			<button class="control-btn pause" aria-label="Pause">
				<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
					<rect x="3" y="1" width="4" height="16" rx="1.5" fill="#d72e28" />
					<rect x="11" y="1" width="4" height="16" rx="1.5" fill="#d72e28" />
				</svg>
			</button>
		</div>
	</div>
	<div class="progress-bar">
		<div class="progress-track">
			<div class="progress-elapsed" style="width: {progress}%">
				<span class="elapsed-time">{elapsed}</span>
				<span class="percentage">{progress}%</span>
			</div>
			<div class="progress-remaining" style="width: {100 - progress}%">
				<span class="remaining-time">{remaining}</span>
				<span class="eta-time">ETA: {eta}</span>
			</div>
		</div>
	</div>
</section>

<style>
	.print-job-panel {
		background: #ffffff;
		border-radius: 16px;
		padding: 16px 0 0 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
		height: 100%;
		box-sizing: border-box;
		box-shadow: 0px 4px 3px 0px #00000040;
	}

	.job-header {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		flex: 1;
		padding: 0 16px;
	}

	.job-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.job-name {
		font-size: 1.6rem;
		font-weight: 800;
		color: #222222;
		line-height: 1.1;
	}

	.job-material {
		font-size: 0.8rem;
		color: #666666;
		font-weight: 500;
	}

	.job-preview {
		flex-shrink: 0;
		margin-left: auto;
	}

	.job-preview img {
		width: auto;
		height: 130px;
		object-fit: contain;
	}

	.job-controls {
		display: flex;
		gap: 12px;
		flex-shrink: 0;
		align-self: center;
		margin-left: auto;
	}

	.control-btn {
		width: 58px;
		height: 58px;
		border-radius: 14px;
		border: 3px solid #d72e28;
		background: transparent;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
	}

	.control-btn:hover {
		background: #fde8e7;
	}

	.progress-bar {
		display: flex;
		flex-direction: column;
	}

	.progress-track {
		display: flex;
		width: 100%;
		height: 36px;
		border-radius: 0 0 16px 16px;
		overflow: hidden;
	}

	.progress-elapsed {
		background: #d72e28;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 12px;
		min-width: 0;
	}

	.elapsed-time {
		color: #ffffff;
		font-size: 0.95rem;
		font-weight: 700;
		white-space: nowrap;
	}

	.percentage {
		color: #ffffff;
		font-size: 1.15rem;
		font-weight: 800;
		white-space: nowrap;
	}

	.progress-remaining {
		background: #b0b0b0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 12px;
		min-width: 0;
	}

	.remaining-time {
		color: #ffffff;
		font-size: 0.8rem;
		font-weight: 600;
		white-space: nowrap;
	}

	.eta-time {
		color: #ffffff;
		font-size: 0.8rem;
		font-weight: 600;
		white-space: nowrap;
		margin-left: auto;
	}
</style>
