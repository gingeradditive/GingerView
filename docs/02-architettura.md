# 02 — Architettura

## Stack

| Livello | Tecnologia |
|---|---|
| Framework | SvelteKit 2 con **Svelte 5** (runes: `$state`, `$derived`, `$props`) |
| Build | Vite 7 |
| Adapter | `@sveltejs/adapter-static` — output SPA in `build/` |
| Linguaggio | TypeScript (`strict`) |
| Stili | CSS scoped nei componenti + Tailwind CSS 4 per le utility |
| Icone | `@mdi/js` (path SVG inline) e `lucide-svelte` |
| Caroselli | `embla-carousel-svelte` |
| Font | Montserrat (importato da Google Fonts in `src/app.css`) |

Sono presenti anche `@mui/material` ed `@emotion/*` tra le dipendenze, ma **non sono usati**
dal codice Svelte: vedi [07 — Stato attuale](07-stato-attuale.md#dipendenze-react-da-rimuovere).

## Modalità di rendering

In [svelte.config.js](../svelte.config.js) l'adapter statico è configurato con
`fallback: 'index.html'`: il risultato è una **single-page application** pura, senza SSR e
senza prerendering per rotta. Nginx serve sempre `index.html` e il routing avviene lato client.

Conseguenza pratica: **non esiste codice server-side**. Ogni chiamata a Moonraker parte dal
browser dell'utente, quindi la raggiungibilità degli endpoint va valutata dal punto di vista
del browser, non della stampante (vedi [03 — Configurazione](03-configurazione.md)).

**Attenzione in sviluppo:** questo vale per la build di produzione. `vite dev` invece esegue
comunque **SSR per-richiesta** (comportamento di SvelteKit, indipendente dall'adapter — riguarda
solo l'output finale). Un refresh diretto su una rotta (F5) passa quindi dal "server" Node anche
in locale, mentre la navigazione client-side no. Codice che tocca `window`/`document` fuori da
`onMount` va in errore **solo al refresh diretto**, il che lo rende facile da non notare. Occhio
in particolare a `onDestroy`: a differenza di `onMount` (no-op lato server), **viene eseguito
anche in SSR** — vedi la guardia `typeof window !== 'undefined'` aggiunta in
[ToolheadPosition.svelte](../src/lib/components/ToolheadPosition.svelte) dopo un 500 riprodotto
così.

## Struttura del repository

```
src/
├── app.css                 stili globali, palette, font
├── app.html                shell HTML
├── lib/
│   ├── actions/            azioni Svelte riusabili (`portal`)
│   ├── assets/             favicon
│   ├── components/         componenti UI (dashboard, file list, dialoghi, toast)
│   ├── services/           accesso a Moonraker e al servizio di rete
│   ├── stores/             stato condiviso (toast, directory corrente, context menu)
│   └── types/              tipi TypeScript (config, klipper, print, wifi)
└── routes/                 rotte SvelteKit
    ├── +layout.svelte      shell applicativa: dock di navigazione, toast, notifier
    ├── +page.svelte        dashboard
    ├── movement/
    ├── filelist/
    └── settings/           + sottopagine network, console, update, log, history,
                              statistics, timezone

script/                     script bash di build, dev, installazione, aggiornamento
static/                     asset serviti così come sono (icone SVG, logo, thumbnail di errore)
build/                      output della build — committato nel repo (vedi doc 06)
```

## Shell applicativa

[src/routes/+layout.svelte](../src/routes/+layout.svelte) definisce ciò che è sempre presente:

- **`<ToastContainer />`** — rendering delle notifiche.
- **`<MoonrakerNotifier />`** — componente senza UI: all'avvio interroga `/server/info` e apre
  un WebSocket per intercettare avvisi ed errori di Klipper/Moonraker.
- **Dock di navigazione** — barra fissa in basso, centrata, con effetto vetro
  (`backdrop-filter: blur`). Contiene logo, Dashboard, Movement, FileList e, staccato a
  destra, Settings. La voce attiva è evidenziata dal bordo rosso Ginger `#D72E28`.

Tutte le pagine riservano `112px` di padding inferiore per non finire sotto la dock.

## Rotte

| Rotta | Componente principale | Note |
|---|---|---|
| `/` | `DashboardCarousel` + `DashboardControlPanel` | 5 slide, parte dall'indice 2 (Job Info) |
| `/movement` | `MovementCarousel` | 2 slide: `ToolheadPosition`, `ExtrudeDialog` |
| `/filelist` | `PageContainer` → `PrintList` | Browser dei file G-code |
| `/settings` | elenco di voci | Alcune voci sono link esterni |
| `/settings/network` | pagina completa | Unica sottopagina con logica propria oltre a console |
| `/settings/console` | terminale G-code | WebSocket diretto verso Moonraker |
| `/settings/log` | pagina completa | Download log + pulizia, non usa `SettingsSubpage` (vedi [04 — Moonraker](04-moonraker.md#log)) |
| `/settings/update` | pagina completa | Update manager di Moonraker: sistema e programmi, recovery, rollback (vedi [04 — Update manager](04-moonraker.md#update-manager)) |
| `/settings/{history,statistics,timezone}` | `SettingsSubpage` | Solo intestazione + "Coming soon" |

I caroselli sono responsive: la dashboard mostra 1 slide sotto 768px, 3 fino a 1199px e
tutte e 5 sopra i 1200px, nascondendo i pallini di navigazione in quest'ultimo caso.

Il bersaglio primario è però **lo schermo di un telefono**: la macchina non ha display e
l'utente si collega dal proprio cellulare (vedi [01 — Panoramica](01-panoramica.md)). Il
ramo sotto 768px è quindi quello che conta davvero; i breakpoint superiori servono al tecnico
che si collega dal portatile. In `src/app.css` sotto 768px viene applicato `zoom: 0.8`, che è
un residuo dell'impostazione precedente da rivedere.

## Servizi (`src/lib/services/`)

| File | Ruolo |
|---|---|
| [config.ts](../src/lib/services/config.ts) | Singleton `configService` e helper `getMoonrakerApiUrl()`: risolve gli endpoint, con same-origin come default e le variabili `VITE_*` come override di sviluppo |
| [klipper-websocket.ts](../src/lib/services/klipper-websocket.ts) | Classe `KlipperWebSocketService` con store `connectionStatus` e `klipperStatus`, riconnessione con backoff lineare (max 5 tentativi). Codice morto, da rimuovere: vedi [07](07-stato-attuale.md#codice-morto-da-rimuovere) |
| [moonraker-notifier.ts](../src/lib/services/moonraker-notifier.ts) | Avvisi all'avvio da `/server/info` + WebSocket persistente per `notify_klippy_*` e warning runtime |
| [moonraker-files.ts](../src/lib/services/moonraker-files.ts) | Tutte le operazioni sui file: elenco, metadati, thumbnail, upload, sposta, elimina, crea cartella |
| [moonraker-logs.ts](../src/lib/services/moonraker-logs.ts) | Download dei log e rollover |
| [moonraker-update.ts](../src/lib/services/moonraker-update.ts) | Update manager: stato, refresh, upgrade, recovery, rollback, WebSocket dell'output e helper per derivare lo stato di ogni componente |
| [network-api.ts](../src/lib/services/network-api.ts) | Client per il servizio Wi-Fi esterno (`/api/wifi/*`), con classe d'errore dedicata `NetworkAPIError` |

## Store (`src/lib/stores/`)

- **`toastStore.ts`** — coda di notifiche tipizzate per `type` (`error`/`warning`/`info`/`success`)
  e `source` (`klipper`/`moonraker`/`network`/`system`). Massimo 20 toast visibili; durata di
  default per tipo, `duration: 0` significa persistente. API: `toastActions.error/warning/info/success`.
- **`directoryStore.ts`** — percorso corrente relativo alla root `gcodes`, con helper
  `navigateToDir`, `navigateUp`, `navigateToRoot`, `navigateToSegment`.
- **`contextMenuStore.ts`** — id del menu contestuale aperto, così che aprirne uno chiuda gli altri.

## Pattern ricorrenti

**Polling con `onMount`.** Quasi tutti i pannelli della dashboard seguono lo stesso schema:

```ts
onMount(() => {
    update();
    const interval = window.setInterval(update, pollIntervalMs);
    return () => window.clearInterval(interval);
});
```

Gli intervalli sono definiti componente per componente (1000–3000 ms); l'elenco completo è in
[04 — Integrazione Moonraker](04-moonraker.md#frequenze-di-polling).

**Base URL condivisa.** I componenti importano `getMoonrakerApiUrl()` da
`$lib/services/config` e concatenano il percorso:

```ts
const response = await fetch(`${getMoonrakerApiUrl()}/printer/objects/query?print_stats`);
```

In produzione l'helper restituisce la **stringa vuota**, quindi la richiesta parte come
`/printer/objects/query?...` sull'origine della pagina. Non va reintrodotto un fallback tipo
`?? 'http://localhost:7125'`: annullerebbe il funzionamento same-origin descritto in
[03 — Configurazione](03-configurazione.md).

**Eventi DOM come bus.** Dopo eliminazione, spostamento o rinomina di un file,
`PrintCard` emette `window.dispatchEvent(new CustomEvent('moonraker-file-deleted'))` e
`PrintList` ricarica la directory. È un canale di comunicazione tra componenti non parenti che
non passa dagli store.

**Errori come toast.** I servizi non propagano errori all'interfaccia: chiamano
`toastActions.error(...)` e poi rilanciano (o restituiscono `null`). I componenti della
dashboard, al contrario, ignorano silenziosamente i fallimenti di polling con `catch {}`, per
non riempire lo schermo di toast quando la stampante è offline.

**Modali dentro `MovementCarousel`: `use:portal`.** Embla applica un `transform` inline al
proprio track per l'animazione dello slide, il che crea un nuovo containing block per qualsiasi
discendente `position: fixed`. Una modale dentro `ToolheadPosition` o `ExtrudeDialog` che usasse
`position: fixed; inset: 0` senza precauzioni verrebbe quindi ritagliata/posizionata rispetto al
carosello invece che al viewport reale. [portal.ts](../src/lib/actions/portal.ts) risolve il
problema spostando il nodo overlay dentro `<body>` al mount e rimuovendolo al destroy; va
applicato con `use:portal` a qualunque overlay `position: fixed` renderizzato dentro il
carosello (già usato da `HomingWarningModal`, `PrintStartWizard` e dal popup di temperatura
custom in `ExtrudeDialog`).
