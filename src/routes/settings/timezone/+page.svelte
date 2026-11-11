<script lang="ts">
	import SettingsSheet from '$lib/components/SettingsSheet.svelte';
	import { onMount } from 'svelte';
	import { LoaderCircle, TriangleAlert } from 'lucide-svelte';
	import TimezoneMap from '$lib/components/TimezoneMap.svelte';
	import TimezoneSelect from '$lib/components/TimezoneSelect.svelte';
	import {
		describeTimezoneError,
		fetchTimezoneStatus,
		findZone,
		formatOffset,
		formatZoneDate,
		formatZoneTime,
		getCityLabel,
		getOffsetMinutes,
		setSystemTimezone
	} from '$lib/services/timezone';
	import { setPrinterTimezone } from '$lib/stores/timezoneStore';
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
			setPrinterTimezone(status.timezone);
		} catch (e) {
			loadError = describeTimezoneError(e, 'Failed to read the current timezone.');
		} finally {
			isLoading = false;
		}
	}

	async function handleSave() {
		if (!hasChanges || isSaving) return;
		isSaving = true;
		try {
			// La POST risponde con lo stato aggiornato: si prende da lì, invece di
			// dare per scontato che l'host abbia applicato esattamente la richiesta.
			const status = await setSystemTimezone(selectedTimezone);
			appliedTimezone = status.timezone;
			selectedTimezone = status.timezone;
			ntpSynchronized = status.ntpSynchronized;
			// Gli orari già a schermo (ETA in primis) seguono questo fuso: si
			// aggiorna lo store subito, senza aspettare un ricaricamento.
			setPrinterTimezone(status.timezone);
			toastActions.success(
				'network',
				'Time zone saved!',
				`Printer time is now ${getCityLabel(selectedTimezone)} (${formatOffset(getOffsetMinutes(selectedTimezone))})`
			);
		} catch {
			// Il toast di errore lo ha già emesso setSystemTimezone().
		} finally {
			isSaving = false;
		}
	}
</script>

<svelte:head>
	<title>Timezone · G2</title>
</svelte:head>

<SettingsSheet title="Timezone" size="md">
	{#if isLoading}
		<div class="state"><LoaderCircle class="spin" /> Checking your time zone…</div>
	{:else if loadError}
		<div class="state error">
			<TriangleAlert />
			{loadError}
		</div>
	{:else}
		<!--
				La tendina sta sopra la mappa: il pannello dei risultati si apre verso il
				basso, sopra la mappa, invece di finire sotto il bordo del popup.
			-->
		<TimezoneSelect
			value={selectedTimezone}
			onSelect={(id) => (selectedTimezone = id)}
			disabled={isSaving}
		/>

		<TimezoneMap zone={selectedZone} {offsetMinutes} label={mapLabel} />

		<div class="clock">
			<span class="time">{formatZoneTime(selectedTimezone, now)}</span>
			<span class="date">{formatZoneDate(selectedTimezone, now)}</span>
			<span class="zone-id">{selectedTimezone}</span>
		</div>

		{#if !ntpSynchronized}
			<p class="warning">
				<TriangleAlert />
				The clock isn't synced over the internet, so times might be off whatever zone you pick.
			</p>
		{/if}
	{/if}

	{#snippet footer()}
		{#if !isLoading && !loadError}
			<button
				type="button"
				class="btn btn-primary"
				onclick={handleSave}
				disabled={!hasChanges || isSaving}
			>
				{#if isSaving}
					<LoaderCircle class="spin" />
				{/if}
				{isSaving ? 'Saving…' : 'Save timezone'}
			</button>
		{/if}
	{/snippet}
</SettingsSheet>

<style>
	.state {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 40px 0;
		color: var(--color-text-soft);
		font-size: 0.95rem;
	}
	.state.error {
		color: var(--color-red);
	}
	.clock {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 4px;
	}
	.time {
		font-size: 2.6rem;
		font-weight: 800;
		line-height: 1;
		color: var(--color-text-secondary);
		font-variant-numeric: tabular-nums;
	}
	.date {
		font-size: 0.95rem;
		color: var(--color-text-muted);
	}
	.zone-id {
		font-size: 0.8rem;
		color: var(--color-text-subtle);
		overflow-wrap: anywhere;
	}
	.warning {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 0;
		font-size: 0.85rem;
		color: var(--color-red);
		font-weight: 600;
	}
</style>
