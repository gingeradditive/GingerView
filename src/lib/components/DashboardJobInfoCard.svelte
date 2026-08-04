<script lang="ts">
	import {
		extractThumbnailFromGcode,
		getFileMetadata,
		getFilamentType
	} from '$lib/services/moonraker-files';
	import { subscribeWhileVisible } from '$lib/services/panel-subscription.svelte';

	/** Falso quando la slide è fuori dalla viewport del carosello: l'iscrizione si ferma. */
	let { visible = true }: { visible?: boolean } = $props();

	type JobInfoStatus = { print_stats?: { state?: string; filename?: string } };

	const dataSource = 'dashboard-job-info';
	const dataQuery = 'print_stats';

	let jobName = $state('--');
	let jobMaterial = $state('');
	let thumbnailUrl = $state<string>('/error-thumbnail.png');

	let lastFilename: string | null = null;

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

			const thumb = await extractThumbnailFromGcode(filename);
			thumbnailUrl = thumb ?? '/error-thumbnail.png';
		} catch {
			jobMaterial = '';
			thumbnailUrl = '/error-thumbnail.png';
		}
	};

	const updateJobInfo = (status: JobInfoStatus): void => {
		// Kalico keeps `print_stats.filename` after a job ends — `complete`,
		// `cancelled` and `error` all still carry the name of the last file, and
		// only a new print or SDCARD_RESET_FILE clears it. Going by the state is
		// what empties the card when the print is over.
		const printState = status.print_stats?.state ?? 'standby';
		const isIdle = printState !== 'printing' && printState !== 'paused';

		const filename = isIdle ? '' : (status.print_stats?.filename ?? '');
		if (filename) {
			jobName = stripExtension(filename);
			loadFileMetadata(filename);
		} else {
			jobName = '--';
			jobMaterial = '';
			thumbnailUrl = '/error-thumbnail.png';
			lastFilename = null;
		}
	};

	subscribeWhileVisible<JobInfoStatus>(
		dataSource,
		() => dataQuery,
		updateJobInfo,
		() => visible
	);
</script>

<section class="job-info-card" aria-label="Print Job Info">
	<span class="job-name">{jobName}</span>
	<div class="job-preview">
		<img src={thumbnailUrl} alt="Print preview" />
	</div>
	<span class="job-material">{jobMaterial}</span>
</section>

<style>
	.job-info-card {
		background: var(--color-white);
		border-radius: 19.2px;
		padding: 16px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		width: 100%;
		height: 100%;
		box-sizing: border-box;
		box-shadow: var(--shadow-panel);
		text-align: center;
	}

	.job-name {
		font-size: 2rem;
		font-weight: 700;
		color: var(--color-text-secondary);
	}

	.job-preview {
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.job-preview img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}

	.job-material {
		font-size: 0.85rem;
		color: var(--color-text-soft);
		font-weight: 500;
	}
</style>
