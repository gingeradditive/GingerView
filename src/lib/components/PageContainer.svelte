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
		min-height: 100vh;
		width: 100%;
		background: #C8C8C8;
		font-family: 'Montserrat', sans-serif;
		overflow-x: hidden;
	}

	.content-area {
		flex: 1;
		overflow-y: auto;
		padding: 24px 24px 92px;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.page-panel {
		background: transparent;
		backdrop-filter: none;
		-webkit-backdrop-filter: none;
		border-radius: 0;
		border: none;
		box-shadow: none;
		flex: 1;
		overflow-x: hidden;
		overflow-y: visible;
		min-height: 0;
	}
</style>
