<script lang="ts">
	import { onMount } from 'svelte';
	import { beforeNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { modal } from '$lib/actions/modal';
	import { portal } from '$lib/actions/portal';
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
	 * - il badge DEMO, sempre visibile, che riapre l'avviso;
	 * - l'etichetta "tempo accelerato" mentre una stampa gira;
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
					'Print complete',
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
				.map((route) => `a[href="${route}"], a[href^="${route}/"]`)
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
			toastActions.info('system', 'Demo', 'This page is not part of the demo.');
		}
	});

	const speedLabel = $derived(job ? `×${Math.round(job.speedup)}` : '');
</script>

<button
	class="demo-badge"
	type="button"
	onclick={() => (noticeOpen = true)}
	aria-label="About this demo"
>
	DEMO
</button>

{#if job && job.phase === 'printing'}
	<div class="time-chip" role="status">
		<span aria-hidden="true">⏩</span>
		{job.paused ? 'Paused · accelerated time' : `Accelerated time ${speedLabel}`}
	</div>
{:else if job}
	<div class="time-chip" role="status">Heating up…</div>
{/if}

{#if noticeOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events,a11y_no_noninteractive_element_interactions -->
	<div
		class="notice-overlay"
		role="dialog"
		aria-modal="true"
		aria-labelledby="demo-notice-title"
		tabindex="-1"
		use:portal
		use:modal={{ onClose: closeNotice }}
		onclick={closeNotice}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events,a11y_no_noninteractive_element_interactions -->
		<div class="notice" role="document" onclick={(event) => event.stopPropagation()}>
			<img src="/Printers/G2/Logo.svg" alt="" class="logo" />
			<h2 id="demo-notice-title">{demoConfig.printerName}</h2>
			<p class="lead">
				This is <strong>GingerView</strong>, the interface of the Ginger G2 — running on a virtual
				printer in your browser.
			</p>
			<ul>
				<li>It does <strong>not</strong> control the G2 at the booth.</li>
				<li>Pick a file and start a print: it runs in accelerated time, a few minutes.</li>
				<li>Everything resets when you reload the page.</li>
			</ul>
			<button class="start" type="button" onclick={closeNotice}>Start exploring</button>
		</div>
	</div>
{/if}

<style>
	.demo-badge {
		position: fixed;
		top: calc(6px + env(safe-area-inset-top, 0px));
		right: 10px;
		z-index: 2900;
		padding: 3px 9px;
		border: none;
		border-radius: 999px;
		background: var(--color-red);
		color: var(--color-white);
		font: inherit;
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		box-shadow: var(--shadow-panel);
		cursor: pointer;
	}

	.time-chip {
		position: fixed;
		top: calc(6px + env(safe-area-inset-top, 0px));
		left: 50%;
		transform: translateX(-50%);
		z-index: 2900;
		padding: 3px 12px;
		border-radius: 999px;
		background: var(--color-black);
		color: var(--color-white);
		font-size: 0.72rem;
		font-weight: 700;
		white-space: nowrap;
		box-shadow: var(--shadow-panel);
		pointer-events: none;
	}

	.notice-overlay {
		position: fixed;
		inset: 0;
		z-index: 4000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
		background: rgba(var(--rgb-gray-mid), 0.3);
		backdrop-filter: blur(12px) saturate(130%);
		-webkit-backdrop-filter: blur(12px) saturate(130%);
	}

	.notice {
		width: min(380px, 100%);
		box-sizing: border-box;
		padding: 24px;
		border-radius: 16px;
		background: var(--color-white);
		box-shadow: var(--shadow-panel);
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}

	.logo {
		height: 34px;
		margin-bottom: 12px;
	}

	h2 {
		margin: 0 0 10px;
		font-size: 1.25rem;
		font-weight: 800;
		color: var(--color-black);
	}

	.lead {
		margin: 0 0 14px;
		font-size: 0.95rem;
		color: var(--color-text-muted);
	}

	ul {
		margin: 0 0 20px;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: 100%;
		text-align: left;
	}

	li {
		position: relative;
		padding: 9px 12px 9px 30px;
		border-radius: 8px;
		background: var(--color-background);
		font-size: 0.88rem;
		color: var(--color-text-muted);
	}

	li::before {
		content: '';
		position: absolute;
		left: 12px;
		top: 16px;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-red);
	}

	.start {
		width: 100%;
		padding: 12px;
		border: none;
		border-radius: 8px;
		background: var(--color-red);
		color: var(--color-white);
		font: inherit;
		font-size: 1rem;
		font-weight: 700;
		cursor: pointer;
	}

	.start:hover {
		background: var(--color-red-dark);
	}
</style>
