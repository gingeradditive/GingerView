<script lang="ts">
	import {
		extractThumbnailFromGcode,
		getFileMetadata,
		getFilamentType
	} from '$lib/services/moonraker-files';
	import { subscribeWhileVisible } from '$lib/services/panel-subscription.svelte';
	import { resolve } from '$app/paths';

	/** Falso quando la slide è fuori dalla viewport del carosello: l'iscrizione si ferma. */
	let { visible = true }: { visible?: boolean } = $props();

	type JobInfoStatus = { print_stats?: { state?: string; filename?: string } };

	const dataSource = 'dashboard-job-info';
	const dataQuery = 'print_stats';

	// Nessuna stampa in corso: invece di "--" un invito, e tutta la card porta ai file.
	let hasJob = $state(false);
	let jobName = $state('');
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
		hasJob = filename !== '';
		if (filename) {
			jobName = stripExtension(filename);
			loadFileMetadata(filename);
		} else {
			jobName = '';
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

<!-- A riposo tutta la card porta ai file, non solo la scritta in fondo. -->
<svelte:element
	this={hasJob ? 'section' : 'a'}
	class="job-info-card"
	class:link={!hasJob}
	href={hasJob ? undefined : resolve('/filelist')}
	aria-label={hasJob ? 'Print Job Info' : 'Pick a file to print'}
>
	{#if hasJob}
		<span class="job-name" title={jobName}>{jobName}</span>
	{:else}
		<span class="job-name idle">What are we making today?</span>
	{/if}
	<div class="job-preview">
		{#if hasJob}
			<img src={thumbnailUrl} alt="Print preview" />
		{:else}
			<!-- A riposo il logo della G2, lo stesso del dock. -->
			<img class="idle-logo" src="/Printers/G2/Logo.svg" alt="" />
		{/if}
	</div>
	{#if hasJob}
		<span class="job-material">{jobMaterial}</span>
	{:else}
		<span class="job-cta">Pick a file and let's get going!</span>
	{/if}
</svelte:element>

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
		container-type: inline-size;
	}

	/* Un nome file lungo non deve spingere via l'anteprima: due righe al massimo. */
	.job-name {
		flex-shrink: 0;
		max-width: 100%;
		font-size: min(2rem, 12cqw);
		font-weight: 700;
		color: var(--color-text-secondary);
		overflow-wrap: anywhere;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
	}

	/* L'invito ha lo stesso font del titolo FLOW delle altre card, e può andare su tre righe:
	   il limite di due serve ai nomi file. */
	.job-name.idle {
		font-size: min(var(--dashboard-title-size), 12cqw);
		-webkit-line-clamp: 3;
		line-clamp: 3;
		color: var(--color-black);
		line-height: 1.1;
		letter-spacing: 0.02em;
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

	.job-preview img.idle-logo {
		width: min(70%, 200px);
		height: auto;
	}

	.job-cta {
		flex-shrink: 0;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--color-red);
		text-decoration: none;
	}

	.job-info-card.link {
		color: inherit;
		text-decoration: none;
		cursor: pointer;
		transition:
			background-color 0.15s,
			transform 0.1s;
		-webkit-tap-highlight-color: transparent;
	}

	.job-info-card.link:hover {
		background: var(--color-background);
	}

	.job-info-card.link:active {
		transform: scale(0.98);
	}

	.job-info-card.link:focus-visible {
		outline: 2px solid var(--color-red);
		outline-offset: -4px;
	}

	.job-info-card.link:hover .job-cta {
		text-decoration: underline;
	}

	@media (prefers-reduced-motion: reduce) {
		.job-info-card.link {
			transition: none;
		}
	}

	.job-material {
		flex-shrink: 0;
		font-size: 0.85rem;
		color: var(--color-text-soft);
		font-weight: 500;
	}
</style>
