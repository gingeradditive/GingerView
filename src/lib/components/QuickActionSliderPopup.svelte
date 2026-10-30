<script lang="ts">
	import Sheet from '$lib/components/ui/Sheet.svelte';
	let {
		isOpen,
		title,
		ariaLabel,
		value,
		onClose,
		onChange,
		leftIconPath,
		rightIconPath,
		leftIconSize = 18,
		rightIconSize = 30
	}: {
		isOpen: boolean;
		title: string;
		ariaLabel: string;
		value: number;
		onClose: () => void;
		onChange: (value: number) => void;
		leftIconPath: string;
		rightIconPath: string;
		leftIconSize?: number;
		rightIconSize?: number;
	} = $props();

	// Mentre il dito scorre si aggiorna solo il numero a schermo; il comando parte
	// al rilascio (`change`). Prima partiva un G-code per ogni pixel di trascinamento.
	let draft = $state<number | null>(null);
	const shown = $derived(Math.round(draft ?? value));

	const commit = (next: number): void => {
		draft = null;
		onChange(next);
	};

	// Scorciatoie esplicite: prima 0% e 100% si ottenevano toccando le icone ai lati dello
	// slider, e nessuno lo indovinava.
	const presets = [0, 25, 50, 75, 100];
</script>

{#if isOpen}
	<Sheet label={ariaLabel} {onClose} showClose size="sm">
		{#snippet header()}
			<h3 class="sheet-title">{title}</h3>
		{/snippet}

		<div class="percent" aria-hidden="true">{shown}<span>%</span></div>

		<div class="slider-row">
			<svg viewBox="0 0 24 24" width={leftIconSize} height={leftIconSize} aria-hidden="true">
				<path d={leftIconPath} />
			</svg>
			<input
				type="range"
				min="0"
				max="100"
				step="1"
				aria-label={ariaLabel}
				value={shown}
				style:--fill="{shown}%"
				oninput={(e) => (draft = Number((e.currentTarget as HTMLInputElement).value))}
				onchange={(e) => commit(Number((e.currentTarget as HTMLInputElement).value))}
			/>
			<svg viewBox="0 0 24 24" width={rightIconSize} height={rightIconSize} aria-hidden="true">
				<path d={rightIconPath} />
			</svg>
		</div>

		<div class="presets" role="group" aria-label="Quick picks">
			{#each presets as preset (preset)}
				<button
					type="button"
					class="preset"
					class:active={shown === preset}
					onclick={() => commit(preset)}
				>
					{preset === 0 ? 'Off' : `${preset}%`}
				</button>
			{/each}
		</div>
	</Sheet>
{/if}

<style>
	.percent {
		text-align: center;
		font-size: 3rem;
		font-weight: 800;
		line-height: 1;
		color: var(--color-black);
		font-variant-numeric: tabular-nums;
	}

	.percent span {
		font-size: 1.4rem;
		font-weight: 700;
		color: var(--color-text-subtle);
	}

	.slider-row {
		display: grid;
		grid-template-columns: 30px 1fr 30px;
		align-items: center;
		justify-items: center;
		gap: 12px;
		margin: 20px 0 18px;
	}

	.slider-row svg {
		fill: var(--color-red);
	}

	input[type='range'] {
		width: 100%;
		height: 10px;
		appearance: none;
		border-radius: 5px;
		background: linear-gradient(
			90deg,
			var(--color-red) var(--fill),
			var(--color-surface-sunken) var(--fill)
		);
		cursor: pointer;
	}

	input[type='range']::-webkit-slider-thumb {
		appearance: none;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: var(--color-white);
		box-shadow:
			0 0 0 3px var(--color-red),
			0 2px 6px rgba(var(--rgb-black), 0.2);
		cursor: pointer;
	}

	input[type='range']::-moz-range-thumb {
		width: 28px;
		height: 28px;
		border: none;
		border-radius: 50%;
		background: var(--color-white);
		box-shadow:
			0 0 0 3px var(--color-red),
			0 2px 6px rgba(var(--rgb-black), 0.2);
		cursor: pointer;
	}

	.presets {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 8px;
	}

	.preset {
		min-height: 44px;
		border: none;
		border-radius: 12px;
		background: var(--color-background);
		color: var(--color-text-muted);
		font-family: inherit;
		font-size: 0.9rem;
		cursor: pointer;
	}

	.preset:hover {
		background: var(--color-surface-sunken);
	}

	.preset.active {
		background: var(--color-danger-bg);
		color: var(--color-red);
		box-shadow: inset 0 0 0 2px var(--color-red);
	}
</style>
