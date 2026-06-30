<script lang="ts">
	import { onMount } from 'svelte';
	import { configService } from '$lib/services/config';
	import { extractThumbnailFromGcode, getFileMetadata, getFilamentType } from '$lib/services/moonraker-files';
	import { DASHBOARD_MOCK_ENABLED, mockJobInfo } from '$lib/mock/dashboardMock';

	const pollIntervalMs = 2000;

	let jobName = $state('--');
	let jobMaterial = $state('');
	let thumbnailUrl = $state<string>('/error-thumbnail.png');

	let lastFilename: string | null = null;

	const getApiUrl = (): string => {
		const config = configService.getKlipperConfig();
		const baseUrl = config.moonrakerApiUrl ?? `http://${config.moonrakerHost}:${config.moonrakerPort}`;
		return baseUrl.replace(/\/$/, '');
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

			const thumb = await extractThumbnailFromGcode(filename);
			thumbnailUrl = thumb ?? '/error-thumbnail.png';
		} catch {
			jobMaterial = '';
			thumbnailUrl = '/error-thumbnail.png';
		}
	};

	const updateJobInfo = async (): Promise<void> => {
		if (DASHBOARD_MOCK_ENABLED) {
			jobName = mockJobInfo.jobName;
			jobMaterial = mockJobInfo.jobMaterial;
			thumbnailUrl = mockJobInfo.thumbnailUrl;
			return;
		}
		try {
			const response = await fetch(`${getApiUrl()}/printer/objects/query?print_stats`);
			if (!response.ok) return;

			const payload = await response.json();
			const status = payload?.result?.status;
			if (!status) return;

			const filename = status.print_stats?.filename ?? '';
			if (filename) {
				jobName = stripExtension(filename);
				loadFileMetadata(filename);
			} else {
				jobName = '--';
				jobMaterial = '';
				thumbnailUrl = '/error-thumbnail.png';
				lastFilename = null;
			}
		} catch {
			return;
		}
	};

	onMount(() => {
		updateJobInfo();
		const interval = window.setInterval(updateJobInfo, pollIntervalMs);
		return () => window.clearInterval(interval);
	});
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
		background: #ffffff;
		border-radius: 16px;
		padding: 16px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		width: 100%;
		height: 100%;
		box-sizing: border-box;
		box-shadow: 0px 4px 3px 0px #00000040;
		text-align: center;
	}

	.job-name {
		font-size: 1.6rem;
		font-weight: 700;
		color: #222222;
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
		color: #666666;
		font-weight: 500;
	}
</style>
