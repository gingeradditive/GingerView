<script lang="ts">
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
</script>

{#if isOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events,a11y_no_noninteractive_element_interactions -->
	<div
		class="popup-overlay"
		role="dialog"
		aria-modal="true"
		aria-label={ariaLabel}
		tabindex="-1"
		onclick={onClose}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events,a11y_no_noninteractive_element_interactions -->
		<div class="popup-modal" role="document" onclick={(e) => e.stopPropagation()}>
			<h3>{title}</h3>
			<div class="popup-slider-row">
				<svg
					viewBox="0 0 24 24"
					width={leftIconSize}
					height={leftIconSize}
					class="popup-slider-icon clickable"
					role="button"
					tabindex="0"
					aria-label="Set to 0%"
					onclick={() => commit(0)}
					onkeydown={(e) => e.key === 'Enter' && commit(0)}
				>
					<path d={leftIconPath} fill="#d72e28" />
				</svg>
				<input
					type="range"
					min="0"
					max="100"
					step="1"
					aria-label={ariaLabel}
					value={shown}
					oninput={(e) => (draft = Number((e.currentTarget as HTMLInputElement).value))}
					onchange={(e) => commit(Number((e.currentTarget as HTMLInputElement).value))}
				/>
				<svg
					viewBox="0 0 24 24"
					width={rightIconSize}
					height={rightIconSize}
					class="popup-slider-icon clickable"
					role="button"
					tabindex="0"
					aria-label="Set to 100%"
					onclick={() => commit(100)}
					onkeydown={(e) => e.key === 'Enter' && commit(100)}
				>
					<path d={rightIconPath} fill="#d72e28" />
				</svg>
			</div>
			<div class="popup-percent">{shown}%</div>
		</div>
	</div>
{/if}

<style>
	.popup-overlay {
		position: fixed;
		inset: 0;
		background: linear-gradient(
			135deg,
			rgba(var(--rgb-gray-mid), 0.3),
			rgba(var(--rgb-gray-mid), 0.22)
		);
		backdrop-filter: blur(12px) saturate(130%);
		-webkit-backdrop-filter: blur(12px) saturate(130%);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 3000;
		padding: 24px;
	}

	.popup-modal {
		width: min(520px, 100%);
		background: var(--color-white);
		border-radius: 27px;
		box-shadow: var(--shadow-panel);
		padding: 28px 32px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.popup-modal h3 {
		margin: 0;
		text-align: center;
		font-size: 26px;
		font-weight: 700;
		color: var(--color-text-muted);
	}

	.popup-percent {
		text-align: center;
		font-size: 22px;
		font-weight: 600;
		color: var(--color-black-pure);
	}

	.popup-slider-row {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 14px;
	}

	.popup-slider-icon {
		display: block;
	}

	.popup-slider-row input[type='range'] {
		width: 100%;
		accent-color: var(--color-red);
	}

	.popup-slider-row input[type='range']::-webkit-slider-thumb {
		appearance: none;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--color-red);
		cursor: pointer;
	}

	.popup-slider-row input[type='range']::-moz-range-thumb {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--color-red);
		cursor: pointer;
		border: none;
	}
</style>
