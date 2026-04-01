<script lang="ts">
	// Mock data for Z Height
	const currentHeight = 350.5;
	const maxHeight = 950;
	const totalSections = 10; // 10 sections representing 1m total
	const sectionHeight = 100; // Each section represents 100mm
	
	// Calculate fill percentage
	const fillPercentage = (currentHeight / maxHeight) * 100;
	
	// Generate section marks
	const sections = Array.from({ length: totalSections }, (_, i) => {
		const value = (i + 1) * sectionHeight;
		return {
			mark: value,
			label: value === 1000 ? '1m' : `${value}mm`
		};
	});
</script>

<section class="z-height-panel" aria-label="Z Height">
	<div class="z-progress-container">
		<div class="z-progress-bar">
			<div class="z-progress-fill" style="height: {fillPercentage}%"></div>
			<!-- Section marks and labels -->
			<div class="z-marks">
				{#each sections as section, i}
					<div class="z-mark" style="bottom: {(i + 1) * 10}%"></div>
				{/each}
			</div>
			<div class="z-labels">
				{#each sections as section, i}
					<div class="z-label-mark" style="bottom: {(i + 1) * 10}%">
						{section.label}
					</div>
				{/each}
			</div>
		</div>
	</div>
	<div class="z-info">
		<span class="z-label">Z HEIGHT</span>
		<span class="z-value">{currentHeight} / {maxHeight} mm</span>
	</div>
</section>

<style>
	.z-height-panel {
		background: #ffffff;
		border-radius: 16px;
		padding: 0;
		display: flex;
		align-items: stretch;
		height: 100%;
		box-sizing: border-box;
		box-shadow: 0px 4px 3px 0px #00000040;
		overflow: hidden;
	}

	.z-progress-container {
		position: relative;
		width: 40px;
		height: 100%;
		flex-shrink: 0;
	}

	.z-progress-bar {
		position: relative;
		width: 100%;
		height: 100%;
		background: #ffffff;
		border-radius: 0;
		overflow: hidden;
		border-right: 1px solid #000000;
	}

	.z-progress-fill {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		background: #D72E28;
		border-radius: 0;
		transition: height 0.3s ease;
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
		right: 50%;
		height: 1px;
		background: #000000;
	}

	.z-labels {
		position: absolute;
		top: -5px;
		right: -45px;
		bottom: -5px;
		pointer-events: none;
	}

	.z-label-mark {
		position: absolute;
		right: 0;
		font-size: 0.7rem;
		color: #666666;
		transform: translateY(50%);
		white-space: nowrap;
	}

	.z-info {
		display: flex;
		flex-direction: column;
		gap: 8px;
		flex: 1;
		padding: 20px;
		justify-content: center;
	}

	.z-label {
		font-size: 1rem;
		font-weight: 700;
		color: #111111;
	}

	.z-value {
		font-size: 0.85rem;
		color: #666666;
		font-weight: 500;
	}
</style>
