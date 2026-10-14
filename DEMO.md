# GingerView — Demo per fiera

## Obiettivo

In fiera mostriamo GingerView senza una stampante collegata. Il visitatore scansiona un QR code,
apre un sito pubblico e usa l'interfaccia come se controllasse una G2 vera: dashboard, temperature,
movimenti, lista file, avvio stampa, storico, impostazioni.

## Organizzazione del lavoro

- Questa cartella (`GingerView-demo/`) è una **copia** del repo `gingeradditive/GingerView`.
  Il repo è lo stesso di `GingerView/`: la copia serve solo a lavorare in parallelo senza
  intralciare commit e modifiche sullo sviluppo principale.
- Lo sviluppo della demo avviene su un **branch dedicato** (es. `demo/fiera`), mai su `main`.
- `GingerView/` resta la cartella di lavoro per `main` (bugfix e sviluppo normale).

### Regole per il codice della demo (deciso)

Si lavora nel branch, ma il codice è scritto per poter un giorno entrare in `main` dietro flag:

- tutto il codice nuovo in `src/lib/demo/`;
- attivazione solo con `VITE_DEMO=1`; senza flag il simulatore non entra nella build;
- il simulatore intercetta `fetch` e `WebSocket` dall'esterno, senza modificare i service;
- modifiche ai componenti esistenti ridotte al minimo indispensabile (es. banner demo);
- dopo la fiera si decide se portarlo su `main` o lasciarlo nel branch.

### Attenzione

- Il workflow `build-commit-push.yml` gira a ogni push su `main` e committa `build/`, che è ciò
  che scaricano le stampanti. Nessun commit della demo deve finire su `main`.
- Periodicamente conviene fare `git merge main` (o rebase) nel branch demo per tenerlo allineato
  alle novità dell'interfaccia.

## Come funziona oggi GingerView (punti da simulare)

GingerView è un'app SvelteKit statica (`adapter-static`) che parla con la stampante tramite:

- **WebSocket Moonraker** (`/websocket`): `moonraker-subscription.ts`, `moonraker-notifier.ts`,
  `moonraker-update.ts`. L'URL viene derivato da `window.location.host` in `services/config.ts`.
- **REST Moonraker** (`/printer/...`, `/server/...`, `/machine/...`): file, history, statistiche,
  config, update, zone, gcode.
- **G2-Service** (`g2-service.ts`), **rete** (`network-api.ts`), **USB** (`usb-api.ts`).

Per la demo serve un **backend finto** che risponda a tutte queste chiamate.

## Approccio (deciso)

**Mock lato client, tutto nel browser.** Ogni visitatore ha la sua stampante simulata, isolata
dalle altre; nessuna esperienza condivisa tra visitatori. Un modulo `src/lib/demo/` che:

1. Intercetta `fetch` e `WebSocket` (sostituzione globale attivata da un flag di build, es.
   `VITE_DEMO=1`) e risponde con dati finti invece di contattare la rete.
2. Contiene un **simulatore di stampante** minimale: temperature che salgono verso il target,
   posizione assi che si aggiorna con i comandi di movimento, avanzamento di una stampa finta,
   lista file con miniature, storico precompilato.
3. Invia aggiornamenti periodici (`notify_status_update`) come farebbe Moonraker.

Vantaggi: nessun server da mantenere, ogni visitatore ha la sua "stampante" isolata, si
pubblica come sito statico (GitHub Pages, Netlify, Cloudflare Pages), funziona anche con
rete della fiera instabile dopo il primo caricamento. Le modifiche ai componenti di GingerView
restano minime, quindi il merge da `main` resta semplice.

Alternativa scartata (per ora): un finto Moonraker lato server (Node/Python). È più fedele, ma
richiede hosting, stato condiviso tra visitatori (uno preme "stop" e lo vedono tutti) e
manutenzione.

## Esperienza del visitatore (deciso)

- **Protagonista: il wizard di avvio stampa** (`PrintStartWizard.svelte`), che è la vera novità.
  Il percorso da curare è: lista file → dettagli file → wizard → stampa avviata in dashboard.
- **Stato iniziale: stampante ferma**, a temperatura ambiente. Il visitatore è libero di esplorare.
- **Fase 1 (ora, tempi stretti): demo libera**, senza guide.
- **Fase 2 (se c'è tempo prima della fiera): schermata di benvenuto con guide/missioni di
  orientamento** (es. "avvia la tua prima stampa"). Il simulatore va progettato per poterle
  aggiungere dopo senza riscriverlo (eventi/stato osservabili).

## File di stampa (deciso)

- Giacomo fornisce file di stampa **veri** della G2.
- Dal gcode si estraggono solo **miniature e metadati** (tempo stimato, materiale/peso,
  dimensioni, slicer): il gcode completo non viene pubblicato.
- **Durata massima di ogni stampa demo: 5 minuti, riscaldamento compreso.** È una demo, non
  una simulazione fedele: tempi e fisica sono compressi a favore dell'esperienza.

### Tempi mostrati (deciso)

- Dettagli file e storico mostrano i **tempi reali** (es. 14 h): sono credibili e sono anche
  un'informazione commerciale.
- Durante la stampa l'orologio è **accelerato**: il tempo rimanente scende velocemente, con
  un'etichetta visibile "⏩ tempo accelerato".
- Ripartizione indicativa: ~45–60 s di riscaldamento (temperature che salgono visibilmente),
  poi la stampa con avanzamento, layer e posizione assi che si muovono.
- Durata proporzionale al tempo reale, tra un minimo di ~2 min e il massimo di 5 min
  (default proposto, da confermare).

## Contesto fiera

- **Formnext** (Francoforte, metà novembre 2026, date da verificare): fiera di settore
  sull'additive manufacturing, pubblico tecnico e internazionale.
- L'interfaccia di GingerView è già in inglese: adatta al pubblico.
- Allo stand ci sarà la **nuova G2 vera**, che usa GingerView.
- **La demo è uno showcase**: GingerView è una delle novità rispetto ai competitor, che usano
  Mainsail. L'obiettivo è far toccare con mano l'interfaccia, non raccogliere contatti.
- **Raccolta contatti / call to action: fuori scope per ora.** Eventualmente si rivaluta più
  avanti (es. invito a fine stampa verso stand o pagina contatti).

## Funzioni e pagine (deciso)

- Per ora **tutte le funzioni restano visibili** e vanno supportate dal simulatore almeno in
  modo credibile (Update, Network, Config editor, Console, Log, Timezone, Storico,
  Statistiche, USB, riavvii).
- Cosa nascondere, togliere o bloccare (funzioni non pronte, azioni prive di senso in demo) si
  decide **in corso d'opera**. Conviene quindi prevedere un punto unico di configurazione
  della demo (es. elenco di pagine/azioni nascoste o bloccate) per cambiarlo velocemente.

## Pubblicazione (deciso)

- **Hosting statico con CDN** (server in Europa), deploy automatico a ogni push sul branch della
  demo; `main` e le stampanti non sono coinvolti.
- Vincolo: la rete in fiera è scarsa e molti visitatori sono in roaming, quindi il primo
  caricamento deve essere leggero (miniature ottimizzate, eventuale cache offline).
- **Provider: Cloudflare Pages** (account aziendale già esistente). Gestisce nativamente il
  fallback SPA (`index.html`) e crea URL di anteprima per ogni push.
- **URL: https://gingerview-demo.pages.dev** (dominio di default di Cloudflare Pages, nessun
  sottodominio aziendale). Il QR punta a questo indirizzo.
- Progetto Pages `gingerview-demo` (Pages classico, non Worker), branch di produzione
  `demo/fiera`. **Il deploy è automatico**: a ogni push su `demo/fiera` il workflow
  `.github/workflows/deploy-demo.yml` compila e pubblica con wrangler (upload diretto, il
  progetto non è "Git connected" su Cloudflare e non serve che lo sia).
- Il workflow usa i secret del repo `CLOUDFLARE_API_TOKEN` (permesso Account → Cloudflare
  Pages → Edit) e `CLOUDFLARE_ACCOUNT_ID`. Se il token viene revocato o scade, il deploy si
  ferma: va rigenerato e aggiornato il secret.
- Deploy manuale (se serve):

  ```sh
  BUILD_DIR=build-demo npm run build
  npx wrangler pages deploy build-demo --project-name gingerview-demo --branch demo/fiera
  ```

- PR di tracciamento (draft, **da non mergiare**): gingeradditive/GingerView#7.
- La build della demo va in `build-demo/` (ignorata da git, scelta con `BUILD_DIR` in
  `svelte.config.js`): `build/` è tracciata ed è ciò che scaricano le stampanti.

## Demo vs stampante vera (deciso)

Con la G2 vera allo stand, il visitatore non deve pensare di controllarla (né credere che
l'interfaccia sia rotta perché la macchina non si muove). La stampante della demo è una
"gemella" virtuale:

- **avviso al primo accesso**, chiudibile con un tap: "Virtual G2: this demo doesn't control
  the printer at the booth" (nella fase 2 confluisce nella schermata di benvenuto);
- **barra "DEMO" fissa in alto** (nera a strisce, filo rosso), volutamente diversa dal resto
  dell'interfaccia: riapre l'avviso e durante la stampa mostra il tempo accelerato;
- **nome stampante** simulata del tipo "G2 · Virtual".

## Analytics (deciso)

- **Cloudflare Web Analytics**: gratuito, senza cookie (nessun banner privacy), attivabile da
  Cloudflare Pages. Misura le visite (giorno, paese, dispositivo, pagine viste).
- **Contatori di eventi** (wizard aperto, stampa avviata, stampa completata) tramite una piccola
  Cloudflare Worker senza dati personali: **extra**, solo se avanza tempo.

## Pianificazione

- **Team**: Giacomo + Claude.
- **QR stampati internamente**: nessuna scadenza tipografica, l'URL può essere deciso anche tardi.
- **Congelamento**: 3–4 giorni prima della partenza per la fiera non si pubblica più nulla;
  solo test finale su più telefoni (iPhone e Android), anche con rete mobile scarsa.

| Tappa | Contenuto                                                                              |
| ----- | -------------------------------------------------------------------------------------- |
| 1     | ✅ Branch `demo/fiera`, deploy su Cloudflare Pages, URL attivo                         |
| 2     | ✅ Simulatore base: stato stampante, temperature, movimenti, dashboard viva            |
| 3     | ✅ Percorso lista → dettagli → wizard → stampa accelerata (file G2 veri da fornire)    |
| 4     | ✅ Altre pagine credibili, avviso + barra demo, file di configurazione nascondi/blocca |
| 5     | 🟡 Test automatici fatti (Chromium, WebKit, 3G); mancano telefoni veri → congelamento  |
| 6     | _(Extra)_ Benvenuto con missioni, contatori di eventi                                  |

## Cose da decidere / adattare per la demo

- **Reset dello stato** (fatto): al ricaricamento si riparte dalla stampante ferma. Reset per
  inattività non fatto, vedi DEMO-DOMANDE.md.
- **Solo smartphone verticale**: è il dispositivo con cui arriveranno dal QR.
- **QR**: punta a https://gingerview-demo.pages.dev (deciso, vedi Pubblicazione).

## Come è fatta la demo (codice)

Tutto il codice della demo è in `src/lib/demo/`; fuori ci sono solo due agganci:
`src/hooks.client.ts` installa il simulatore e `src/routes/+layout.svelte` monta
`DemoLayer.svelte`, entrambi solo con `VITE_DEMO=1`. Senza il flag la build è
identica a quella delle stampanti (verificato: nessuna traccia della demo nel bundle).

| File                     | Cosa fa                                                                    |
| ------------------------ | -------------------------------------------------------------------------- |
| `config.ts`              | **Punto unico di configurazione**: tempi, pagine nascoste, azioni bloccate |
| `index.ts`               | Sostituisce `fetch` e `WebSocket` verso la stampante                       |
| `http.ts`                | Risposte REST di Moonraker e G2-Service                                    |
| `socket.ts`              | WebSocket JSON-RPC: sottoscrizioni, notifiche differenziali, console       |
| `printer.ts`             | La G2 simulata: temperature, movimenti, G-code, stampa accelerata          |
| `storage.ts`             | Root `gcodes`, `config`, `logs` in memoria                                 |
| `history.ts`             | Storico precompilato (tempi reali) + stampe del visitatore                 |
| `data/`                  | Rete, fuso, USB, sistema, aggiornamenti, config ridotta, log               |
| `events.ts`              | Eventi osservabili (`print:start`, `print:complete`…) per le missioni      |
| `DemoLayer.svelte`       | Avviso al primo accesso, barra DEMO con il tempo accelerato                |
| `files/`                 | Catalogo dei file (metadati + miniature), generato dallo script            |
| `tools/import-gcode.mjs` | Aggiunge G-code veri: estrae metadati e miniatura, non pubblica il G-code  |

Comandi:

```sh
VITE_DEMO=1 npm run dev                                   # demo in locale
node src/lib/demo/tools/import-gcode.mjs --reset *.gcode  # sostituisce i file della demo
```

Lo stato vive in memoria: ricaricando la pagina si riparte dalla stampante ferma.

## Domande aperte

Vedi [DEMO-DOMANDE.md](DEMO-DOMANDE.md): domande, default scelti e segnalazioni emerse
durante le tappe 2–5.
