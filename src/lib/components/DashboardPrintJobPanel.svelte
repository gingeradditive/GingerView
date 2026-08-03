<script lang="ts">
	import { onMount } from 'svelte';
	import { getMoonrakerApiUrl } from '$lib/services/config';
	import {
		extractThumbnailFromGcode,
		getFileMetadata,
		getFilamentType
	} from '$lib/services/moonraker-files';

	const pollIntervalMs = 2000;

	let jobName = $state('--');
	let jobMaterial = $state('');
	let elapsed = $state('--:--:--');
	let remaining = $state('--:--:--');
	let eta = $state('--:--');
	let progress = $state(0);
	let printState = $state<string>('standby');
	let thumbnailUrl = $state<string>('/error-thumbnail.png');
	let isPrinting = $state(false);
	let isPaused = $state(false);
	let isIdle = $derived(!isPrinting && !isPaused);

	let estimatedTotalSeconds: number | null = null;
	let lastFilename: string | null = null;

	const formatDuration = (seconds: number): string => {
		if (!seconds || seconds < 0) return '--:--:--';
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = Math.floor(seconds % 60);
		return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
	};

	const formatTime = (date: Date): string => {
		return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
	};

	const stripExtension = (filename: string): string => {
		const base = filename.split('/').pop() ?? filename;
		return base.replace(/\.[^/.]+$/, '');
	};

	const loadFileMetadata = async (filename: string): Promise<void> => {
		if (!filename || filename === lastFilename) return;
		lastFilename = filename;
		try {
			const metadata = await getFileMetadata(filename);
			jobMaterial = getFilamentType(metadata);
			estimatedTotalSeconds = metadata.estimated_time ?? null;

			const thumb = await extractThumbnailFromGcode(filename);
			if (thumb) thumbnailUrl = thumb;
			else thumbnailUrl = '/error-thumbnail.png';
		} catch {
			jobMaterial = '';
			estimatedTotalSeconds = null;
			thumbnailUrl = '/error-thumbnail.png';
		}
	};

	const updatePrintJob = async (): Promise<void> => {
		try {
			const response = await fetch(
				`${getMoonrakerApiUrl()}/printer/objects/query?print_stats&virtual_sdcard`
			);
			if (!response.ok) return;

			const payload = await response.json();
			const status = payload?.result?.status;
			if (!status) return;

			const printStats = status.print_stats;
			const vsd = status.virtual_sdcard;

			printState = printStats?.state ?? 'standby';
			isPrinting = printState === 'printing';
			isPaused = printState === 'paused';

			const filename = printStats?.filename ?? '';
			if (filename) {
				jobName = stripExtension(filename);
				loadFileMetadata(filename);
			} else {
				jobName = '--';
				jobMaterial = '';
				thumbnailUrl = '/error-thumbnail.png';
				lastFilename = null;
				estimatedTotalSeconds = null;
			}

			const printDuration = printStats?.print_duration ?? 0;
			elapsed = formatDuration(printDuration);

			const prog = vsd?.progress ?? 0;
			progress = Math.round(prog * 100);

			if (prog > 0.001 && printDuration > 0) {
				const totalEstimated = printDuration / prog;
				const remainingSeconds = totalEstimated - printDuration;
				remaining = formatDuration(remainingSeconds);
				const etaDate = new Date(Date.now() + remainingSeconds * 1000);
				eta = formatTime(etaDate);
			} else if (estimatedTotalSeconds && estimatedTotalSeconds > 0) {
				const remainingSeconds = Math.max(0, estimatedTotalSeconds - printDuration);
				remaining = formatDuration(remainingSeconds);
				const etaDate = new Date(Date.now() + remainingSeconds * 1000);
				eta = formatTime(etaDate);
			} else {
				remaining = '--:--:--';
				eta = '--:--';
			}
		} catch {
			return;
		}
	};

	const sendGcode = async (gcode: string): Promise<void> => {
		try {
			await fetch(
				`${getMoonrakerApiUrl()}/printer/gcode/script?script=${encodeURIComponent(gcode)}`,
				{ method: 'POST' }
			);
		} catch {
			// ignore
		}
	};

	const handlePauseResume = (): void => {
		if (isPaused) {
			sendGcode('RESUME');
		} else if (isPrinting) {
			sendGcode('PAUSE');
		}
	};

	const handleCancel = (): void => {
		if (isPrinting || isPaused) {
			sendGcode('CANCEL_PRINT');
		}
	};

	onMount(() => {
		updatePrintJob();
		const interval = window.setInterval(updatePrintJob, pollIntervalMs);
		return () => window.clearInterval(interval);
	});
</script>

<section class="print-job-panel" aria-label="Print Job Info">
	{#if isIdle}
		<div class="idle-header">
			<img src="/Printers/G2/Logo.svg" alt="G2" class="idle-logo" />
			<span class="idle-title">Ready to Print!</span>
		</div>
		<div class="progress-bar">
			<div class="progress-track">
				<div class="progress-elapsed" style="width: 100%"></div>
			</div>
		</div>
	{:else}
		<div class="job-header">
			<div class="job-info">
				<span class="job-name">{jobName.length > 30 ? jobName.slice(0, 30) + '...' : jobName}</span>
				<span class="job-material">{jobMaterial}</span>
			</div>
			<div class="job-preview">
				<img src={thumbnailUrl} alt="Print preview" />
			</div>
			<div class="job-controls">
				<button class="control-btn stop" aria-label="Stop" onclick={handleCancel}>
					<svg width="24" height="24" viewBox="0 0 18 18" fill="none">
						<rect x="2" y="2" width="14" height="14" rx="2" fill="#d72e28" />
					</svg>
				</button>
				<button
					class="control-btn pause"
					aria-label={isPaused ? 'Resume' : 'Pause'}
					onclick={handlePauseResume}
				>
					{#if isPaused}
						<svg width="24" height="24" viewBox="0 0 18 18" fill="none">
							<polygon points="4,1 17,9 4,17" fill="#d72e28" />
						</svg>
					{:else}
						<svg width="24" height="24" viewBox="0 0 18 18" fill="none">
							<rect x="3" y="1" width="4" height="16" rx="1.5" fill="#d72e28" />
							<rect x="11" y="1" width="4" height="16" rx="1.5" fill="#d72e28" />
						</svg>
					{/if}
				</button>
			</div>
			<span class="job-percentage">{progress}%</span>
		</div>
		<div class="progress-bar">
			<div class="progress-track">
				<div class="progress-elapsed" style="width: {progress}%"></div>
				<div class="progress-remaining" style="width: {100 - progress}%">
					<span class="eta-time">ETA: {eta} / {remaining}</span>
				</div>
			</div>
			<span class="elapsed-time">{elapsed}</span>
		</div>
	{/if}
</section>

<style>
	.print-job-panel {
		background: var(--color-white);
		border-radius: 16px;
		padding: 16px 0 0 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
		height: 100%;
		box-sizing: border-box;
		box-shadow: var(--shadow-panel);
	}

	.idle-header {
		display: flex;
		align-items: center;
		gap: 16px;
		flex: 1;
		padding: 0 24px;
	}

	.idle-logo {
		height: 48px;
		width: auto;
	}

	.idle-title {
		font-size: 2rem;
		font-weight: 600;
		color: var(--color-text-secondary);
		line-height: 1.1;
	}

	.job-header {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		flex: 1;
		padding: 0 16px;
		position: relative;
	}

	.job-percentage {
		position: absolute;
		left: 16px;
		bottom: -0.9rem;
		color: var(--color-text-secondary);
		font-size: 2.5rem;
		font-weight: 600;
		white-space: nowrap;
	}

	.job-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.job-name {
		font-size: 1.6rem;
		font-weight: 600;
		color: var(--color-text-secondary);
		line-height: 1.1;
	}

	.job-material {
		font-size: 0.8rem;
		color: var(--color-text-soft);
		font-weight: 500;
	}

	.job-preview {
		flex-shrink: 0;
		margin-left: auto;
		transform: translateY(20px);
	}

	.job-preview img {
		width: auto;
		height: 130px;
		object-fit: contain;
	}

	.job-controls {
		display: flex;
		gap: 12px;
		flex-shrink: 0;
		align-self: center;
		margin-left: auto;
	}

	.control-btn {
		width: 58px;
		height: 58px;
		border-radius: 14px;
		border: 3px solid var(--color-red);
		background: transparent;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
	}

	.control-btn:hover {
		background: var(--color-danger-bg);
	}

	.progress-bar {
		display: flex;
		flex-direction: column;
		position: relative;
	}

	.progress-track {
		display: flex;
		width: 100%;
		height: 36px;
		border-radius: 0 0 16px 16px;
		overflow: hidden;
	}

	.progress-elapsed {
		background: var(--color-red);
	}

	.elapsed-time {
		position: absolute;
		left: 16px;
		top: 0;
		height: 36px;
		display: flex;
		align-items: center;
		color: var(--color-white);
		font-size: 0.95rem;
		font-weight: 700;
		white-space: nowrap;
	}

	.progress-remaining {
		background: var(--color-gray-light);
		display: flex;
		align-items: center;
		justify-content: flex-end;
		padding: 0 12px;
		min-width: 0;
	}

	.eta-time {
		color: var(--color-white);
		font-size: 0.8rem;
		font-weight: 600;
		white-space: nowrap;
		margin-left: auto;
	}
</style>
