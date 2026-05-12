<script lang="ts">
	import ToolheadPosition from '$lib/components/ToolheadPosition.svelte';
	import ExtrudeDialog from '$lib/components/ExtrudeDialog.svelte';
</script>

<div class="movement-page">
	<div class="movement-grid">
		<ToolheadPosition />
		<ExtrudeDialog />
	</div>
</div>

<style>
	.movement-page {
		padding: 34px;
		padding-bottom: 114px;
		height: 100vh;
		box-sizing: border-box;
	}

	.movement-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 34px;
		height: 100%;
	}
</style>
