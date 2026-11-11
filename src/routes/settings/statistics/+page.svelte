<script lang="ts">
	import SettingsSheet from '$lib/components/SettingsSheet.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { TriangleAlert } from 'lucide-svelte';
	import type { DiskUsage, HistoryTotalsResult, ProcStatsResult } from '$lib/types/statistics';
	import {
		fetchDiskUsage,
		fetchHistoryTotals,
		fetchProcStats,
		formatPercent,
		formatTemp
	} from '$lib/services/moonraker-statistics';
	import { materialKgFromMm } from '$lib/services/moonraker-history';

	// `proc_stats` è l'unica sezione davvero live: CPU, memoria e temperatura cambiano di
	// secondo in secondo. I totali delle stampe e il disco si leggono all'apertura.
	const LIVE_POLL_MS = 3000;

	let historyTotals = $state<HistoryTotalsResult | null>(null);
	let procStats = $state<ProcStatsResult | null>(null);
	let disk = $state<DiskUsage | null>(null);
	let loading = $state(true);

	let liveTimer: ReturnType<typeof setInterval> | undefined;

	async function loadTotals() {
		[historyTotals, disk] = await Promise.all([fetchHistoryTotals(), fetchDiskUsage()]);
	}

	async function loadLive() {
		procStats = await fetchProcStats();
	}

	async function loadAll() {
		await Promise.all([loadTotals(), loadLive()]);
	}

	onMount(async () => {
		loading = true;
		await loadAll();
		loading = false;
		liveTimer = setInterval(loadLive, LIVE_POLL_MS);
	});

	onDestroy(() => {
		if (liveTimer) clearInterval(liveTimer);
	});

	const totals = $derived(historyTotals?.job_totals);
	const memory = $derived(procStats?.system_memory);
	// "Usato / libero" con l'unità una volta sola, scelta sul valore più grande.
	function usedFree(usedBytes: number, freeBytes: number): string {
		const gb = Math.max(usedBytes, freeBytes) >= 1024 ** 3;
		const div = gb ? 1024 ** 3 : 1024 ** 2;
		const fmt = (bytes: number) => (bytes / div).toFixed(gb ? 1 : 0);
		return `${fmt(usedBytes)} / ${fmt(freeBytes)} ${gb ? 'GB' : 'MB'}`;
	}
	// Moonraker dà la memoria in KiB, il disco in byte.
	const memoryLabel = $derived(
		memory ? usedFree(memory.used * 1024, memory.available * 1024) : '--'
	);
	const diskLabel = $derived(disk ? usedFree(disk.used, disk.free) : '--');
	// I tempi arrotondati all'ora, con la tilde.
	const approxHours = (seconds?: number) => (seconds ? `~${Math.round(seconds / 3600)} h` : '--');
	// Una stima (la densità è quella di default): kg interi con la tilde.
	const materialKg = $derived(
		totals?.total_filament_used
			? `~${Math.round(materialKgFromMm(totals.total_filament_used))} kg`
			: '--'
	);
</script>

<svelte:head>
	<title>Statistics · G2</title>
</svelte:head>

<SettingsSheet title="Statistics" size="lg">
	<div class="statistics-body">
		{#if loading}
			<div class="status-message">Crunching the numbers…</div>
		{:else}
			<div class="section">
				<div class="section-title">
					<h2>Your prints</h2>
				</div>
				<div class="tile-grid">
					<div class="tile">
						<span class="tile-value">{totals?.total_jobs ?? '--'}</span>
						<span class="tile-label">Total prints</span>
					</div>
					<!-- I totali non dicono il materiale: kg stimati con la densità di default, come in History. -->
					<div class="tile">
						<span class="tile-value">{materialKg}</span>
						<span class="tile-label">Material used</span>
					</div>
					<div class="tile">
						<span class="tile-value">{approxHours(totals?.total_print_time)}</span>
						<span class="tile-label">Total print time</span>
					</div>
					<div class="tile">
						<span class="tile-value">{approxHours(totals?.longest_job)}</span>
						<span class="tile-label">Longest print</span>
					</div>
				</div>
			</div>

			<div class="section">
				<div class="section-title">
					<h2>Live resources</h2>
				</div>
				<div class="tile-grid">
					<div class="tile">
						<span class="tile-value">{formatPercent(procStats?.system_cpu_usage?.cpu)}</span>
						<span class="tile-label">System CPU</span>
					</div>
					<!-- Usato / libero. -->
					<div class="tile">
						<span class="tile-value">{memoryLabel}</span>
						<span class="tile-label">System RAM</span>
					</div>
					<div class="tile">
						<span class="tile-value">{diskLabel}</span>
						<span class="tile-label">Storage</span>
					</div>
					<div class="tile">
						<span class="tile-value">{formatTemp(procStats?.cpu_temp)}</span>
						<span class="tile-label">CPU temperature</span>
					</div>
				</div>
				{#if procStats?.throttled_state?.flags?.length}
					<div class="warning-row">
						<TriangleAlert size={16} />
						<span>Throttled: {procStats.throttled_state.flags.join(', ')}</span>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</SettingsSheet>

<style>
	.statistics-body {
		display: flex;
		flex-direction: column;
		gap: 28px;
	}
	.status-message {
		text-align: center;
		padding: 48px 16px;
		font-size: 1.1rem;
		color: var(--color-text-subtle);
	}
	.section {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.section-title {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.section-title h2 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--color-text-secondary);
	}
	.tile-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 12px;
	}
	.tile {
		display: flex;
		flex-direction: column;
		gap: 4px;
		background: var(--color-background);
		border-radius: 14px;
		padding: 14px 16px;
	}
	.tile-value {
		font-size: 1.3rem;
		font-weight: 700;
		color: var(--color-text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	/* L'etichetta sopra il valore. */
	.tile-label {
		order: -1;
		font-size: 0.78rem;
		color: var(--color-text-subtle);
	}
	.warning-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		border-radius: 12px;
		background: var(--color-warning-bg);
		color: var(--color-warning);
		font-size: 0.85rem;
	}

	@media (max-width: 767.98px) {
		.tile-grid {
			grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
		}
	}
</style>
