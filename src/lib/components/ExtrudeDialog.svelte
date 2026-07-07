<script lang="ts">
	type Amount = 'low' | 'mid' | 'high';
	type Speed = 'slow' | 'standard' | 'boost';

	let amount = $state<Amount>('mid');
	let speed = $state<Speed>('standard');

	const amountOptions: { value: Amount; label: string }[] = [
		{ value: 'low', label: 'Low' },
		{ value: 'mid', label: 'Mid' },
		{ value: 'high', label: 'High' }
	];

	const speedOptions: { value: Speed; label: string }[] = [
		{ value: 'slow', label: 'Slow' },
		{ value: 'standard', label: 'Standard' },
		{ value: 'boost', label: 'Boost' }
	];

	const selectAmount = (value: Amount): void => {
		amount = value;
	};

	const selectSpeed = (value: Speed): void => {
		speed = value;
	};

	const handleExtrude = (): void => {
		console.log('Extrude', { amount, speed });
	};
</script>

<div class="extrude-dialog-card">
	<div class="viz-card">
		<svg viewBox="0 0 200 358" class="extruder-svg" role="presentation" aria-hidden="true">
			<path
				class="funnel"
				d="M70,10 L130,10 L130,46 L150,46 L150,86 L100,128 L50,86 L50,46 L70,46 Z"
				fill="#d9d9d9"
				stroke="#9a9a9a"
				stroke-width="6"
				stroke-linejoin="round"
			/>
			<line
				class="stem"
				x1="100"
				y1="128"
				x2="100"
				y2="302"
				stroke="#d72e28"
				stroke-width="8"
				stroke-linecap="round"
			/>
			<rect
				class="drip drip-top"
				x="79"
				y="299"
				width="42"
				height="10"
				rx="4"
				fill="#d72e28"
				stroke="#ffffff"
				stroke-width="1"
			/>
			<rect
				class="drip drip-mid"
				x="68.5"
				y="309"
				width="63"
				height="12"
				rx="5"
				fill="#d72e28"
				stroke="#ffffff"
				stroke-width="1"
			/>
			<rect
				class="drip drip-base"
				x="58"
				y="321"
				width="84"
				height="14"
				rx="6"
				fill="#d72e28"
				stroke="#ffffff"
				stroke-width="1"
			/>
		</svg>
	</div>

	<div class="settings-card">
		<div class="option-section">
			<span class="option-label">AMOUNT</span>
			<div class="option-row">
				{#each amountOptions as option (option.value)}
					<button
						class="option-btn"
						class:selected={amount === option.value}
						onclick={() => selectAmount(option.value)}
					>
						{option.label}
					</button>
				{/each}
			</div>
		</div>

		<div class="divider"></div>

		<div class="option-section">
			<span class="option-label">SPEED</span>
			<div class="option-row">
				{#each speedOptions as option (option.value)}
					<button
						class="option-btn"
						class:selected={speed === option.value}
						onclick={() => selectSpeed(option.value)}
					>
						{option.label}
					</button>
				{/each}
			</div>
		</div>

		<button class="extrude-btn" onclick={handleExtrude}>EXTRUDE</button>
	</div>
</div>

<style>
	.extrude-dialog-card {
		width: 100%;
		height: 100%;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.viz-card {
		background: #ffffff;
		border-radius: 16px;
		box-shadow: 0px 4px 3px 0px #00000040;
		box-sizing: border-box;
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
	}

	.extruder-svg {
		width: 40%;
		height: 95%;
		display: block;
	}

	.settings-card {
		background: #ffffff;
		border-radius: 16px;
		box-shadow: 0px 4px 3px 0px #00000040;
		box-sizing: border-box;
		flex-shrink: 0;
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.option-section {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.option-label {
		font-size: 0.85rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		color: #111111;
	}

	.option-row {
		display: flex;
		gap: 12px;
	}

	.option-btn {
		flex: 1;
		background: #ffffff;
		border: 1px solid #e0e0e0;
		border-radius: 10px;
		box-sizing: border-box;
		padding: 12px 8px;
		font-size: 0.95rem;
		font-weight: 600;
		color: #4a4a4a;
		cursor: pointer;
	}

	.option-btn:hover {
		background: #f5f5f5;
	}

	.option-btn.selected {
		border: 2px solid #d72e28;
		color: #d72e28;
		padding: 11px 7px;
	}

	.divider {
		height: 1px;
		background: #ececec;
	}

	.extrude-btn {
		background: #d72e28;
		border: none;
		border-radius: 16px;
		box-sizing: border-box;
		padding: 18px;
		color: #ffffff;
		font-size: 1.2rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		cursor: pointer;
	}

	.extrude-btn:hover {
		background: #b82520;
	}
</style>
