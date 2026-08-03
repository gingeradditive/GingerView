<script lang="ts">
	import { goto } from '$app/navigation';
	import { mdiAlertCircleOutline } from '@mdi/js';
	import { portal } from '$lib/actions/portal';
	import { getMoonrakerApiUrl } from '$lib/services/config';

	type WizardStep = {
		title: string;
		checklist: string[];
	};

	const steps: WizardStep[] = [
		{
			title: 'Material check',
			checklist: [
				"Check material, material type, dryness and that there's enough quantity for this print",
				'Check that the tubes are empty'
			]
		},
		{
			title: 'Nozzle & bed check',
			checklist: ['Check that the nozzle is clean', 'Check that the bed is clear']
		},
		{
			title: 'Bed preparation',
			checklist: ['Apply the protective glass spray']
		},
		{
			title: 'Ventilation & material feed',
			checklist: [
				'Check that the fume extractor is on and connected',
				"Check that the dryer's material valve is open"
			]
		}
	];

	let {
		isOpen,
		filepath,
		onCancel,
		onStarted
	}: {
		isOpen: boolean;
		filepath: string;
		onCancel: () => void;
		onStarted: () => void;
	} = $props();

	let stepIndex = $state(0);
	let starting = $state(false);

	$effect(() => {
		if (isOpen) stepIndex = 0;
	});

	const isLastStep = $derived(stepIndex === steps.length - 1);

	const cancel = (): void => {
		if (starting) return;
		onCancel();
	};

	const proceed = async (): Promise<void> => {
		if (starting) return;

		if (!isLastStep) {
			stepIndex += 1;
			return;
		}

		starting = true;
		try {
			await fetch(
				`${getMoonrakerApiUrl()}/printer/print/start?filename=${encodeURIComponent(filepath)}`,
				{
					method: 'POST'
				}
			);
			// Close the wizard/details popup before navigating away, so we're not
			// invoking callbacks on components SvelteKit is already tearing down.
			onStarted();
			await goto('/');
		} catch (error) {
			console.error('Print start failed', error);
		} finally {
			starting = false;
		}
	};
</script>

{#if isOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events,a11y_no_noninteractive_element_interactions -->
	<div
		class="modal-overlay"
		role="dialog"
		aria-modal="true"
		aria-label={`Print start checklist — step ${stepIndex + 1} of ${steps.length}`}
		tabindex="-1"
		use:portal
		onclick={cancel}
		onkeydown={(e) => e.key === 'Escape' && cancel()}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events,a11y_no_noninteractive_element_interactions -->
		<div class="modal-content" role="document" onclick={(e) => e.stopPropagation()}>
			<div class="progress-bar" aria-hidden="true">
				{#each steps as _, index (index)}
					<div class="progress-segment" class:filled={index <= stepIndex}></div>
				{/each}
			</div>
			<div class="step-body">
				<svg class="warning-icon" viewBox="0 0 24 24" width="40" height="40" aria-hidden="true">
					<path d={mdiAlertCircleOutline} fill="#D72E28" />
				</svg>
				<h3>{steps[stepIndex].title}</h3>
				<ul class="checklist">
					{#each steps[stepIndex].checklist as item (item)}
						<li>{item}</li>
					{/each}
				</ul>
			</div>
			<div class="modal-actions">
				<button class="modal-cancel" disabled={starting} onclick={cancel}>Cancel</button>
				<button class="modal-confirm" disabled={starting} onclick={proceed}>
					{starting ? 'Starting...' : isLastStep ? 'Start print' : 'Proceed'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: linear-gradient(135deg, rgba(100, 100, 100, 0.3), rgba(100, 100, 100, 0.22));
		backdrop-filter: blur(12px) saturate(130%);
		-webkit-backdrop-filter: blur(12px) saturate(130%);
		z-index: 3500;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.modal-content {
		background: #fff;
		border-radius: 16px;
		padding: 24px;
		/* Fixed per-viewport size across every step, so Cancel/Proceed never move —
		   lets an experienced user click through the wizard without re-aiming. */
		width: min(380px, calc(100vw - 48px));
		height: min(460px, calc(100vh - 48px));
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		box-shadow: 0px 4px 3px 0px #00000040;
	}

	.progress-bar {
		display: flex;
		gap: 6px;
		width: 100%;
		flex-shrink: 0;
		margin-bottom: 20px;
	}

	.progress-segment {
		flex: 1;
		height: 6px;
		border-radius: 3px;
		background: #ececec;
		transition: background-color 0.2s ease;
	}

	.progress-segment.filled {
		background: #d72e28;
	}

	.step-body {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}

	.warning-icon {
		flex-shrink: 0;
		margin-bottom: 8px;
	}

	.modal-content h3 {
		margin: 0 0 16px 0;
		font-size: 1.1rem;
		font-weight: 700;
		color: #111;
		text-align: center;
	}

	.checklist {
		margin: 0 0 20px 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 10px;
		width: 100%;
	}

	.checklist li {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 0.95rem;
		color: #333;
		background: #f5f5f5;
		border-radius: 8px;
		padding: 10px 14px;
	}

	.checklist li::before {
		content: '';
		flex-shrink: 0;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #d72e28;
	}

	.modal-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
		width: 100%;
		flex-shrink: 0;
	}

	.modal-cancel {
		padding: 8px 20px;
		border: 1px solid #c8c8c8;
		border-radius: 8px;
		background: #fff;
		cursor: pointer;
		font-size: 0.9rem;
		color: #666;
	}

	.modal-cancel:hover {
		background-color: #f5f5f5;
	}

	.modal-cancel:disabled,
	.modal-confirm:disabled {
		cursor: default;
		opacity: 0.55;
		pointer-events: none;
	}

	.modal-confirm {
		padding: 8px 20px;
		border: none;
		border-radius: 8px;
		background: #d72e28;
		color: white;
		cursor: pointer;
		font-size: 0.9rem;
		transition: background-color 0.15s;
	}

	.modal-confirm:hover {
		background: #b82520;
	}
</style>
