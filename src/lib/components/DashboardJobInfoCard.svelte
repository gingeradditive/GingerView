<script lang="ts">
	import {
		extractThumbnailFromGcode,
		getFileMetadata,
		getFilamentType
	} from '$lib/services/moonraker-files';
	import { subscribeWhileVisible } from '$lib/services/panel-subscription.svelte';
	import { resolve } from '$app/paths';
	import { fitText } from '$lib/actions/fit-text';

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
		<span class="job-name" title={jobName} use:fitText={jobName}>{jobName}</span>
	{/if}
	<div class="job-preview">
		{#if hasJob}
			<img src={thumbnailUrl} alt="Print preview" />
		{:else}
			<!-- A riposo il logo della G2, lo stesso del dock, al centro della card; l'invito
			     sta in fondo. -->
			<img class="idle-logo" src="/Printers/G2/Logo.svg" alt="" />
		{/if}
	</div>
	{#if hasJob}
		<span class="job-material">{jobMaterial}</span>
	{:else}
		<span class="job-cta">Browse file</span>
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

	/* Sempre su una riga: il font qui è il massimo, `fitText` lo riduce quanto serve
	   perché il testo ci stia. L'ellissi solo se nemmeno al minimo ci sta. */
	.job-name {
		flex-shrink: 0;
		max-width: 100%;
		font-size: min(2rem, 12cqw);
		font-weight: 700;
		color: var(--color-text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.job-preview {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
	}

	.job-preview img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}

	.job-preview img.idle-logo {
		width: min(90%, 300px);
		height: auto;
	}

	/* In fondo alla card, più piccolo del sottotitolo comune (DashboardCarousel). */
	.job-cta {
		flex-shrink: 0;
		font-size: max(0.85rem, calc(var(--dashboard-subtitle-size) * 0.7));
		font-weight: 500;
		color: var(--color-text-soft);
		line-height: 1.3;
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
