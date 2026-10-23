<script lang="ts">
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';

	// Un indirizzo sbagliato (link vecchio, URL scritto a mano) è il caso normale:
	// lo si dice in parole e si riporta alla dashboard. Gli altri errori mostrano
	// il messaggio di SvelteKit, che è l'unica cosa utile da riferire.
	const isNotFound = $derived($page.status === 404);
	const title = $derived(isNotFound ? 'Oops, nothing here' : 'Something went wrong');
</script>

<svelte:head>
	<title>{title} · G2</title>
</svelte:head>

<section class="error-page">
	<div class="error-card">
		<span class="error-code">{$page.status}</span>
		<h1>{title}</h1>
		<p>
			{#if isNotFound}
				We couldn't find this page. It may have moved, or there's a typo in the address.
			{:else}
				{$page.error?.message ?? "That wasn't supposed to happen"}
			{/if}
		</p>
		<a class="home-btn" href={resolve('/')}>Back to dashboard</a>
	</div>
</section>

<style>
	.error-page {
		height: 100%;
		box-sizing: border-box;
		padding: 24px 16px var(--dock-clearance);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.error-card {
		width: 100%;
		max-width: 420px;
		box-sizing: border-box;
		padding: 32px 24px;
		background: var(--color-white);
		border-radius: 20px;
		box-shadow: var(--shadow-float);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		text-align: center;
	}

	.error-code {
		font-size: 3.5rem;
		font-weight: 800;
		line-height: 1;
		color: var(--color-red);
	}

	h1 {
		margin: 0;
		font-size: 1.4rem;
		font-weight: 700;
		color: var(--color-text-secondary);
	}

	p {
		margin: 0;
		font-size: 0.95rem;
		line-height: 1.5;
		color: var(--color-text-soft);
	}

	.home-btn {
		margin-top: 8px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 48px;
		padding: 0 24px;
		border-radius: 12px;
		background: var(--color-red);
		color: var(--color-white);
		font-weight: 700;
		text-decoration: none;
	}

	.home-btn:hover {
		background: var(--color-red-dark);
	}
</style>
