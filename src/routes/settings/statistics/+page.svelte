<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		RefreshCw,
		Package,
		Clock,
		Timer,
		Layers,
		Cpu,
		MemoryStick,
		Thermometer,
		Network,
		HardDrive,
		Server,
		TriangleAlert,
		Trash2
	} from 'lucide-svelte';
	import type {
		HistoryTotalsResult,
		SystemInfoResult,
		ProcStatsResult,
		ServerInfoResult
	} from '$lib/types/statistics';
	import {
		fetchHistoryTotals,
		fetchSystemInfo,
		fetchProcStats,
		fetchServerInfo,
		resetHistoryTotals,
		formatDuration,
		formatKib,
		formatBytes,
		formatPercent,
		formatTemp
	} from '$lib/services/moonraker-statistics';
	import { formatFilamentUsed } from '$lib/services/moonraker-history';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';

	// `proc_stats` is the only genuinely "live" section — CPU/memory/network move
	// second to second. Everything else (job totals, hardware, server info) is
	// re-read on manual refresh only, same as the console's reconnect pill.
	const LIVE_POLL_MS = 3000;

	let historyTotals = $state<HistoryTotalsResult | null>(null);
	let systemInfo = $state<SystemInfoResult | null>(null);
	let procStats = $state<ProcStatsResult | null>(null);
	let serverInfo = $state<ServerInfoResult | null>(null);
	let loading = $state(true);
	let refreshing = $state(false);
	let showResetConfirm = $state(false);

	let liveTimer: ReturnType<typeof setInterval> | undefined;

	async function loadStatic() {
		const [totals, sysInfo, srvInfo] = await Promise.all([
			fetchHistoryTotals(),
			fetchSystemInfo(),
			fetchServerInfo()
		]);
		historyTotals = totals;
		systemInfo = sysInfo;
		serverInfo = srvInfo;
	}

	async function loadLive() {
		procStats = await fetchProcStats();
	}

	async function loadAll() {
		refreshing = true;
		await Promise.all([loadStatic(), loadLive()]);
		refreshing = false;
	}

	async function handleReset() {
		showResetConfirm = false;
		try {
			await resetHistoryTotals();
			historyTotals = await fetchHistoryTotals();
		} catch {
			// resetHistoryTotals() already raised a toast on failure.
		}
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

	const latestMoonrakerStat = $derived(
		procStats?.moonraker_stats?.[procStats.moonraker_stats.length - 1] ?? null
	);
	const networkEntries = $derived(Object.entries(procStats?.network ?? {}));
	const systemNetworkEntries = $derived(Object.entries(systemInfo?.system_info?.network ?? {}));
</script>

<section class="statistics-page">
	<div class="statistics-card">
		<header class="statistics-header">
			<h1>Statistics</h1>
			<button
				type="button"
				class="refresh-pill"
				onclick={loadAll}
				disabled={refreshing}
				title="Refresh statistics"
			>
				<RefreshCw class={refreshing ? 'spin' : ''} size={16} />
				{refreshing ? 'Refreshing...' : 'Refresh'}
			</button>
		</header>

		<div class="statistics-body">
			{#if loading}
				<div class="status-message">Loading statistics...</div>
			{:else}
				<!-- Print job totals -->
				<div class="section">
					<div class="section-title">
						<h2>Print jobs</h2>
						<button
							type="button"
							class="reset-button"
							disabled={!historyTotals}
							onclick={() => (showResetConfirm = true)}
						>
							<Trash2 size={16} />
							<span>Reset</span>
						</button>
					</div>
					<div class="tile-grid">
						<div class="tile">
							<span class="tile-icon"><Package size={18} /></span>
							<span class="tile-value">{historyTotals?.job_totals?.total_jobs ?? '--'}</span>
							<span class="tile-label">Total jobs</span>
						</div>
						<div class="tile">
							<span class="tile-icon"><Timer size={18} /></span>
							<span class="tile-value"
								>{formatDuration(historyTotals?.job_totals?.total_print_time)}</span
							>
							<span class="tile-label">Total print time</span>
						</div>
						<div class="tile">
							<span class="tile-icon"><Clock size={18} /></span>
							<span class="tile-value">{formatDuration(historyTotals?.job_totals?.total_time)}</span
							>
							<span class="tile-label">Total time</span>
						</div>
						<div class="tile">
							<span class="tile-icon"><Layers size={18} /></span>
							<span class="tile-value"
								>{formatFilamentUsed(historyTotals?.job_totals?.total_filament_used ?? 0)}</span
							>
							<span class="tile-label">Filament used</span>
						</div>
						<div class="tile">
							<span class="tile-icon"><Timer size={18} /></span>
							<span class="tile-value"
								>{formatDuration(historyTotals?.job_totals?.longest_job)}</span
							>
							<span class="tile-label">Longest job</span>
						</div>
						<div class="tile">
							<span class="tile-icon"><Timer size={18} /></span>
							<span class="tile-value"
								>{formatDuration(historyTotals?.job_totals?.longest_print)}</span
							>
							<span class="tile-label">Longest print</span>
						</div>
					</div>
				</div>

				<!-- Live resource usage -->
				<div class="section">
					<div class="section-title">
						<h2>Live resources</h2>
					</div>
					<div class="tile-grid">
						<div class="tile">
							<span class="tile-icon"><Cpu size={18} /></span>
							<span class="tile-value">{formatPercent(procStats?.system_cpu_usage?.cpu)}</span>
							<span class="tile-label">System CPU</span>
						</div>
						<div class="tile">
							<span class="tile-icon"><Cpu size={18} /></span>
							<span class="tile-value">{formatPercent(latestMoonrakerStat?.cpu_usage)}</span>
							<span class="tile-label">Moonraker CPU</span>
						</div>
						<div class="tile">
							<span class="tile-icon"><MemoryStick size={18} /></span>
							<span class="tile-value">{formatKib(procStats?.system_memory?.used)}</span>
							<span class="tile-label"
								>Memory used{#if procStats?.system_memory?.total}
									/ {formatKib(procStats.system_memory.total)}{/if}</span
							>
						</div>
						<div class="tile">
							<span class="tile-icon"><MemoryStick size={18} /></span>
							<span class="tile-value">{formatKib(latestMoonrakerStat?.memory)}</span>
							<span class="tile-label">Moonraker memory</span>
						</div>
						<div class="tile">
							<span class="tile-icon"><Thermometer size={18} /></span>
							<span class="tile-value">{formatTemp(procStats?.cpu_temp)}</span>
							<span class="tile-label">CPU temperature</span>
						</div>
						<div class="tile">
							<span class="tile-icon"><Server size={18} /></span>
							<span class="tile-value">{procStats?.websocket_connections ?? '--'}</span>
							<span class="tile-label">WebSocket connections</span>
						</div>
					</div>
					{#if procStats?.throttled_state?.flags?.length}
						<div class="warning-row">
							<TriangleAlert size={16} />
							<span>Throttled: {procStats.throttled_state.flags.join(', ')}</span>
						</div>
					{/if}
					{#if networkEntries.length}
						<div class="network-list">
							{#each networkEntries as [iface, stats] (iface)}
								<div class="network-row">
									<span class="network-iface"><Network size={14} /> {iface}</span>
									<span class="network-stat">↓ {formatBytes(stats.rx_bytes)}</span>
									<span class="network-stat">↑ {formatBytes(stats.tx_bytes)}</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Hardware / system info -->
				<div class="section">
					<div class="section-title">
						<h2>System</h2>
					</div>
					<div class="tile-grid">
						<div class="tile wide">
							<span class="tile-icon"><Cpu size={18} /></span>
							<span class="tile-value small"
								>{systemInfo?.system_info?.cpu_info?.model ??
									systemInfo?.system_info?.cpu_info?.cpu_desc ??
									'--'}</span
							>
							<span class="tile-label"
								>{systemInfo?.system_info?.cpu_info?.cpu_count ?? '--'} cores</span
							>
						</div>
						<div class="tile">
							<span class="tile-icon"><MemoryStick size={18} /></span>
							<span class="tile-value"
								>{formatKib(systemInfo?.system_info?.cpu_info?.total_memory)}</span
							>
							<span class="tile-label">Total memory</span>
						</div>
						<div class="tile">
							<span class="tile-icon"><HardDrive size={18} /></span>
							<span class="tile-value">{systemInfo?.system_info?.sd_info?.capacity ?? '--'}</span>
							<span class="tile-label"
								>{systemInfo?.system_info?.sd_info?.manufacturer ?? 'Storage'}</span
							>
						</div>
						<div class="tile wide">
							<span class="tile-icon"><Server size={18} /></span>
							<span class="tile-value small"
								>{systemInfo?.system_info?.distribution?.name ?? '--'}</span
							>
							<span class="tile-label">Operating system</span>
						</div>
					</div>
					{#if systemNetworkEntries.length}
						<div class="network-list">
							{#each systemNetworkEntries as [iface, info] (iface)}
								<div class="network-row">
									<span class="network-iface"><Network size={14} /> {iface}</span>
									<span class="network-stat"
										>{info.ip_addresses
											?.filter((ip) => !ip.is_link_local)
											.map((ip) => ip.address)
											.join(', ') || '--'}</span
									>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Server info -->
				<div class="section">
					<div class="section-title">
						<h2>Server</h2>
					</div>
					<div class="tile-grid">
						<div class="tile">
							<span class="tile-icon"><Package size={18} /></span>
							<span class="tile-value small">{serverInfo?.moonraker_version ?? '--'}</span>
							<span class="tile-label">Moonraker version</span>
						</div>
						<div class="tile">
							<span class="tile-icon"><Server size={18} /></span>
							<span class="tile-value small">{serverInfo?.klippy_state ?? '--'}</span>
							<span class="tile-label">Klippy state</span>
						</div>
						<div class="tile">
							<span class="tile-icon"><Layers size={18} /></span>
							<span class="tile-value">{serverInfo?.components?.length ?? '--'}</span>
							<span class="tile-label">Components loaded</span>
						</div>
					</div>
					{#if serverInfo?.failed_components?.length || serverInfo?.warnings?.length}
						<div class="warning-row">
							<TriangleAlert size={16} />
							<span
								>{[...(serverInfo?.failed_components ?? []), ...(serverInfo?.warnings ?? [])].join(
									'; '
								)}</span
							>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</section>

<ConfirmModal
	isOpen={showResetConfirm}
	title="Reset print statistics?"
	message="Total jobs, print time and filament totals will be reset to zero. This cannot be undone."
	confirmLabel="Reset"
	onConfirm={handleReset}
	onCancel={() => (showResetConfirm = false)}
/>

<style>
	.statistics-page {
		height: 100%;
		padding: 24px 24px 112px;
		box-sizing: border-box;
	}
	.statistics-card {
		height: 100%;
		background: var(--color-white);
		border-radius: 20px;
		box-shadow: var(--shadow-float);
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		box-sizing: border-box;
		min-height: 0;
	}
	.statistics-header {
		display: flex;
		align-items: center;
		gap: 14px;
		flex-shrink: 0;
	}
	.statistics-header h1 {
		margin: 0;
		font-size: 2rem;
		font-weight: 700;
		color: var(--color-text-secondary);
	}
	.refresh-pill {
		margin-left: auto;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		border: none;
		border-radius: 999px;
		padding: 8px 16px;
		font-size: 0.95rem;
		font-weight: 600;
		cursor: pointer;
		background: var(--color-info-bg);
		color: var(--color-info);
	}
	.refresh-pill:disabled {
		opacity: 0.7;
		cursor: default;
	}
	.statistics-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
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
	.reset-button {
		margin-left: auto;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 14px;
		border: none;
		border-radius: 999px;
		background: var(--color-danger-bg);
		color: var(--color-red);
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
	}
	.reset-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
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
	.tile.wide {
		grid-column: span 2;
	}
	.tile-icon {
		display: inline-flex;
		color: var(--color-text-soft);
	}
	.tile-value {
		font-size: 1.3rem;
		font-weight: 700;
		color: var(--color-text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.tile-value.small {
		font-size: 0.95rem;
	}
	.tile-label {
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
	.network-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.network-row {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 8px 14px;
		border-radius: 10px;
		background: var(--color-surface-sunken);
		font-size: 0.85rem;
		color: var(--color-text-muted);
		flex-wrap: wrap;
	}
	.network-iface {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-weight: 600;
		color: var(--color-text-secondary);
	}
	.network-stat {
		color: var(--color-text-soft);
	}

	@media (max-width: 767.98px) {
		.statistics-page {
			padding: 16px 16px 112px;
		}
		.tile-grid {
			grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
		}
		.tile.wide {
			grid-column: span 2;
		}
	}
</style>
