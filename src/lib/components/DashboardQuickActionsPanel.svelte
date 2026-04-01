<script lang="ts">
	import { mdiLightbulb, mdiFan } from '@mdi/js';
	// TODO: Quick action buttons - fan control, light control, etc.
</script>

<section class="quick-actions-panel" aria-label="Quick Actions">
	<div class="action-subpanel">
		<button class="action-btn" aria-label="Fan">
			<svg viewBox="0 0 36 36" class="circular-progress">
				<circle class="circle-bg" cx="18" cy="18" r="16" />
				<circle class="circle" cx="18" cy="18" r="16" stroke-dasharray="75.4, 100.53" />
				<foreignObject x="6" y="6" width="24" height="24">
					<div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">
						<svg viewBox="0 0 24 24" width="20" height="20"><path d={mdiFan} fill="#d72e28" /></svg>
					</div>
				</foreignObject>
			</svg>
		</button>
	</div>
	<div class="action-subpanel">
		<button class="action-btn" aria-label="Light">
			<svg viewBox="0 0 36 36" class="circular-progress">
				<circle class="circle-bg" cx="18" cy="18" r="16" />
				<circle class="circle" cx="18" cy="18" r="16" stroke-dasharray="42.2, 100.53" />
				<foreignObject x="6" y="6" width="24" height="24">
					<div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">
						<svg viewBox="0 0 24 24" width="20" height="20" style="transform: rotate(90deg);"><path d={mdiLightbulb} fill="#d72e28" /></svg>
					</div>
				</foreignObject>
			</svg>
		</button>
	</div>
</section>

<style>
	.quick-actions-panel {
		background: transparent;
		border-radius: 16px;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 36px;
		align-items: stretch;
		justify-content: center;
		height: 100%;
		box-sizing: border-box;
	}

	.action-subpanel {
		background: #ffffff;
		border-radius: 12px;
		padding: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		box-sizing: border-box;
		box-shadow: 0px 2px 2px 0px #00000020;
	}

	.action-btn {
		width: 56px;
		height: 56px;
		border-radius: 12px;
		border: none;
		background: #ffffff;
		color: #d72e28;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background-color 0.2s ease;
	}

	.action-btn:hover {
		background: #f5f5f5;
	}

	.action-btn svg {
		stroke: #d72e28;
	}

	.circular-progress {
		width: 48px;
		height: 48px;
		transform: rotate(-90deg);
	}

	.circle-bg {
		stroke: #f3f4f6;
		stroke-width: 4;
		fill: none;
	}

	.circle {
		stroke: #d72e28;
		stroke-width: 4;
		fill: none;
		stroke-linecap: round;
		transition: stroke-dasharray 0.3s ease;
	}

	</style>
