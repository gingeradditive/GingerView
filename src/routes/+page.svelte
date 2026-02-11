<script lang="ts">
	import DemoComponent from '$lib/components/DemoComponent.svelte';
</script>

<div class="min-h-screen bg-gray-50">
	<main class="container mx-auto px-4 py-8">
		<div class="text-center mb-8">
			<h1 class="text-4xl font-bold text-gray-900 mb-4">Welcome to GingerView</h1>
			<p class="text-xl text-gray-600">A modern web application built with SvelteKit</p>
		</div>
		
		<div class="flex justify-center">
			<DemoComponent />
		</div>
	</main>
</div>
