# 07 — Stato attuale e limiti noti

Fotografia del progetto al **3 agosto 2026**, branch `graphics-fixes`, dopo la riscrittura
dell'installer, il passaggio a same-origin, l'implementazione di homing/estrusione/avvio
stampa guidati, delle pagine Log, Update, Timezone e Config editor, e il passaggio di rete e
fuso orario alle API di G2-Service. Serve a evitare che si perda tempo su cose già note o si
scambi un segnaposto per un bug.

## Funzionalità complete

- Dashboard, in sola lettura: temperature, flusso, altezza Z, pellet, info job, avanzamento, ETA.
- Controlli di stampa: pausa, resume, cancel.
- Ventola e luce (`LED_CAMERA`) con popup a slider.
- Browser file: navigazione cartelle, thumbnail, metadati, upload, crea cartella, rinomina,
  sposta, elimina.
- Impostazioni rete: stato unificato Wi-Fi/Ethernet, elenco reti e nuova scansione,
  connessione (anche a una rete nascosta) seguita come job asincrono. Parla con G2-Service,
  vedi [04 — G2-Service](04-moonraker.md#g2-service-non-moonraker).
- Console G-code con cronologia comandi.
- Pagina Log (`/settings/log`): download di `klippy.log`, `moonraker.log`, `crowsnest.log` e
  pulsante per pulire (rollover) i log di Klipper e Moonraker in un colpo solo, senza chiedere
  quale — vedi [04 — Moonraker](04-moonraker.md#log). Crowsnest non ha un meccanismo di
  rollover lato Moonraker, quindi il suo log non viene mai pulito da qui.
- Pagina Update (`/settings/update`): elenco dei componenti registrati nell'update manager di
  Moonraker (compreso `system`, cioè i pacchetti del sistema operativo) con versione e stato,
  check update, **Update all**, soft/hard recovery sui repo che Moonraker segnala come rotti, e
  log live dell'operazione in una modale a terminale. Se l'aggiornamento tocca GingerView stesso
  la pagina si ricarica da sola a fine operazione, dopo un countdown di 5 secondi, altrimenti la
  scheda continuerebbe a eseguire il bundle vecchio. Volutamente **non** ci sono aggiornamenti
  per singolo componente, rollback, né un pannello espandibile coi dettagli: vedi
  [04 — Update manager](04-moonraker.md#update-manager).
- Pagina Timezone (`/settings/timezone`): mappa del mondo con la fascia oraria selezionata
  evidenziata e un segnaposto sulla città, orologio e data della zona aggiornati al secondo, e
  tendina con ricerca sulle 419 zone IANA (le 418 di `zone.tab` più `UTC`). Lettura e
  salvataggio passano da `GET`/`POST /service/timezone` di G2-Service. Il fuso scelto **decide
  come si leggono tutti gli orari dell'interfaccia** (ETA in dashboard, timestamp della console,
  ora di reset del rate limit GitHub): sono istanti assoluti scritti nell'ora della macchina, non
  in quella del telefono che guarda — vedi
  [02 — Store](02-architettura.md#store-srclibstores).
- Pagina Config editor (`/settings/config-editor`): equivalente dell'editor dei config di
  Mainsail — albero della root `config` con cartelle e sottocartelle espandibili a richiesta,
  apertura in modifica, salvataggio, crea file, crea cartella, upload, rinomina, elimina,
  download — più i tre riavvii (firmware, host, Moonraker), suggeriti dopo il salvataggio e
  lanciabili a mano. L'editor è **CodeMirror 6** con evidenziazione della sintassi Klipper
  (sezioni, chiavi, commenti, blocchi `gcode:` con G-code e Jinja), numeri di riga, undo e
  ricerca. Vedi [04 — Config editor](04-moonraker.md#config-editor) e
  [04 — Riavvii](04-moonraker.md#riavvii). **È una pagina di sviluppo**, vedi più sotto.
- Sistema di notifiche toast collegato agli eventi Klipper/Moonraker.
- Emergency stop nella dock ([EmergencyStopButton.svelte](../src/lib/components/EmergencyStopButton.svelte)):
  `POST /printer/emergency_stop` senza conferma da qualunque pagina, e a Kalico fermo
  (`shutdown`/`error`) lo stesso tasto si inverte e propone il firmware restart, dietro conferma,
  attendendo il ritorno di Klippy con `waitForKlipperReady()`. Vedi
  [04 — Emergency stop](04-moonraker.md#emergency-stop). **Non ancora provato su hardware reale**
  (`UI-8`).
- Avviso a schermo quando Kalico è fermo
  ([KlipperDownOverlay.svelte](../src/lib/components/KlipperDownOverlay.svelte)): su dashboard,
  file e movimento compare un riquadro **non chiudibile** con lo stato (`shutdown`/`error`/
  `disconnected`) e il `state_message` di Klippy. Si ferma sopra la dock e non compare sotto
  `/settings`, quindi né la navigazione né le pagine diagnostiche vengono bloccate. Vedi
  [04 — Avviso a schermo](04-moonraker.md#avviso-a-schermo-quando-kalico-è-fermo). **Non ancora
  provato su hardware reale** (`UI-8`).
- Avviso di dati non aggiornati
  ([StaleDataBanner.svelte](../src/lib/components/StaleDataBanner.svelte)): dopo due poll persi
  di fila da un qualsiasi pannello compare una pillola in alto che dice da quanto i valori a
  schermo sono fermi, e sparisce da sola alla prima risposta buona. Sta zitta quando Kalico è
  fermo, perché lì parla già `KlipperDownOverlay`. Vedi
  [04 — Dati non aggiornati](04-moonraker.md#dati-non-aggiornati). **Non ancora provato su
  hardware reale.**
- Avvio stampa dal popup dettagli file: il pulsante **Print** apre
  [PrintStartWizard.svelte](../src/lib/components/PrintStartWizard.svelte), un wizard a 4 step
  (procedi/cancel) — materiale/tubi, ugello/bed, spray protettivo piano, aspiratore/valvola
  dryer — e solo all'ultimo step invia `POST /printer/print/start?filename=...`, poi torna
  sulla dashboard (`goto('/')`).

## Segnaposto

### Sottopagine "Coming soon"

`/settings/history` e `/settings/statistics` sono due righe che istanziano `SettingsSubpage`
senza contenuto. La voce è nel menu, la rotta esiste, la funzionalità no. Sono considerate
"roba vecchia da rifare", non solo da riempire (Q28). `/settings/log`, `/settings/update`,
`/settings/timezone` e `/settings/config-editor` sono usciti da questo elenco: vedi
"Funzionalità complete" sopra.

Indicazioni già raccolte:

- **History** e **Statistics** restano da progettare.

### Webcam assente

Le macchine hanno una camera e G2-OS include già **Crowsnest**, quindi lo stream esiste lato
macchina. GingerView non lo mostra da nessuna parte e `install.sh` non configura il proxy
`/webcam/`. Dove inserirla nell'interfaccia è ancora da decidere (Q11).

### La pagina Movement non muove ancora del tutto

- [ToolheadPosition.svelte](../src/lib/components/ToolheadPosition.svelte) **legge** la
  posizione da `/printer/objects/query` e la disegna in proiezione isometrica. Il pulsante
  **Disable Motors** invia `M84` (`POST /printer/gcode/script?script=M84`) ed è disabilitato,
  con etichetta "Motors Disabled", quando `stepper_enable.steppers` riporta tutti gli stepper
  spenti. Il pulsante **Home** apre prima [HomingWarningModal.svelte](../src/lib/components/HomingWarningModal.svelte)
  (verifica ugello pulito / bed libero) e solo alla conferma invia `G28`; mentre il comando è in
  corso è disabilitato e l'etichetta diventa "Homing...", come fa il pulsante Extrude con le
  proprie fasi. Segnala anche l'homing avviato dalla sequenza di estrusione, perché lo stato è
  condiviso in [movementStore.ts](../src/lib/stores/movementStore.ts).
- [ExtrudeDialog.svelte](../src/lib/components/ExtrudeDialog.svelte) ha tre selettori: quantità
  (Low/Mid/High → 1000/10000/20000 mm³), velocità (Slow/Standard/Boost → 50/150/250 mm³/s) e
  temperatura (PETG/PLA/Custom). I preset temperatura coprono tutte le zone dell'ugello
  (vedi nota sotto) e portano anche un `rotation_distance` non mostrato in interfaccia
  (PETG 450, PLA e Custom 330); PETG tiene la prima zona più fredda delle altre (200 contro
  220), PLA è piatto. "Custom" apre un popup con un campo °C **per ciascuna zona che la
  macchina dichiara**. Il pulsante **Extrude** ora esegue davvero una sequenza,
  mostrando la fase in corso come testo del pulsante (disabled nel frattempo): stesso popup di
  avvertimento homing → `G28` → spostamento al centro X, Y0, Z250 → `SET_HEATER_TEMPERATURE` +
  `TEMPERATURE_WAIT` su tutte le zone → `SET_EXTRUDER_ROTATION_DISTANCE` + `G1 E<volume>` relativo.
  L'ultimo passaggio è **non verificato su hardware reale** (Q32 in [Q&A.md](Q&A.md)): presuppone
  che il `rotation_distance` dell'estrusore reale sia calibrato in mm³/rotazione per materiale.
  Parametri selezionati e fase in corso stanno in [movementStore.ts](../src/lib/stores/movementStore.ts),
  non nel componente: si può andare sulla dashboard a controllare le temperature mentre scalda e
  tornare indietro ritrovando "Heating..." e le proprie scelte. Se un comando viene rifiutato la
  sequenza si ferma lì e lo dice con un toast (vedi
  [04 — Comandi G-code](04-moonraker.md#comandi-g-code)); i riscaldatori già impostati restano
  però al target, e a spegnerli è solo l'`idle_timeout` di Kalico.

Il pulsante **Move** non ha ancora un bersaglio (Q6).

### Il calcolo del pellet non ha fondamento fisico

[DashboardPelletPanel.svelte](../src/lib/components/DashboardPelletPanel.svelte) ricava i
chilogrammi consumati da `print_stats.filament_used` assumendo **filamento da 1.75 mm e
densità PLA 1.24 g/cm³**. La macchina è a pellet: quel calcolo è un segnaposto. Kalico espone
le grandezze in filamento virtuale e serve una formula di riconversione, ancora da definire
(Q1 in [Q&A.md](Q&A.md)).

Anche `maxPelletKg = 5` è hardcoded: è la capienza della G2, ma va parametrizzata per modello,
il che presuppone che l'applicazione sappia su quale macchina gira (Q26).

### Le zone dell'ugello sono presentate come estrusori

`extruder`, `extruder1`, … non sono utensili distinti: sono le **zone riscaldate dell'unico
ugello** (quattro sulla G2, tre sulla G1). Quante siano non è più scritto nel codice —
`DashboardTemperaturePanel`, il popup "Custom temperature" e la sequenza di estrusione partono
tutti dall'elenco che [moonraker-zones.ts](../src/lib/services/moonraker-zones.ts) ricava da
`/printer/objects/list`, quindi una G1 mostra tre zone senza toccare niente (vedi
[04 — Gli "estrusori" sono zone di un solo ugello](04-moonraker.md#gli-estrusori-sono-zone-di-un-solo-ugello)).

Resta la presentazione: le card sono numerate 1..n e non hanno etichette. Su Q27 la risposta è
di **lasciarla così**, perché senza etichette è già leggibile visivamente.

Finché la macchina non risponde le card non vengono disegnate: il numero di zone non si
indovina. Il bed viene letto comunque, quindi il pannello non resta vuoto, e il polling
riprova a ogni giro.

In dashboard restano **in sola lettura**: non c'è un termostato manuale. Il flusso di
estrusione fa eccezione (vedi sopra): imposta e attende le temperature, ma solo come passo
automatico della sua sequenza, non come controllo libero.

## Decisioni prese, ancora da applicare

Queste non sono più questioni aperte: la scelta è fatta, manca l'esecuzione. I task
corrispondenti sono in [TODO.md](TODO.md).

### Il config editor va disattivato in produzione

`/settings/config-editor` è nato come pagina **di sviluppo**: serve a mettere a punto la
configurazione della macchina dal browser, non è qualcosa che un operatore debba raggiungere.
Modificare `printer.cfg` dal touchscreen di una macchina consegnata è un modo per romperla.

Per questo non è cablata: la costante `CONFIG_EDITOR_ENABLED` in
[moonraker-config.ts](../src/lib/services/moonraker-config.ts) è l'unico interruttore. A `false`
la voce scompare dall'elenco Impostazioni e la pagina si riduce a un avviso — la rotta resta
raggiungibile scrivendo l'URL a mano, quindi **non è una misura di sicurezza**, solo il modo di
togliere la funzione di mezzo quando non serve più (`SET-10`).

Essendo una pagina da sviluppatore e da PC, l'editor è CodeMirror 6 con evidenziazione della
sintassi Klipper, numeri di riga e ricerca (vedi
[04 — Config editor](04-moonraker.md#config-editor)): è l'unico punto dell'applicazione con
questa dipendenza, e sta tutto nel chunk della rotta. Resta comunque la pagina meno curata del
resto: **nessuna gestione del conflitto** se due client salvano lo stesso file (vince l'ultimo
che scrive), e nessuna validazione del config prima del salvataggio — l'errore si scopre al
riavvio, quando Klippy torna in stato `error`.

## Incoerenze aperte

### `npm run lint` non è eseguibile

Due problemi indipendenti, entrambi preesistenti:

- `prettier --check .` segnala **93 file** non formattati. Il repository non è mai stato
  passato con `npm run format`.
- `eslint .` va in **crash** su `ToolheadPosition.svelte` con
  `TypeError: Cannot read properties of undefined (reading 'type')` nella regola
  `@typescript-eslint/no-unused-vars`. Il crash si riproduce sul file non modificato, ed è
  verosimilmente legato alla sintassi reattiva legacy `$:` presente in quel componente.

Poiché lo script è `prettier --check . && eslint .`, oggi eslint non viene nemmeno raggiunto.

### Restano 4 vulnerabilità `low` senza fix disponibile

`npm audit fix` è stato eseguito e ha risolto 11 delle 15 vulnerabilità aggiornando il solo
`package-lock.json`, dentro i range di `package.json` (svelte, vite, postcss, rollup, esbuild,
`@sveltejs/kit` e le loro transitive). Le 4 rimaste sono la stessa segnalazione ripetuta lungo
la catena: `cookie < 0.7.0`, dipendenza diretta di `@sveltejs/kit`, che la richiede come
`^0.6.0` anche nell'ultima versione pubblicata (2.70.2). Non c'è quindi una versione di kit che
la risolva: `npm audit fix --force` "risolve" proponendo `@sveltejs/kit@0.0.30`, cioè un
downgrade di sette anni, e va rifiutato.

Sono `low` e non riguardano il browser: `cookie` è usato da kit lato server, mentre la build è
statica (`adapter-static`) e non esegue codice Node in produzione. Vanno rivalutate quando kit
aggiornerà la dipendenza.

### Il modello di macchina non è noto all'applicazione

Serve per parametrizzare la capienza della tramoggia e il numero di zone dell'ugello, e già
oggi il layout referenzia `static/Printers/G2/Logo.svg` con un percorso fisso. Non esiste un
meccanismo per sapere su quale macchina si sta girando. Vedi Q26.

## Debito noto sul deploy

Trattato per esteso in [06 — Build e deploy](06-deploy.md):

- `build/` committato nel repository produce diff binari a ogni push su `main`. È mitigato dal
  fatto che la CI ricompila solo su `main`, quindi i diff si concentrano sulle release;
- se qualcuno compila in locale con un `.env` e committa `build/`, l'IP della sua stampante
  finisce nel bundle distribuito. `build.sh` ora avvisa prima e dopo la build, ed elenca cosa è
  stato compilato dentro, ma **nulla impedisce materialmente quel commit**: manca un controllo
  in CI o un hook. Non è un rischio teorico: il `build/` committato conteneva davvero
  `192.168.1.20`, finito lì da una build locale. La ricompilazione fatta per `QA-7` l'ha
  rimosso, ma senza il controllo può ricapitare.

Il repository [gingeradditive/g2-os](https://github.com/gingeradditive/g2-os) esiste ma è
ancora il fork MainsailOS non adattato: preinstalla Mainsail e **non ha un modulo GingerView**.
È il pezzo mancante fra questo repository e l'immagine di sistema.

## Robustezza

- **Pannelli non visibili continuano a interrogare.** Le slide fuori dalla viewport del
  carosello restano montate e mantengono attivo il proprio `setInterval`.
- **Nessun test sul frontend.** L'unico test del progetto è
  [script/test-install.sh](../script/test-install.sh), che copre l'installer in un container.
  Non esistono unit test né test end-to-end sull'applicazione, e nessun hook git impone
  `lint`/`check` prima del commit.
- **`fetchDirectoriesRecursive` scarica tutto l'albero.** Viene invocata all'apertura del
  dialogo "sposta" e visita ricorsivamente ogni sottocartella di `gcodes`: su una struttura
  profonda genera molte richieste sequenziali.
