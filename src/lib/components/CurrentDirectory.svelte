<script lang="ts">
	import { mdiChevronLeft } from '@mdi/js';
	import { tooltip } from '$lib/actions/tooltip';
	import { currentDirPath, navigateUp } from '$lib/stores/directoryStore';

	const segments = $derived($currentDirPath ? $currentDirPath.split('/') : []);
	const currentFolder = $derived(segments.length > 0 ? segments[segments.length - 1] : 'Home');
	const hasParent = $derived(segments.length > 0);
</script>

<div class="current-directory">
	<div class="breadcrumb">
		{#if hasParent}
			<button
				type="button"
				class="back-button clickable"
				aria-label="Parent folder"
				use:tooltip
				onclick={navigateUp}
			>
				<svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true">
					<path d={mdiChevronLeft} fill="currentColor" />
				</svg>
			</button>
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
		color: var(--color-black);
		font-family: var(--font-sans);
	}

	.back-button {
		color: var(--color-red);
		padding: 4px;
		background: transparent;
		border: none;
		transition: opacity 0.2s;
		cursor: pointer;
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
