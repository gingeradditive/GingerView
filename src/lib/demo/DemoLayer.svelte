<script lang="ts">
	import { onMount } from 'svelte';
	import { beforeNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { MonitorSmartphone, FastForward, RotateCcw } from 'lucide-svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import PrinterG2 from '$lib/illustrations/PrinterG2.svelte';
	import { toastActions } from '$lib/stores/toastStore';
	import { formatDuration } from '$lib/utils/format';
	import { demoConfig } from './config';
	import { on } from './events';
	import { getJobInfo } from './printer';
	import { getMetadata } from './storage';

	/**
	 * Tutto ciò che la demo aggiunge all'interfaccia, in un solo componente
	 * montato dal layout (e solo con `VITE_DEMO=1`):
	 *
	 * - l'avviso al primo accesso: la stampante è virtuale, non la G2 allo stand;
	 * - la barra DEMO fissa in alto, che riapre l'avviso e durante una stampa
	 *   mostra il tempo accelerato;
	 * - un messaggio a fine stampa con il tempo vero del pezzo;
	 * - le pagine nascoste di `demoConfig.hiddenRoutes`.
	 */

	const NOTICE_KEY = 'gingerview-demo-notice-v1';

	let noticeOpen = $state(false);
	let job = $state<ReturnType<typeof getJobInfo>>(null);

	const stripExtension = (filename: string): string =>
		(filename.split('/').pop() ?? filename).replace(/\.[^/.]+$/, '');

	const isHidden = (path: string): boolean =>
		demoConfig.hiddenRoutes.some((route) => path === route || path.startsWith(`${route}/`));

	function closeNotice(): void {
		noticeOpen = false;
		try {
			localStorage.setItem(NOTICE_KEY, '1');
		} catch {
			// Navigazione privata: l'avviso tornerà alla prossima visita, pazienza.
		}
	}

	onMount(() => {
		try {
			noticeOpen = localStorage.getItem(NOTICE_KEY) !== '1';
		} catch {
			noticeOpen = true;
		}

		const timer = window.setInterval(() => (job = getJobInfo()), 500);

		const stops = [
			on('print:complete', ({ filename }) => {
				const estimated = Number(getMetadata(filename)?.estimated_time ?? 0);
				toastActions.success(
					'system',
					"Print's done!",
					estimated > 0
						? `${stripExtension(filename)} is done. On a real G2 this part takes ${formatDuration(estimated)}.`
						: `${stripExtension(filename)} is done.`
				);
			})
		];

		// Pagine nascoste: i link spariscono, e chi arriva dall'indirizzo torna alla dashboard.
		let style: HTMLStyleElement | null = null;
		if (demoConfig.hiddenRoutes.length > 0) {
			style = document.createElement('style');
			style.textContent = demoConfig.hiddenRoutes
				// I link sono relativi (`./settings/…`, `../settings/…`): si confronta la fine.
				// Con il link sparisce anche la linea divisoria che lo precede nelle Settings.
				.map(
					(route) =>
						`a[href$="${route}"], a[href*="${route}/"], .divider:has(+ a[href$="${route}"])`
				)
				.join(',\n')
				.concat(' { display: none !important; }');
			document.head.append(style);
		}
		if (isHidden($page.url.pathname)) goto(resolve('/'), { replaceState: true });

		return () => {
			window.clearInterval(timer);
			for (const stop of stops) stop();
			style?.remove();
		};
	});

	beforeNavigate((navigation) => {
		if (navigation.to && isHidden(navigation.to.url.pathname)) {
			navigation.cancel();
			toastActions.info('system', 'Demo', "This page isn't part of the demo.");
		}
	});

	const speedLabel = $derived(job ? `×${Math.round(job.speedup)}` : '');
</script>

<!-- La barra della demo: fissa, rosa a strisce, fuori dal linguaggio visivo di
     GingerView apposta, perché nessuno la scambi per una parte dell'interfaccia. -->
<header class="demo-header">
	<button class="demo-id" type="button" onclick={() => (noticeOpen = true)}>
		<span class="demo-tag">DEMO</span>
		<span class="demo-name">{demoConfig.printerName}</span>
	</button>
	<div class="demo-status" role="status">
		{#if job && job.phase === 'printing'}
			<!-- Icone disegnate come quelle del pannello di stampa: niente emoji. -->
			<svg class="demo-icon" viewBox="0 0 18 18" aria-hidden="true">
				{#if job.paused}
					<rect x="3" y="2" width="4" height="14" rx="1.5" />
					<rect x="11" y="2" width="4" height="14" rx="1.5" />
				{:else}
					<polygon points="1,3 9,9 1,15" />
					<polygon points="9,3 17,9 9,15" />
				{/if}
			</svg>
			{job.paused ? 'Paused' : `Accelerated time ${speedLabel}`}
		{:else if job}
			Heating up…
		{:else}
			<button class="demo-about" type="button" onclick={() => (noticeOpen = true)}>
				Not the booth printer · <u>About</u>
			</button>
		{/if}
	</div>
</header>

{#if noticeOpen}
	<!-- Sopra a tutto, anche alla barra DEMO: è la prima cosa che si vede. -->
	<Sheet label="About this demo" onClose={closeNotice} size="sm" layer={10}>
		<div class="notice">
			<div class="hero"><PrinterG2 /></div>
			<span class="eyebrow">Virtual printer</span>
			<h2 id="demo-notice-title">{demoConfig.printerName}</h2>
			<p class="lead">
				Meet <strong>GingerView</strong>, the interface of the Ginger G2. This one runs on a virtual
				printer, right in your browser!
			</p>
			<ul>
				<li>
					<span class="li-icon"><MonitorSmartphone size={18} /></span>
					<span>Don't worry, it <strong>can't</strong> move the G2 at the booth.</span>
				</li>
				<li>
					<span class="li-icon"><FastForward size={18} /></span>
					<span
						>Pick a file and hit print! It runs on fast-forward, so it's done in a few minutes.</span
					>
				</li>
				<li>
					<span class="li-icon"><RotateCcw size={18} /></span>
					<span>Reload the page and everything starts fresh.</span>
				</li>
			</ul>
		</div>

		{#snippet footer()}
			<button class="btn btn-primary start" type="button" onclick={closeNotice}>
				Let's explore!
			</button>
		{/snippet}
	</Sheet>
{/if}

<style>
	/* Spazio per la barra: le pagine scorrono sotto di lei, non dietro. */
	:global(:root) {
		--demo-header-height: calc(40px + env(safe-area-inset-top, 0px));
	}

	:global(.page-content) {
		box-sizing: border-box;
		padding-top: var(--demo-header-height);
	}

	.demo-header {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 2900;
		height: var(--demo-header-height);
		box-sizing: border-box;
		padding: env(safe-area-inset-top, 0px) 12px 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		/* Bianco appena rosato e semitrasparente, con le strisce appena accennate: resta
		   riconoscibile come "nastro" della demo senza pesare sulla pagina. */
		background:
			repeating-linear-gradient(-45deg, rgba(var(--rgb-red), 0.05) 0 14px, transparent 14px 28px),
			rgba(255, 244, 244, 0.88);
		backdrop-filter: blur(10px) saturate(140%);
		-webkit-backdrop-filter: blur(10px) saturate(140%);
		border-bottom: 2px solid var(--color-red);
		color: var(--color-black);
		font-size: 0.78rem;
	}

	.demo-id,
	.demo-about {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0;
		border: none;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
		min-width: 0;
	}

	.demo-tag {
		padding: 2px 8px;
		border-radius: 4px;
		background: var(--color-red);
		color: var(--color-white);
		font-weight: 800;
		letter-spacing: 0.12em;
	}

	.demo-name {
		font-weight: 700;
		white-space: nowrap;
	}

	.demo-status {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
		font-weight: 700;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.demo-icon {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
		fill: var(--color-red);
	}

	.demo-about {
		font-weight: 500;
		color: var(--color-text-muted);
	}

	.notice {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}

	.hero {
		width: min(260px, 80%);
		aspect-ratio: 3 / 2;
		margin-bottom: 8px;
	}

	.eyebrow {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-red);
	}

	h2 {
		margin: 4px 0 8px;
		font-size: 1.35rem;
		font-weight: 800;
		color: var(--color-black);
	}

	.lead {
		margin: 0 0 16px;
		font-size: 0.95rem;
		line-height: 1.45;
		color: var(--color-text-muted);
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: 100%;
		text-align: left;
	}

	li {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border-radius: 12px;
		background: var(--color-background);
		font-size: 0.88rem;
		line-height: 1.35;
		color: var(--color-text-muted);
	}

	.li-icon {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border-radius: 10px;
		background: var(--color-white);
		color: var(--color-red);
	}

	.start {
		min-height: 54px;
		font-size: 1.05rem;
	}
</style>
