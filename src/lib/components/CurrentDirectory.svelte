<script lang="ts">
	interface DirectoryPath {
		name: string;
		path: string;
	}

	const currentPath: DirectoryPath[] = [
		{ name: 'Home', path: '/home' }
	];
</script>

<div class="current-directory">
	<div class="breadcrumb">
		{#each currentPath as segment, index}
			<span class="path-segment">
				{segment.name}
			</span>
			{#if index < currentPath.length - 1}
				<span class="separator">/</span>
			{/if}
		{/each}
	</div>
</div>

<style>
	.current-directory {
		padding: 12px 0;
	}

	.breadcrumb {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 1.5rem;
		font-weight: 700;
		color: #111111;
		font-family: 'Montserrat', sans-serif;
		flex-wrap: wrap;
	}

	.path-segment {
		white-space: nowrap;
	}

	.separator {
		color: #C8C8C8;
		font-weight: 400;
		user-select: none;
	}
</style>
