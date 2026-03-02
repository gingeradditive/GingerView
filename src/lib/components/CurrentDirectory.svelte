<script lang="ts">
	import { mdiChevronLeft } from '@mdi/js';
	import { currentDirPath, navigateToRoot, navigateToSegment, navigateUp } from '$lib/stores/directoryStore';

	let dirPath = '';
	const unsubscribe = currentDirPath.subscribe((value) => {
		dirPath = value;
	});

	$: segments = dirPath ? dirPath.split('/') : [];
	$: currentFolder = segments.length > 0 ? segments[segments.length - 1] : 'Home';
	$: hasParent = segments.length > 0;

	function handleSegmentClick(index: number) {
		navigateToSegment(index, segments);
	}
</script>

<div class="current-directory">
	<div class="breadcrumb">
		{#if hasParent}
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<span class="back-button clickable" role="button" tabindex="0" on:click={navigateUp}>
				<svg viewBox="0 0 24 24" width="40" height="40">
					<path d={mdiChevronLeft} fill="currentColor" />
				</svg>
			</span>
		{/if}
		<span class="current-folder">{currentFolder}</span>
	</div>
</div>

<style>
	.current-directory {
		padding: 12px 0;
	}

	.breadcrumb {
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 1.5rem;
		font-weight: 700;
		color: #111111;
		font-family: 'Montserrat', sans-serif;
	}

	.back-button {
		color: #D72E28;
		padding: 4px;
		background: transparent;
		border: none;
		transition: opacity 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.current-folder {
		white-space: nowrap;
	}

	.clickable {
		cursor: pointer;
	}

	.clickable:hover {
		opacity: 0.7;
	}
</style>
