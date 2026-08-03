# 02 — Architettura

## Stack

| Livello          | Tecnologia                                                                         |
| ---------------- | ---------------------------------------------------------------------------------- |
| Framework        | SvelteKit 2 con **Svelte 5** (runes: `$state`, `$derived`, `$props`)               |
| Build            | Vite 7                                                                             |
| Adapter          | `@sveltejs/adapter-static` — output SPA in `build/`                                |
| Linguaggio       | TypeScript (`strict`)                                                              |
| Stili            | CSS scoped nei componenti + Tailwind CSS 4 per le utility                          |
| Icone            | `@mdi/js` (path SVG inline) e `lucide-svelte`                                      |
| Caroselli        | `embla-carousel-svelte`                                                            |
| Editor di codice | CodeMirror 6 — **solo** nel chunk di `/settings/config-editor`, pagina di sviluppo |
| Font             | Montserrat (importato da Google Fonts in `src/app.css`)                            |

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
│   ├── data/               dati generati da script (zone IANA, sagoma della mappa)
│   ├── editor/             modo CodeMirror per i `.cfg` Klipper (solo config editor)
│   ├── services/           accesso a Moonraker e a G2-Service
│   ├── stores/             stato condiviso (toast, directory corrente, context menu, movement)
│   └── types/              tipi TypeScript (config, klipper, print, network, service,
│                            update, timezone)
└── routes/                 rotte SvelteKit
    ├── +layout.svelte      shell applicativa: dock di navigazione, toast, notifier
    ├── +page.svelte        dashboard
    ├── movement/
    ├── filelist/
    └── settings/           + sottopagine network, console, update, log, history,
                              statistics, timezone, config-editor

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
- **`<EmergencyStopButton />`** — ultimo elemento della dock, staccato anche da Settings: non è
  una destinazione ma un comando. Rosso pieno mentre la macchina è in marcia, si inverte in un
  pulsante di firmware restart quando Kalico è fermo (vedi
  [04 — Emergency stop](04-moonraker.md#emergency-stop)).
- **`<KlipperDownOverlay />`** — avviso non chiudibile che copre le pagine operative quando Kalico
  è `shutdown`/`error`/`disconnected`. Si ferma sopra la dock (`bottom: 96px`) e non compare sotto
  `/settings`, così il pulsante che fa ripartire la macchina e le pagine diagnostiche restano
  raggiungibili (vedi [04 — Avviso a schermo](04-moonraker.md#avviso-a-schermo-quando-kalico-è-fermo)).

Tutte le pagine riservano `112px` di padding inferiore per non finire sotto la dock.

## Rotte

| Rotta                            | Componente principale                         | Note                                                                                                                                                                                                            |
| -------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                              | `DashboardCarousel` + `DashboardControlPanel` | 5 slide, parte dall'indice 2 (Job Info)                                                                                                                                                                         |
| `/movement`                      | `MovementCarousel`                            | 2 slide: `ToolheadPosition`, `ExtrudeDialog`                                                                                                                                                                    |
| `/filelist`                      | `PageContainer` → `PrintList`                 | Browser dei file G-code                                                                                                                                                                                         |
| `/settings`                      | elenco di voci                                | Alcune voci sono link esterni                                                                                                                                                                                   |
| `/settings/network`              | pagina completa                               | Unica sottopagina con logica propria oltre a console                                                                                                                                                            |
| `/settings/console`              | terminale G-code                              | WebSocket diretto verso Moonraker                                                                                                                                                                               |
| `/settings/log`                  | pagina completa                               | Download log + pulizia, non usa `SettingsSubpage` (vedi [04 — Moonraker](04-moonraker.md#log))                                                                                                                  |
| `/settings/update`               | pagina completa                               | Update manager di Moonraker: sistema e programmi, recovery, rollback (vedi [04 — Update manager](04-moonraker.md#update-manager))                                                                               |
| `/settings/timezone`             | pagina completa                               | `TimezoneMap` + `TimezoneSelect`. Unica pagina che non parla né con Moonraker né con un servizio reale: il salvataggio è un mock (vedi [04 — Servizio di rete](04-moonraker.md#servizio-di-rete-non-moonraker)) |
| `/settings/config-editor`        | pagina completa                               | Editor dei config: albero della root `config` + editor CodeMirror + riavvii. Pagina **di sviluppo**, nascosta da `CONFIG_EDITOR_ENABLED` (vedi [04 — Config editor](04-moonraker.md#config-editor))             |
| `/settings/{history,statistics}` | `SettingsSubpage`                             | Solo intestazione + "Coming soon"                                                                                                                                                                               |

### Breakpoint

Il bersaglio primario è **lo schermo di un telefono**: la macchina non ha display e l'utente si
collega dal proprio cellulare (vedi [01 — Panoramica](01-panoramica.md)). I breakpoint superiori
servono al tecnico che si collega dal portatile. Le soglie sono queste, elencate in testa a
[app.css](../src/app.css), e sono le uniche da usare nei componenti:

| Condizione                                | Significato                                                                   |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| `max-width: 767.98px`                     | Telefono in verticale: il caso reale                                          |
| `max-width: 1023.98px`                    | Due colonne affiancate non ci stanno più (config editor, dettagli di un file) |
| `min-width: 768px` e `min-height: 600px`  | Schermo grande: 3 slide in dashboard, 2 in movimento                          |
| `min-width: 1200px` e `min-height: 600px` | Schermo largo: 5 slide in dashboard, pallini di navigazione nascosti          |

Le soglie che decidono **quante slide** mostrare chiedono anche l'altezza perché la larghezza da
sola non distingue un telefono in orizzontale (~850×390) da un portatile: senza `min-height` un
telefono ruotato finiva sul layout a 3 o 5 pannelli su 390px di altezza. Le soglie `max` usano
`.98px` perché con il viewport a larghezza frazionaria (zoom del browser) `767`/`768` secchi
lascerebbero scoperta la fascia intermedia.

I valori intermedi che c'erano prima (480, 560, 640, 900, 980, 1199) erano arbitrari e su un
telefono erano tutti sempre veri, cioè non distinguevano niente.

Sotto i 768px non viene applicata nessuna scalatura globale: il
`zoom: 0.8` su `html` che c'era in `src/app.css` era un residuo dell'impostazione precedente,
pensata per un display fisso, ed è stato rimosso — su telefono rimpiccioliva testi e tocchi
senza motivo.

## Servizi (`src/lib/services/`)

| File                                                               | Ruolo                                                                                                                                                                                                             |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [config.ts](../src/lib/services/config.ts)                         | Singleton `configService` e helper `getMoonrakerApiUrl()`: risolve gli endpoint, con same-origin come default e le variabili `VITE_*` come override di sviluppo                                                   |
| [moonraker-notifier.ts](../src/lib/services/moonraker-notifier.ts) | Avvisi all'avvio da `/server/info` + WebSocket persistente per `notify_klippy_*` e warning runtime; espone gli store `klippyState` e `klippyMessage`                                                              |
| [moonraker-printer.ts](../src/lib/services/moonraker-printer.ts)   | Comandi della stampante non legati a una pagina: emergency stop e i tre riavvii (firmware/host/Moonraker), più `fetchPrinterInfo`, `fetchPrintState`, `waitForKlipperReady`                                       |
| [moonraker-zones.ts](../src/lib/services/moonraker-zones.ts)       | `loadNozzleZones()`: le zone riscaldate dell'ugello ricavate da `/printer/objects/list`, in cache finché non si chiede un riavvio                                                                                 |
| [moonraker-files.ts](../src/lib/services/moonraker-files.ts)       | Tutte le operazioni sui file: elenco, metadati, thumbnail, upload, sposta, elimina, crea cartella                                                                                                                 |
| [moonraker-config.ts](../src/lib/services/moonraker-config.ts)     | Config editor: albero della root `config`, lettura/scrittura/download dei file, `CONFIG_EDITOR_ENABLED`                                                                                                           |
| [moonraker-logs.ts](../src/lib/services/moonraker-logs.ts)         | Download dei log e rollover                                                                                                                                                                                       |
| [moonraker-update.ts](../src/lib/services/moonraker-update.ts)     | Update manager: stato, refresh, upgrade, recovery, rollback, WebSocket dell'output e helper per derivare lo stato di ogni componente                                                                              |
| [g2-service.ts](../src/lib/services/g2-service.ts)                 | Trasporto comune a tutte le API di G2-Service: prefisso `/service`, modello degli errori (`ServiceError`) e attesa dei job asincroni (`waitForJob`)                                                               |
| [network-api.ts](../src/lib/services/network-api.ts)               | Endpoint di rete di G2-Service: stato unificato WiFi/Ethernet, elenco reti, rescan e connessione (che è un job)                                                                                                   |
| [timezone.ts](../src/lib/services/timezone.ts)                     | Fuso orario di sistema via `GET`/`POST /service/timezone`, più tutto il calcolo locale — offset via `Intl`, formattazione (`formatZoneTime`, usata da tutti gli orari dell'interfaccia), ricerca sull'elenco IANA |

### Dati generati (`src/lib/data/`)

Due file **generati da [script/generate-timezone-data.mjs](../script/generate-timezone-data.mjs)**,
non scritti a mano: `timezones.ts` (le zone di `zone.tab`, con le coordinate della città di
riferimento) e `world-map.ts` (le terre emerse di Natural Earth come unico path SVG). Sono in
`.prettierignore` e vanno rigenerati con lo script, mai modificati direttamente — vedi
[05 — Sviluppo](05-sviluppo.md#dati-generati-fusi-orari-e-mappa).

## Store (`src/lib/stores/`)

- **`toastStore.ts`** — coda di notifiche tipizzate per `type` (`error`/`warning`/`info`/`success`)
  e `source` (`klipper`/`moonraker`/`network`/`system`). Massimo 20 toast visibili; durata di
  default per tipo, `duration: 0` significa persistente. API: `toastActions.error/warning/info/success`.
- **`directoryStore.ts`** — percorso corrente relativo alla root `gcodes`, con helper
  `navigateToDir`, `navigateUp`, `navigateToRoot`, `navigateToSegment`.
- **`contextMenuStore.ts`** — id del menu contestuale aperto, così che aprirne uno chiuda gli altri.
- **`timezoneStore.ts`** — fuso orario della **stampante**, letto una volta sola per sessione
  (`ensurePrinterTimezone()`, che condivide la stessa promise fra tutti i componenti che lo
  chiedono) e riscritto da `/settings/timezone` a ogni lettura o salvataggio
  (`setPrinterTimezone()`). Ogni orario dell'interfaccia — ETA della dashboard, timestamp della
  console, ora di reset del rate limit GitHub nella pagina Update — si formatta in questo fuso
  con `formatZoneTime()`. Finché il valore è `null` (non ancora arrivato, o G2-Service muto) si
  ripiega sul fuso del browser, che sul kiosk della macchina coincide. Le **durate** (tempo
  trascorso, tempo residuo) non passano di qui: sono differenze, e un fuso non le cambia.
- **`movementStore.ts`** — stato della pagina Movement che deve **sopravvivere alla pagina**:
  parametri di estrusione selezionati (`extrudeAmount`, `extrudeSpeed`, `extrudeTemperature`,
  `customTemperaturePreset`), fase corrente (`extrudePhase`) e flag `homingBusy`. Le due sequenze
  — `startHoming()` e `startExtrudeSequence()` — girano qui e non nel componente, perché entrambe
  le slide vengono smontate appena si cambia pagina e un'estrusione passa la maggior parte del
  tempo a scaldare: tenerle nel componente faceva ritrovare il pulsante "EXTRUDE" inattivo e i
  parametri di default al ritorno. `homingBusy` è unico per entrambe le origini del `G28`, così il
  pulsante Home segnala qualsiasi homing in corso.

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

Il carosello non è l'unico posto: **anche la dock** crea un containing block, perché è centrata
con `transform: translateX(-50%)`. Per questo `ConfirmModal` porta il `use:portal` al proprio
interno — la conferma del firmware restart nasce dentro `<nav class="dock">` e senza portale
verrebbe posizionata rispetto alla dock invece che al viewport. La regola generale è: se un
overlay `position: fixed` può finire dentro un antenato con `transform`, `filter` o
`backdrop-filter`, va portalizzato.
