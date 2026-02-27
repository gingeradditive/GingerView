<script lang="ts">
	import type { PrintItem } from '$lib/types/print';
	import { onMount } from 'svelte';
	import { activeContextMenuId } from '$lib/stores/contextMenuStore';

	let { item }: { item: PrintItem } = $props();

	let nameElement: HTMLSpanElement;
	let isOverflowing = $state(false);
	let showContextMenu = $state(false);
	let contextMenuX = $state(0);
	let contextMenuY = $state(0);

	// Subscribe to global context menu store
	let activeContextMenuIdValue = $state<number | null>(null);

	onMount(() => {
		if (nameElement) {
			isOverflowing = nameElement.scrollWidth > 250;
		}
		
		// Subscribe to store changes
		const unsubscribe = activeContextMenuId.subscribe((value) => {
			activeContextMenuIdValue = value;
		});
		
		return unsubscribe;
	});

	function handleContextMenu(event: MouseEvent) {
		event.preventDefault();
		
		contextMenuX = event.clientX;
		contextMenuY = event.clientY;
		showContextMenu = true;
		// Set this card as the active context menu globally
		activeContextMenuId.set(item.id);
	}

	function handleDelete() {
		console.log('Elimina stampa:', item.name);
		closeContextMenu();
		// Qui puoi aggiungere la logica per eliminare la stampa
	}

	function closeContextMenu() {
		showContextMenu = false;
		if (activeContextMenuIdValue === item.id) {
			activeContextMenuId.set(null);
		}
	}

	function handleClickOutside() {
		closeContextMenu();
	}

	// Close context menu if another one is opened
	$effect(() => {
		if (activeContextMenuIdValue !== null && activeContextMenuIdValue !== item.id) {
			showContextMenu = false;
		}
	});
</script>

<svelte:window onclick={handleClickOutside} />

<div class="print-card" role="button" tabindex="0" oncontextmenu={handleContextMenu}>
	<div class="card-inner">
		<div class="image-wrapper">
			<img
				src={item.imageUrl ?? 'https://placehold.co/250x250'}
				alt={item.name}
				width="250"
				height="250"
			/>
			<div class="gradient-top"></div>
			<div class="gradient-bottom"></div>
			<div class="material-label">{item.material}</div>
			<div class="duration-label">{item.duration}</div>
		</div>
	</div>
	<div class="name-label" class:marquee={isOverflowing}>
		<span class="name-text" bind:this={nameElement}>{item.name}</span>
	</div>
</div>

{#if showContextMenu}
	<div 
		class="context-menu" 
		role="menu"
		tabindex="0"
		style="left: {contextMenuX}px; top: {contextMenuY}px;"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.key === 'Escape' && handleClickOutside()}
	>
		<button class="context-menu-item" role="menuitem" onclick={handleDelete}>
			Elimina stampa
		</button>
	</div>
{/if}

<style>
	.print-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		width: 250px;
		cursor: pointer;
	}

	.card-inner {
		background: white;
		border-radius: 20px;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.10);
		width: 100%;
		box-sizing: border-box;
		transition: box-shadow 0.2s;
	}

	.card-inner:hover {
		box-shadow: 0 6px 24px rgba(0, 0, 0, 0.16);
	}

	.image-wrapper {
		width: 250px;
		height: 250px;
		border-radius: 20px;
		overflow: hidden;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #f1f5f9;
	}

	.image-wrapper img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.gradient-top {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 60px;
		background: linear-gradient(to bottom, rgba(255, 255, 255, 0.95), transparent);
		pointer-events: none;
	}

	.gradient-bottom {
		position: absolute;
		bottom: 0;
		left: 0;
		width: 100%;
		height: 60px;
		background: linear-gradient(to top, rgba(255, 255, 255, 0.95), transparent);
		pointer-events: none;
	}

	.material-label {
		position: absolute;
		top: 12px;
		left: 12px;
		font-size: 1.1rem;
		font-weight: 700;
		color: black;
		background: transparent;
		padding: 0;
		border-radius: 0;
	}

	.duration-label {
		position: absolute;
		bottom: 12px;
		right: 12px;
		font-size: 1.05rem;
		font-weight: 600;
		color: black;
		background: transparent;
		padding: 0;
		border-radius: 0;
	}

	.name-label {
		font-size: 1.25rem;
		font-weight: 600;
		color: #1e293b;
		text-align: center;
		max-width: 250px;
		overflow: hidden;
		position: relative;
		white-space: nowrap;
	}

	.name-text {
		display: inline-block;
	}

	.marquee .name-text {
		animation: marquee 20s ease-in-out infinite;
	}

	@keyframes marquee {
		0% { transform: translateX(0); }
		83.33% { transform: translateX(calc(-100% + 250px)); }
		100% { transform: translateX(0); }
	}

	.context-menu {
		position: fixed;
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		z-index: 1000;
		min-width: 150px;
		padding: 4px 0;
	}

	.context-menu-item {
		width: 100%;
		padding: 8px 16px;
		background: none;
		border: none;
		text-align: left;
		cursor: pointer;
		font-size: 0.9rem;
		color: #1e293b;
		transition: background-color 0.2s;
	}

	.context-menu-item:hover {
		background-color: #f1f5f9;
	}
</style>
