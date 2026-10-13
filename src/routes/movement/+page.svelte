<script lang="ts">
	import MovementCarousel from '$lib/components/MovementCarousel.svelte';
</script>

<svelte:head>
	<title>Movement · G2</title>
</svelte:head>

<div class="movement-page">
	<MovementCarousel />
</div>

<style>
	.movement-page {
		width: 100%;
		height: 100%;
		padding: 16px 16px var(--dock-clearance);
		box-sizing: border-box;
	}
</style>
