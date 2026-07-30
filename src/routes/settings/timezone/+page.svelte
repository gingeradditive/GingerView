<script lang="ts">
	import { onMount } from 'svelte';
	import { LoaderCircle, TriangleAlert } from 'lucide-svelte';
	import TimezoneMap from '$lib/components/TimezoneMap.svelte';
	import TimezoneSelect from '$lib/components/TimezoneSelect.svelte';
	import {
		fetchTimezoneStatus,
		findZone,
		formatOffset,
		formatZoneDate,
		formatZoneTime,
		getCityLabel,
		getOffsetMinutes,
		setSystemTimezone
	} from '$lib/services/timezone';
	import { toastActions } from '$lib/stores/toastStore';

	/** L'orologio mostra ore e minuti: al secondo si accorge dello scatto di minuto. */
	const clockTickMs = 1000;

	/** Fuso attivo sull'host, cioè l'ultimo salvato con successo. */
	let appliedTimezone = $state('');
	/** Fuso scelto nella tendina, non ancora salvato. */
	let selectedTimezone = $state('');
	let ntpSynchronized = $state(true);
	let isLoading = $state(true);
	let isSaving = $state(false);
	let loadError = $state('');
	let now = $state(new Date());

	let selectedZone = $derived(selectedTimezone ? (findZone(selectedTimezone) ?? null) : null);
	let offsetMinutes = $derived(selectedTimezone ? getOffsetMinutes(selectedTimezone, now) : 0);
	let hasChanges = $derived(selectedTimezone !== '' && selectedTimezone !== appliedTimezone);
	let mapLabel = $derived(selectedZone ? getCityLabel(selectedZone.id) : selectedTimezone);

	onMount(() => {
		load();
		const timer = window.setInterval(() => (now = new Date()), clockTickMs);
		return () => window.clearInterval(timer);
	});

	async function load() {
		isLoading = true;
		loadError = '';
		try {
			const status = await fetchTimezoneStatus();
			appliedTimezone = status.timezone;
			selectedTimezone = status.timezone;
			ntpSynchronized = status.ntpSynchronized;
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Failed to read the current timezone';
		} finally {
			isLoading = false;
		}
	}

	async function handleSave() {
		if (!hasChanges || isSaving) return;
		isSaving = true;
		try {
			await setSystemTimezone(selectedTimezone);
			appliedTimezone = selectedTimezone;
			toastActions.success(
				'network',
				'Timezone saved',
				`Printer time is now ${getCityLabel(selectedTimezone)} (${formatOffset(getOffsetMinutes(selectedTimezone))})`
			);
		} catch {
			// Il toast di errore lo ha già emesso setSystemTimezone().
		} finally {
			isSaving = false;
		}
	}
</script>

<section class="timezone-page">
	<div class="timezone-card">
		<header class="timezone-header">
			<h1>Timezone</h1>
			{#if !isLoading && !loadError}
				<span class="offset-pill">{formatOffset(offsetMinutes)}</span>
			{/if}
		</header>

		{#if isLoading}
			<div class="state"><LoaderCircle class="spin" /> Reading the current timezone...</div>
		{:else if loadError}
			<div class="state error">
				<TriangleAlert />
				{loadError}
			</div>
		{:else}
			<TimezoneMap zone={selectedZone} {offsetMinutes} label={mapLabel} />

			<div class="clock">
				<span class="time">{formatZoneTime(selectedTimezone, now)}</span>
				<span class="clock-meta">
					<span class="date">{formatZoneDate(selectedTimezone, now)}</span>
					<span class="zone-id">{selectedTimezone}</span>
				</span>
			</div>

			{#if !ntpSynchronized}
				<p class="warning">
					<TriangleAlert />
					The clock is not synchronised over the network: times may be wrong regardless of the timezone.
				</p>
			{/if}

			<TimezoneSelect
				value={selectedTimezone}
				onSelect={(id) => (selectedTimezone = id)}
				disabled={isSaving}
			/>

			<p class="note">
				Only the printer timezone is changed: system language and formats are left untouched, and
				the clock itself keeps running on network time. Times shown in GingerView follow the device
				you are browsing from.
			</p>

			<!--
				Da togliere insieme al mock in `timezone.ts`: finché il salvataggio non
				raggiunge davvero l'host, dire "salvato" senza altro sarebbe una bugia.
			-->
			<p class="mock">
				Backend not available yet — the choice is kept in this browser and does not change the
				printer clock.
			</p>

			<div class="actions-row">
				<button
					type="button"
					class="save-btn"
					onclick={handleSave}
					disabled={!hasChanges || isSaving}
				>
					{#if isSaving}
						<LoaderCircle class="spin" />
					{/if}
					{isSaving ? 'Saving...' : 'Save timezone'}
				</button>
			</div>
		{/if}
	</div>
</section>

<style>
	/*
		`min-height` invece di `height`: la scheda riempie lo schermo quando c'è
		spazio — così il pulsante di salvataggio sta in fondo come nelle altre
		sottopagine — ma su uno schermo basso cresce e lascia scorrere la pagina
		invece di farsi tagliare.
	*/
	.timezone-page {
		min-height: 100%;
		padding: 24px 24px 112px;
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
	}
	.timezone-card {
		flex: 1;
		background: #ffffff;
		border-radius: 20px;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		box-sizing: border-box;
	}
	.timezone-header {
		display: flex;
		align-items: center;
		gap: 14px;
		flex-shrink: 0;
	}
	.timezone-header h1 {
		margin: 0;
		font-size: 2rem;
		font-weight: 700;
		color: #222222;
	}
	.offset-pill {
		margin-left: auto;
		border-radius: 999px;
		padding: 8px 16px;
		font-size: 0.95rem;
		font-weight: 600;
		background: #f5f5f5;
		color: #444444;
	}
	.state {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 40px 0;
		color: #6e6e6e;
		font-size: 0.95rem;
	}
	.state.error {
		color: #d72e28;
	}
	.clock {
		display: flex;
		align-items: baseline;
		gap: 16px;
		flex-wrap: wrap;
	}
	.time {
		font-size: 2.6rem;
		font-weight: 800;
		line-height: 1;
		color: #222222;
		font-variant-numeric: tabular-nums;
	}
	.clock-meta {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.date {
		font-size: 0.95rem;
		color: #444444;
	}
	.zone-id {
		font-size: 0.8rem;
		color: #8a8a8a;
		overflow-wrap: anywhere;
	}
	.warning,
	.note,
	.mock {
		margin: 0;
		font-size: 0.85rem;
	}
	.warning {
		display: flex;
		align-items: center;
		gap: 10px;
		color: #d72e28;
		font-weight: 600;
	}
	.note {
		color: #8a8a8a;
	}
	.mock {
		color: #6e6e6e;
		background: #f5f5f5;
		border-radius: 12px;
		padding: 10px 14px;
	}
	.actions-row {
		display: flex;
		justify-content: flex-end;
		flex-shrink: 0;
		margin-top: auto;
	}
	.save-btn {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		border: none;
		background: #d72e28;
		color: #ffffff;
		border-radius: 16px;
		padding: 12px 32px;
		font-size: 1rem;
		font-weight: 700;
	}
	.save-btn:disabled {
		opacity: 0.55;
	}
	:global(.spin) {
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
