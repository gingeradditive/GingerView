<script lang="ts">
	import { ChevronRight, SlidersVertical } from 'lucide-svelte';
	import ZOffsetSheet from '$lib/components/ZOffsetSheet.svelte';
	import { subscribeWhileVisible } from '$lib/services/panel-subscription.svelte';

	/**
	 * La card bassa sotto Z HEIGHT: lo z-offset attuale, e al tocco il popup per regolarlo.
	 * C'è sempre, in stampa e a macchina ferma (il popup sa come comportarsi nei due casi).
	 */
	let { visible = true }: { visible?: boolean } = $props();

	type ZOffsetStatus = {
		print_stats?: { state?: string };
		gcode_move?: { homing_origin?: number[] };
	};

	let zOffset = $state(0);
	let printing = $state(false);
	let sheetOpen = $state(false);

	const label = $derived.by(() => {
		const value = Math.abs(zOffset) < 0.005 ? 0 : zOffset;
		return `${value > 0 ? '+' : ''}${value.toFixed(2)} mm`;
	});

	subscribeWhileVisible<ZOffsetStatus>(
		'dashboard-z-offset',
		() => 'gcode_move=homing_origin&print_stats=state',
		(status) => {
			const state = status.print_stats?.state;
			if (state) printing = state === 'printing' || state === 'paused';
			const origin = status.gcode_move?.homing_origin;
			if (Array.isArray(origin) && origin.length > 2) zOffset = origin[2];
		},
		() => visible
	);
</script>

<button
	type="button"
	class="z-offset-card"
	aria-label="Z offset {label}. Adjust it"
	onclick={() => (sheetOpen = true)}
>
	<SlidersVertical class="icon" size={22} />
	<span class="text">
		<span class="title">Z OFFSET</span>
		<span class="value">{label}</span>
	</span>
	<ChevronRight class="chevron" size={20} />
</button>

<ZOffsetSheet isOpen={sheetOpen} offset={zOffset} {printing} onClose={() => (sheetOpen = false)} />

<style>
	.z-offset-card {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		height: 100%;
		padding: 0 14px 0 16px;
		border: none;
		border-radius: 19.2px;
		background: var(--color-white);
		box-shadow: var(--shadow-panel);
		box-sizing: border-box;
		font: inherit;
		color: var(--color-black);
		text-align: left;
		cursor: pointer;
		transition:
			background-color 0.15s,
			transform 0.1s;
		-webkit-tap-highlight-color: transparent;
		/* Il titolo si stringe se la colonna è stretta (cinque card su un portatile). */
		container-type: inline-size;
	}

	.z-offset-card:hover {
		background: var(--color-background);
	}

	.z-offset-card:active {
		transform: scale(0.98);
	}

	.z-offset-card:focus-visible {
		outline: 2px solid var(--color-red);
		outline-offset: -4px;
	}

	.z-offset-card :global(.icon) {
		flex-shrink: 0;
		color: var(--color-red);
	}

	.text {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}

	/* Titolo come quelli delle altre card, ma più piccolo: la card è bassa. */
	.title {
		min-width: 0;
		font-size: calc(var(--dashboard-title-size) * 0.62);
		font-weight: 700;
		letter-spacing: 0.02em;
		line-height: 1.1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.value {
		flex-shrink: 0;
		font-size: calc(var(--dashboard-subtitle-size) * 0.75);
		font-weight: 600;
		color: var(--color-text-soft);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.z-offset-card :global(.chevron) {
		flex-shrink: 0;
		color: var(--color-text-subtle);
	}

	/* Colonna stretta (cinque card su un portatile, iPad in verticale): titolo sopra e
	   valore sotto, invece di tagliare "Z OFFSET". */
	@container (max-width: 280px) {
		.text {
			flex-direction: column;
			align-items: flex-start;
			justify-content: center;
			gap: 1px;
		}

		.title {
			font-size: calc(var(--dashboard-title-size) * 0.56);
		}

		.value {
			font-size: calc(var(--dashboard-subtitle-size) * 0.7);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.z-offset-card {
			transition: none;
		}
	}
</style>
