<script lang="ts">
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
		</header>

		{#if isLoading}
			<div class="state"><LoaderCircle class="spin" /> Reading the current timezone...</div>
		{:else if loadError}
			<div class="state error">
				<TriangleAlert />
				{loadError}
			</div>
		{:else}
			<!--
				La tendina sta sopra la mappa: il pannello dei risultati si apre verso il
				basso e ha davanti a sé tutta la parte bassa della scheda, invece di
				finire sotto il bordo dello schermo.
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
					The clock is not synchronised over the network: times may be wrong regardless of the timezone.
				</p>
			{/if}

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
		background: var(--color-white);
		border-radius: 20px;
		box-shadow: var(--shadow-float);
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
		color: var(--color-text-secondary);
	}
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
		background: var(--color-red);
		color: var(--color-white);
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
