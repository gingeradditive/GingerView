<script lang="ts">
	import DashboardCarousel from '$lib/components/DashboardCarousel.svelte';
	import DashboardControlPanel from '$lib/components/DashboardControlPanel.svelte';
</script>

<div class="dashboard-container">
	<div class="carousel-area">
		<DashboardCarousel />
	</div>
	<div class="bottom-container">
		<DashboardControlPanel />
	</div>
</div>

<style>
	.dashboard-container {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		padding: 16px 16px 112px;
		gap: 16px;
		box-sizing: border-box;
	}

	.carousel-area {
		flex: 1;
		min-height: 0;
	}

	.bottom-container {
		flex-shrink: 0;
	}
</style>
