<script lang="ts">
	// TODO: Quick action buttons - fan control, light control, etc.
</script>

<section class="quick-actions-panel" aria-label="Quick Actions">
	<button class="action-btn" aria-label="Fan">
		<svg viewBox="0 0 24 24" width="28" height="28">
			<circle cx="12" cy="12" r="10" fill="none" stroke="#d72e28" stroke-width="2"/>
		</svg>
	</button>
	<button class="action-btn" aria-label="Light">
		<svg viewBox="0 0 24 24" width="28" height="28">
			<circle cx="12" cy="12" r="10" fill="none" stroke="#d72e28" stroke-width="2"/>
		</svg>
	</button>
</section>

<style>
	.quick-actions-panel {
		background: #ffffff;
		border-radius: 16px;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		align-items: center;
		justify-content: center;
		height: 100%;
		box-sizing: border-box;
		box-shadow: 0px 4px 3px 0px #00000040;
	}

	.action-btn {
		width: 56px;
		height: 56px;
		border-radius: 12px;
		border: none;
		background: #d72e28;
		color: #ffffff;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background-color 0.2s ease;
	}

	.action-btn:hover {
		background: #b82520;
	}

	.action-btn svg {
		stroke: #ffffff;
	}
</style>
