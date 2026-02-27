<script lang="ts">
	import PrintList from './PrintList.svelte';
</script>

<div class="app-shell">
	<main class="content-area">
		<div class="page-panel">
			<PrintList />
		</div>
	</main>
</div>

<style>
	.app-shell {
		display: flex;
		height: 100vh;
		width: 100vw;
		background: #f1f5f9;
		font-family: 'Roboto', 'Inter', sans-serif;
	}

	.content-area {
		flex: 1;
		overflow-y: auto;
		padding: 24px;
		display: flex;
		flex-direction: column;
	}

	.page-panel {
		background: transparent;
		backdrop-filter: none;
		-webkit-backdrop-filter: none;
		border-radius: 0;
		border: none;
		box-shadow: none;
		flex: 1;
		overflow: auto;
		min-height: 0;
	}
</style>
