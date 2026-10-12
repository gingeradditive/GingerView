<script lang="ts">
	import { onMount } from 'svelte';
	import { mdiArrowDown, mdiArrowLeft, mdiArrowRight, mdiArrowUp, mdiClose } from '@mdi/js';
	import { portal } from '$lib/actions/portal';
	import EmergencyStopButton from '$lib/components/EmergencyStopButton.svelte';
	import HomingWarningModal from '$lib/components/HomingWarningModal.svelte';
	import { subscribeWhileVisible } from '$lib/services/panel-subscription.svelte';
	import {
		homingBusy,
		jogStepMm,
		jogStepOptions,
		moveRequestsInFlight,
		moveToolhead,
		startHoming,
		type Axis,
		type AxisPosition
	} from '$lib/stores/movementStore';

	/**
	 * Moves the toolhead, opened by the Move button of `ToolheadPosition`.
	 *
	 * Two ways to get somewhere, for a machine of about a metre per side: jog
	 * buttons with a step from 1 mm to 50 cm for "over there, roughly", and
	 * coordinate fields for "exactly here". Both send absolute moves through
	 * `moveToolhead()`, which orders Z and XY so the nozzle does not cross the bed
	 * low.
	 *
	 * Mounted only while open, so its subscription lives only while it is shown.
	 */
	let { onClose }: { onClose: () => void } = $props();

	const axes: Axis[] = ['x', 'y', 'z'];

	type MoveStatus = {
		toolhead?: {
			position?: number[];
			homed_axes?: string;
			axis_minimum?: number[];
			axis_maximum?: number[];
		};
		gcode_move?: { gcode_position?: number[] };
		print_stats?: { state?: string };
	};

	// Live position, for the readout and the "Moving..." chip.
	let actual = $state<AxisPosition | null>(null);
	// Where the machine is going: the G-code position, or past it while jog
	// commands are still on their way. Repeated taps add up from here, without
	// waiting for the previous move to end.
	let commanded = $state<AxisPosition | null>(null);
	// The last G-code position the machine reported, to fall back on when a
	// move is refused: the machine stayed where it was.
	let reported: AxisPosition | null = null;
	let minimum = $state<AxisPosition>({ x: 0, y: 0, z: 0 });
	let maximum = $state<AxisPosition>({ x: 1000, y: 1000, z: 1000 });
	let limitsKnown = $state(false);
	let homedAxes = $state('');
	let printState = $state('');

	// The coordinate fields. Filled with the position once it is known, and
	// left alone afterwards: the user may be typing.
	let fields = $state<Record<Axis, number | null>>({ x: null, y: null, z: null });
	let fieldsSeeded = false;

	let showHomingWarning = $state(false);

	const toPosition = (values: number[] | undefined): AxisPosition | null =>
		Array.isArray(values) && values.length > 2
			? { x: Number(values[0]) || 0, y: Number(values[1]) || 0, z: Number(values[2]) || 0 }
			: null;

	const round = (value: number): number => Math.round(value * 10) / 10;

	const updateStatus = (status: MoveStatus): void => {
		const toolhead = status.toolhead;
		if (toolhead) {
			const min = toPosition(toolhead.axis_minimum);
			const max = toPosition(toolhead.axis_maximum);
			if (min && max) {
				minimum = min;
				maximum = max;
				limitsKnown = true;
			}
			if (typeof toolhead.homed_axes === 'string') homedAxes = toolhead.homed_axes;
			actual = toPosition(toolhead.position) ?? actual;
		}

		const gcodePosition = toPosition(status.gcode_move?.gcode_position);
		// While commands are in flight `commanded` is ahead of what the machine
		// reports; once they are answered the machine is the truth again (another
		// client, a homing or a refused move may have changed it).
		if (gcodePosition) reported = gcodePosition;
		if (gcodePosition && $moveRequestsInFlight === 0) commanded = gcodePosition;
		if (gcodePosition && !fieldsSeeded) {
			fields = { x: round(gcodePosition.x), y: round(gcodePosition.y), z: round(gcodePosition.z) };
			fieldsSeeded = true;
		}

		if (typeof status.print_stats?.state === 'string') printState = status.print_stats.state;
	};

	subscribeWhileVisible<MoveStatus>(
		'move-panel',
		() =>
			'toolhead=position,homed_axes,axis_minimum,axis_maximum&gcode_move=gcode_position&print_stats=state',
		updateStatus
	);

	const homed = $derived(axes.every((axis) => homedAxes.includes(axis)));
	const printing = $derived(printState === 'printing' || printState === 'paused');
	const canMove = $derived(homed && !printing && limitsKnown && commanded !== null);

	const moving = $derived(
		$moveRequestsInFlight > 0 ||
			(actual !== null &&
				commanded !== null &&
				axes.some((axis) => Math.abs(actual![axis] - commanded![axis]) > 0.05))
	);

	const clampAxis = (axis: Axis, value: number): number =>
		Math.min(maximum[axis], Math.max(minimum[axis], value));

	// A jog button is pointless at the end of its axis: it would send nothing.
	const canJog = (axis: Axis, direction: 1 | -1): boolean => {
		if (!canMove || !commanded) return false;
		return direction > 0
			? commanded[axis] < maximum[axis] - 0.001
			: commanded[axis] > minimum[axis] + 0.001;
	};

	const jog = async (axis: Axis, direction: 1 | -1): Promise<void> => {
		if (!canJog(axis, direction) || !commanded) return;
		const from = { ...commanded };
		const to = { ...from, [axis]: clampAxis(axis, from[axis] + direction * $jogStepMm) };
		commanded = to;
		const accepted = await moveToolhead(from, to);
		// A refused move did not happen: go back to counting from the machine.
		if (!accepted) commanded = reported;
	};

	const fieldError = (axis: Axis): string | null => {
		const value = fields[axis];
		if (value === null || !Number.isFinite(value)) return 'Enter a value';
		if (value < minimum[axis] || value > maximum[axis]) {
			return `Between ${minimum[axis]} and ${maximum[axis]} mm`;
		}
		return null;
	};

	const fieldsValid = $derived(axes.every((axis) => fieldError(axis) === null));

	const goTo = async (): Promise<void> => {
		if (!canMove || !fieldsValid || !commanded) return;
		const from = { ...commanded };
		const to = { x: fields.x!, y: fields.y!, z: fields.z! };
		commanded = to;
		const accepted = await moveToolhead(from, to);
		if (!accepted) commanded = reported;
	};

	const fillCenter = (): void => {
		fields = { ...fields, x: round(maximum.x / 2), y: round(maximum.y / 2) };
	};

	const fillCurrent = (): void => {
		const source = commanded ?? actual;
		if (!source) return;
		fields = { x: round(source.x), y: round(source.y), z: round(source.z) };
	};

	const confirmHoming = (): void => {
		showHomingWarning = false;
		startHoming();
	};

	// Arrow keys jog X/Y and PageUp/PageDown jog Z, for whoever drives the panel
	// from a desktop. Not while typing a coordinate, and not under the homing
	// confirmation.
	const keyJogs: Record<string, [Axis, 1 | -1]> = {
		ArrowUp: ['y', 1],
		ArrowDown: ['y', -1],
		ArrowLeft: ['x', -1],
		ArrowRight: ['x', 1],
		PageUp: ['z', 1],
		PageDown: ['z', -1]
	};

	const handleKeydown = (event: KeyboardEvent): void => {
		if (showHomingWarning) return;
		if (event.key === 'Escape') {
			onClose();
			return;
		}
		if (event.target instanceof HTMLInputElement) return;
		const keyJog = keyJogs[event.key];
		if (!keyJog) return;
		event.preventDefault();
		jog(...keyJog);
	};

	onMount(() => {
		// Without this the page under the overlay would still scroll on PageUp/Down.
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = previousOverflow;
		};
	});

	const axisLabel = (axis: Axis): string => axis.toUpperCase();
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events,a11y_no_noninteractive_element_interactions -->
<div
	class="move-overlay"
	role="dialog"
	aria-modal="true"
	aria-label="Move toolhead"
	tabindex="-1"
	use:portal
	onclick={onClose}
>
	<!-- svelte-ignore a11y_click_events_have_key_events,a11y_no_noninteractive_element_interactions -->
	<div class="move-panel" role="document" onclick={(e) => e.stopPropagation()}>
		<header class="move-header">
			<h2>Move</h2>
			<div class="readout" aria-live="polite">
				{#each axes as axis (axis)}
					<span class="readout-item">
						<span class="axis-name axis-{axis}">{axisLabel(axis)}</span>
						<span class="readout-value">{actual ? actual[axis].toFixed(1) : '—'}</span>
					</span>
				{/each}
				<span class="readout-unit">mm</span>
			</div>
			{#if moving}
				<span class="moving-chip">Moving...</span>
			{/if}
			<div class="header-actions">
				<EmergencyStopButton />
				<button class="close-btn" aria-label="Close" onclick={onClose}>
					<svg viewBox="0 0 24 24" aria-hidden="true"><path d={mdiClose} /></svg>
				</button>
			</div>
		</header>

		{#if printing}
			<div class="banner">Not available while printing.</div>
		{:else if limitsKnown && !homed}
			<div class="banner">
				<span>Home the printer to move it.</span>
				<button
					class="banner-btn"
					disabled={$homingBusy}
					onclick={() => (showHomingWarning = true)}
				>
					{$homingBusy ? 'Homing...' : 'Home'}
				</button>
			</div>
		{/if}

		<div class="move-body">
			<section class="move-section">
				<span class="section-label">JOG</span>
				<div class="step-row" role="radiogroup" aria-label="Jog step">
					{#each jogStepOptions as option (option.mm)}
						<button
							class="step-btn"
							class:selected={$jogStepMm === option.mm}
							role="radio"
							aria-checked={$jogStepMm === option.mm}
							onclick={() => jogStepMm.set(option.mm)}
						>
							{option.label}
						</button>
					{/each}
				</div>

				<div class="jog-area">
					<div class="xy-pad">
						<button
							class="jog-btn pad-up"
							aria-label="Y plus"
							disabled={!canJog('y', 1)}
							onclick={() => jog('y', 1)}
						>
							<svg viewBox="0 0 24 24" aria-hidden="true"><path d={mdiArrowUp} /></svg>
							<span class="axis-y">Y+</span>
						</button>
						<button
							class="jog-btn pad-left"
							aria-label="X minus"
							disabled={!canJog('x', -1)}
							onclick={() => jog('x', -1)}
						>
							<svg viewBox="0 0 24 24" aria-hidden="true"><path d={mdiArrowLeft} /></svg>
							<span class="axis-x">X−</span>
						</button>
						<div class="pad-center" aria-hidden="true">
							{jogStepOptions.find((option) => option.mm === $jogStepMm)?.label}
						</div>
						<button
							class="jog-btn pad-right"
							aria-label="X plus"
							disabled={!canJog('x', 1)}
							onclick={() => jog('x', 1)}
						>
							<svg viewBox="0 0 24 24" aria-hidden="true"><path d={mdiArrowRight} /></svg>
							<span class="axis-x">X+</span>
						</button>
						<button
							class="jog-btn pad-down"
							aria-label="Y minus"
							disabled={!canJog('y', -1)}
							onclick={() => jog('y', -1)}
						>
							<svg viewBox="0 0 24 24" aria-hidden="true"><path d={mdiArrowDown} /></svg>
							<span class="axis-y">Y−</span>
						</button>
					</div>

					<div class="z-column">
						<button
							class="jog-btn"
							aria-label="Z plus"
							disabled={!canJog('z', 1)}
							onclick={() => jog('z', 1)}
						>
							<svg viewBox="0 0 24 24" aria-hidden="true"><path d={mdiArrowUp} /></svg>
							<span class="axis-z">Z+</span>
						</button>
						<button
							class="jog-btn"
							aria-label="Z minus"
							disabled={!canJog('z', -1)}
							onclick={() => jog('z', -1)}
						>
							<svg viewBox="0 0 24 24" aria-hidden="true"><path d={mdiArrowDown} /></svg>
							<span class="axis-z">Z−</span>
						</button>
					</div>
				</div>
			</section>

			<div class="body-divider"></div>

			<section class="move-section">
				<span class="section-label">GO TO</span>
				<div class="field-list">
					{#each axes as axis (axis)}
						{@const error = limitsKnown ? fieldError(axis) : null}
						<label class="coord-field" class:invalid={error !== null}>
							<span class="axis-name axis-{axis}">{axisLabel(axis)}</span>
							<input
								type="number"
								inputmode="decimal"
								step="0.1"
								min={minimum[axis]}
								max={maximum[axis]}
								bind:value={fields[axis]}
								disabled={!canMove}
								onkeydown={(e) => e.key === 'Enter' && goTo()}
							/>
							<span class="field-unit">mm</span>
							<span class="field-hint">
								{error ?? `${minimum[axis]} – ${maximum[axis]} mm`}
							</span>
						</label>
					{/each}
				</div>
				<div class="fill-row">
					<button class="fill-btn" disabled={!canMove} onclick={fillCenter}>Center XY</button>
					<button class="fill-btn" disabled={!canMove} onclick={fillCurrent}>Current</button>
				</div>
				<button class="goto-btn" disabled={!canMove || !fieldsValid} onclick={goTo}> GO TO </button>
			</section>
		</div>
	</div>
</div>

<HomingWarningModal
	isOpen={showHomingWarning}
	onConfirm={confirmHoming}
	onCancel={() => (showHomingWarning = false)}
/>

<style>
	.move-overlay {
		position: fixed;
		inset: 0;
		background: linear-gradient(
			135deg,
			rgba(var(--rgb-gray-mid), 0.3),
			rgba(var(--rgb-gray-mid), 0.22)
		);
		backdrop-filter: blur(12px) saturate(130%);
		-webkit-backdrop-filter: blur(12px) saturate(130%);
		z-index: 2000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
		box-sizing: border-box;
	}

	.move-panel {
		width: min(960px, 100%);
		max-height: 100%;
		overflow-y: auto;
		box-sizing: border-box;
		background: var(--color-white);
		border-radius: 16px;
		box-shadow: var(--shadow-panel);
		padding: 20px 24px 24px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.move-header {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px 20px;
	}

	.move-header h2 {
		margin: 0;
		font-size: 1.3rem;
		font-weight: 700;
		color: var(--color-black);
	}

	.readout {
		display: flex;
		align-items: baseline;
		gap: 16px;
		font-variant-numeric: tabular-nums;
	}

	.readout-item {
		display: inline-flex;
		align-items: baseline;
		gap: 6px;
	}

	.readout-value {
		font-size: 1.3rem;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.readout-unit {
		font-size: 0.9rem;
		color: var(--color-text-subtle);
	}

	.axis-name {
		font-weight: 700;
		font-size: 1.2rem;
	}

	.axis-x {
		color: var(--color-red);
	}

	.axis-y {
		color: var(--color-success-vivid);
	}

	.axis-z {
		color: var(--color-info);
	}

	.moving-chip {
		padding: 4px 12px;
		border-radius: 999px;
		background: var(--color-info-bg);
		color: var(--color-info);
		font-size: 0.85rem;
		font-weight: 600;
	}

	.header-actions {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 12px;
		/* EmergencyStopButton is sized for the dock; here it sits next to ✕. */
		--dock-btn: 48px;
		--dock-sep: 0px;
	}

	.close-btn {
		width: 48px;
		height: 48px;
		border: 1px solid var(--color-border-light);
		border-radius: 12px;
		background: var(--color-white);
		color: var(--color-text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
	}

	.close-btn:hover {
		background: var(--color-background);
	}

	.close-btn svg {
		width: 26px;
		height: 26px;
		fill: currentColor;
	}

	.banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 16px;
		border-radius: 12px;
		border: 1px solid var(--color-warning-border);
		background: var(--color-warning-bg);
		color: var(--color-warning);
		font-weight: 600;
	}

	.banner-btn {
		min-height: 44px;
		padding: 0 20px;
		border: none;
		border-radius: 10px;
		background: var(--color-red);
		color: var(--color-white);
		font-weight: 700;
		cursor: pointer;
	}

	.banner-btn:disabled {
		opacity: 0.6;
		cursor: default;
	}

	.move-body {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.body-divider {
		height: 1px;
		background: var(--color-surface-sunken);
	}

	.move-section {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.section-label {
		font-size: 0.85rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--color-text-soft);
	}

	.step-row,
	.fill-row {
		display: flex;
		gap: 8px;
	}

	.step-btn,
	.fill-btn {
		flex: 1;
		min-height: 44px;
		background: var(--color-white);
		border: 1px solid var(--color-border-light);
		border-radius: 10px;
		box-sizing: border-box;
		padding: 8px;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.step-btn.selected {
		border: 2px solid var(--color-red);
		color: var(--color-red);
		padding: 7px;
	}

	.step-btn:hover:not(.selected),
	.fill-btn:hover:not(:disabled) {
		background: var(--color-background);
	}

	.jog-area {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: clamp(16px, 5%, 40px);
	}

	.xy-pad,
	.z-column {
		/* Pad and Z column side by side fit a 360px phone. */
		--jog-size: clamp(52px, 17vw, 76px);
	}

	.xy-pad {
		display: grid;
		grid-template-columns: repeat(3, var(--jog-size));
		grid-template-rows: repeat(3, var(--jog-size));
		grid-template-areas:
			'. up .'
			'left center right'
			'. down .';
		gap: 8px;
	}

	.pad-up {
		grid-area: up;
	}

	.pad-left {
		grid-area: left;
	}

	.pad-right {
		grid-area: right;
	}

	.pad-down {
		grid-area: down;
	}

	.pad-center {
		grid-area: center;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: var(--color-background);
		color: var(--color-text-soft);
		font-size: 0.85rem;
		font-weight: 700;
	}

	.z-column {
		display: flex;
		flex-direction: column;
		gap: calc(var(--jog-size) + 16px);
	}

	.jog-btn {
		width: var(--jog-size);
		height: var(--jog-size);
		padding: 0;
		background: var(--color-white);
		border: 1px solid var(--color-border-light);
		border-radius: 14px;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		color: var(--color-text-muted);
		cursor: pointer;
		touch-action: manipulation;
	}

	.jog-btn svg {
		width: 30px;
		height: 30px;
		fill: currentColor;
	}

	.jog-btn span {
		font-size: 0.9rem;
		font-weight: 700;
	}

	.jog-btn:hover:not(:disabled) {
		background: var(--color-background);
	}

	.jog-btn:active:not(:disabled) {
		background: var(--color-surface-sunken);
	}

	.jog-btn:disabled,
	.fill-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.field-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.coord-field {
		display: grid;
		grid-template-columns: 28px 1fr auto;
		grid-template-areas:
			'axis input unit'
			'. hint hint';
		align-items: center;
		column-gap: 10px;
		row-gap: 2px;
	}

	.coord-field .axis-name {
		grid-area: axis;
	}

	.coord-field input {
		grid-area: input;
		min-width: 0;
		min-height: 48px;
		box-sizing: border-box;
		padding: 8px 12px;
		border: 1px solid var(--color-gray);
		border-radius: 10px;
		font-size: 1.2rem;
		font-variant-numeric: tabular-nums;
		color: var(--color-black);
		background: var(--color-white);
	}

	.coord-field input:focus {
		outline: none;
		border-color: var(--color-red);
	}

	.coord-field input:disabled {
		background: var(--color-background);
		color: var(--color-text-disabled);
	}

	.field-unit {
		grid-area: unit;
		color: var(--color-text-subtle);
	}

	.field-hint {
		grid-area: hint;
		font-size: 0.8rem;
		color: var(--color-text-subtle);
	}

	.coord-field.invalid input {
		border-color: var(--color-red);
	}

	.coord-field.invalid .field-hint {
		color: var(--color-red);
	}

	.goto-btn {
		margin-top: auto;
		background: var(--color-red);
		border: none;
		border-radius: 16px;
		box-sizing: border-box;
		padding: 18px;
		color: var(--color-white);
		font-size: 1.2rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		cursor: pointer;
	}

	.goto-btn:hover:not(:disabled) {
		background: var(--color-red-dark);
	}

	.goto-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	@media (min-width: 768px) {
		.move-body {
			flex-direction: row;
			align-items: stretch;
			gap: 32px;
		}

		.body-divider {
			width: 1px;
			height: auto;
		}

		.xy-pad,
		.z-column {
			--jog-size: 84px;
		}
	}

	@media (max-width: 767.98px) {
		.move-overlay {
			padding: 12px;
		}

		.move-panel {
			padding: 16px;
		}

		.readout {
			order: 3;
			width: 100%;
			justify-content: space-between;
		}
	}
</style>
