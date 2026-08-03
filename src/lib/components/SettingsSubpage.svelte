<script lang="ts">
	import { ArrowLeft } from 'lucide-svelte';

	let { title, children }: { title: string; children?: import('svelte').Snippet } = $props();
</script>

<section class="subpage">
	<header class="subpage-header">
		<a href="/settings" class="back-btn" aria-label="Torna a Settings" title="Torna a Settings">
			<ArrowLeft />
		</a>
		<h1>{title}</h1>
	</header>
	<div class="subpage-body">
		{#if children}
			{@render children()}
		{:else}
			<p class="placeholder">Coming soon.</p>
		{/if}
	</div>
</section>

<style>
	.subpage {
		padding: 24px 24px 112px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	.subpage-header {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.back-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 14px;
		background: #ffffff;
		color: #111111;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
		flex-shrink: 0;
	}
	.subpage-header h1 {
		margin: 0;
		font-size: 1.6rem;
	}
	.subpage-body {
		background: #ffffff;
		border-radius: 20px;
		padding: 20px;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
		min-height: 200px;
	}
	.placeholder {
		margin: 0;
		color: #6e6e6e;
		font-size: 0.95rem;
	}
</style>
