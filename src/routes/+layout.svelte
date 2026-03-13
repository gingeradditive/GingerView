<script lang="ts">
	import { page } from '$app/stores';
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<main class="page-content">{@render children()}</main>

<nav class="dock" aria-label="Navigazione principale">
	<a href="/" class:active={$page.url.pathname === '/'} aria-label="Dashboard" title="Dashboard">
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<path d="M3 3h8v8H3V3zm10 0h8v5h-8V3zM3 13h5v8H3v-8zm7 0h11v8H10v-8z" />
		</svg>
	</a>

	<a
		href="/filelist"
		class:active={$page.url.pathname.startsWith('/filelist')}
		aria-label="FileList"
		title="FileList"
	>
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<path d="M4 11.5L12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-8.5z" />
		</svg>
	</a>
</nav>

<style>
	.page-content {
		min-height: 100vh;
	}

	.dock {
		position: fixed;
		left: 50%;
		bottom: 20px;
		transform: translateX(-50%);
		display: flex;
		gap: 8px;
		padding: 8px;
		background: rgba(255, 255, 255, 0.85);
		border: 1px solid #c8c8c8;
		border-radius: 16px;
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		z-index: 1000;
	}

	.dock a {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		color: #111111;
		border-radius: 12px;
		text-decoration: none;
		background: transparent;
	}

	.dock a:hover {
		background: #ececec;
	}

	.dock a.active {
		background: #e5e5e5;
	}

	.dock a:focus-visible {
		outline: 2px solid #d72e28;
		outline-offset: 2px;
	}

	.dock svg {
		width: 22px;
		height: 22px;
		fill: currentColor;
	}
</style>
