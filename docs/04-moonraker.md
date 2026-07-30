# 04 — Integrazione Moonraker

GingerView parla con Moonraker in due modi: **HTTP** per interrogazioni e comandi puntuali,
**WebSocket** per le notifiche push e per la console. Non usa la sottoscrizione
`printer.objects.subscribe`: lo stato viene letto in polling.

In produzione tutti i percorsi elencati qui sotto sono **relativi all'origine della pagina** e
vengono inoltrati a Moonraker da nginx (vedi [03 — Configurazione](03-configurazione.md)).
Le tabelle riportano quindi il percorso, non un URL assoluto.

## Endpoint HTTP usati

### Stato della stampante

| Endpoint | Usato da | Scopo |
|---|---|---|
| `GET /printer/objects/query?...` | quasi tutti i pannelli | Lettura dello stato degli oggetti Klipper |
| `GET /printer/info` | `moonraker-notifier.ts` | Dettaglio dello stato in caso di errore/shutdown |
| `GET /server/info` | `moonraker-notifier.ts` | Warning, componenti falliti, stato di Klippy |

Query per componente:

| Componente | Oggetti interrogati |
|---|---|
| `DashboardControlPanel` | `print_stats`, `virtual_sdcard`, `fan`, `led LED_CAMERA` |
| `DashboardPrintJobPanel` | `print_stats`, `virtual_sdcard` |
| `DashboardJobInfoCard` | `print_stats` |
| `DashboardPelletPanel` | `print_stats` |
| `DashboardTemperaturePanel` | `extruder`, `extruder1`, `extruder2`, `extruder3`, `heater_bed` (elenco fisso) — vedi nota sulle zone |
| `DashboardFlowPanel` | `gcode_move`, `motion_report`, `print_stats` |
| `DashboardZHeightPanel` | `toolhead=position,axis_maximum`, `gcode_move=gcode_position`, `print_stats=state` |
| `DashboardQuickActionsPanel` | `fan`, `led LED_CAMERA` |
| `ToolheadPosition` | `toolhead=position,axis_maximum`, `gcode_move=gcode_position`, `stepper_enable=steppers` (polling) |
| `ExtrudeDialog` | `toolhead=axis_maximum` (una tantum, per calcolare il centro X prima dello spostamento) |
| `/settings/update` | `print_stats` (polling, solo per sapere se c'è una stampa in corso) |

> Gli oggetti `fan` e `led LED_CAMERA` sono definiti su **tutte** le macchine Ginger, quindi
> si possono dare per scontati senza controlli difensivi.

### Gli "estrusori" sono zone di un solo ugello

`extruder`, `extruder1`, `extruder2`, `extruder3` **non sono quattro utensili**: sono le
quattro zone riscaldate dell'unico ugello della G2 (la G1 ne ha tre). Kalico non supporta
nativamente un ugello multi-zona, quindi la configurazione le dichiara come estrusori distinti
usati contemporaneamente.

Due conseguenze pratiche:

- l'interfaccia non deve presentarli come strumenti selezionabili né permettere di attivarne
  uno alla volta;
- l'elenco fisso a quattro voci non si adatta a una macchina con un numero diverso di zone,
  e andrebbe ricavato da `/printer/objects/list`.

### Le misure di materiale sono in filamento, non in pellet

Le macchine sono a pellet ma Kalico ragiona a filamento: `print_stats.filament_used` e i
metadati dello slicer sono millimetri lineari di un **filamento virtuale**. Per mostrare
chilogrammi di pellet serve una riconversione, che oggi
[DashboardPelletPanel.svelte](../src/lib/components/DashboardPelletPanel.svelte) approssima
assumendo filamento da 1.75 mm e densità PLA — un calcolo senza fondamento fisico su questa
macchina. La formula corretta è ancora da definire (Q1 in [Q&A.md](Q&A.md)).

### Comandi G-code

```
POST /printer/gcode/script?script=<comando urlencoded>
```

Comandi effettivamente inviati dall'interfaccia:

| Comando | Origine |
|---|---|
| `PAUSE` | `DashboardPrintJobPanel` |
| `RESUME` | `DashboardPrintJobPanel` |
| `CANCEL_PRINT` | `DashboardPrintJobPanel` |
| `M106 S<0-255>` | `DashboardControlPanel` / `DashboardQuickActionsPanel` — velocità ventola |
| `SET_LED LED=LED_CAMERA WHITE=<0.00-1.00>` | `DashboardControlPanel` / `DashboardQuickActionsPanel` — luce |
| `G28` | `ToolheadPosition` (pulsante Home, dietro conferma `HomingWarningModal`) / primo passo di `ExtrudeDialog` |
| `M84` | `ToolheadPosition` — pulsante Disable Motors |
| `G90` + `G1 X<centro> Y0 Z250 F3000` | `ExtrudeDialog` — spostamento in posizione di purge dopo l'homing |
| `SET_HEATER_TEMPERATURE HEATER=<extruder\|extruder1\|extruder2\|extruder3> TARGET=<°C>` + `TEMPERATURE_WAIT SENSOR=<stesso> MINIMUM=<°C>` | `ExtrudeDialog` — una coppia per zona, preset PETG/PLA/Custom |
| `SET_EXTRUDER_ROTATION_DISTANCE EXTRUDER=extruder DISTANCE=<rotationVolume>` + `M83` + `G1 E<volumeMm3> F<speedMm3PerS*60>` + `M82` | `ExtrudeDialog` — ultimo passo, estrusione vera e propria. **Non verificato su hardware reale**, vedi Q32 in [Q&A.md](Q&A.md) |

Ognuno di questi script multi-linea viene inviato in **una sola chiamata**: `printer/gcode/script`
accetta più comandi separati da `\n` nello stesso `script` urlencoded, eseguiti in sequenza da
Klipper prima che la risposta HTTP torni al browser (per `TEMPERATURE_WAIT` questo significa che
la richiesta resta in attesa finché la temperatura non è raggiunta).

La console (`/settings/console`) invia G-code arbitrario, ma via WebSocket (vedi sotto).

### Avvio stampa

```
POST /printer/print/start?filename=<percorso urlencoded relativo a gcodes/>
```

Inviato da [PrintStartWizard.svelte](../src/lib/components/PrintStartWizard.svelte) solo
all'ultimo step del wizard aperto dal pulsante **Print** nel popup dettagli file. `filename` è
`item.filepath`, già relativo alla root `gcodes` (vedi sezione File più sotto).

### File

Tutto in [moonraker-files.ts](../src/lib/services/moonraker-files.ts):

| Operazione | Chiamata |
|---|---|
| Elenco directory | `GET /server/files/directory?path=<path>` |
| Metadati file | `GET /server/files/metadata?filename=<path>` |
| Download / thumbnail | `GET /server/files/<path>` |
| Upload | `POST /server/files/upload` (multipart: `file`, `root`) |
| Sposta / rinomina | `POST /server/files/move` (JSON: `source`, `dest`) |
| Elimina file | `DELETE /server/files/<path>` |
| Elimina cartella | `DELETE /server/files/directory?path=<path>&force=true` |
| Crea cartella | `POST /server/files/directory?path=<path>` |

Nota su rinomina e spostamento: usano entrambi `/server/files/move`, perché per Moonraker
rinominare è spostare verso un nome diverso nella stessa cartella.

I percorsi vengono codificati **segmento per segmento** (`split('/')` + `encodeURIComponent`
su ogni parte), per non trasformare gli slash in `%2F` e conservare la struttura del path.

### Log

Tutto in [moonraker-logs.ts](../src/lib/services/moonraker-logs.ts), usato da
[`/settings/log`](../src/routes/settings/log/+page.svelte):

| Operazione | Chiamata |
|---|---|
| Download log Klipper | `GET /server/files/klippy.log` |
| Download log Moonraker | `GET /server/files/moonraker.log` |
| Download log Crowsnest | `GET /server/files/logs/crowsnest.log` |
| Pulisci log | `POST /server/logs/rollover` (JSON: `{}`) |

Klipper e Moonraker usano il percorso "legacy" **senza** prefisso `logs/`: è un alias che
Moonraker risolve verso il file di log realmente configurato, qualunque sia il suo nome su
disco. Necessario perché su questo parco macchine Kalico scrive `kalico.log`, non `klippy.log`
— la rotta "moderna" `GET /server/files/logs/klippy.log` risponde **404** perché nella
directory non esiste alcun file con quel nome esatto (verificato con `GET
/server/files/list?root=logs` su una macchina reale). Crowsnest non ha un alias legacy
(Moonraker non lo gestisce), quindi va letto dalla root `logs` con il suo nome letterale.

Il download passa da `fetch` + `Blob` + link temporaneo (non un semplice `<a href>`), per poter
mostrare un toast d'errore se il file non esiste invece di far navigare il browser su una
pagina d'errore.

Il pulsante "Clear logs" non chiede quale log pulire: chiama sempre `rollover` **senza** il
campo `application`, che di default ruota **Klipper e Moonraker**. Passare
`{"application": "all"}` sembrerebbe l'opzione esplicita corretta stando alla documentazione
Moonraker, ma su Moonraker v0.10.x viene rifiutato con `400 Unknown application all`: omettere
il campo è l'unico modo verificato per ottenere il rollover di entrambi. Crowsnest resta fuori
in entrambi i casi — Moonraker non ha un meccanismo di rollover per log di terze parti, quindi
il file `crowsnest.log` resta intatto dopo la pulizia.

Effetto collaterale osservato su hardware reale: il rollover di Klipper fa ripartire il
servizio systemd di Kalico per rilasciare l'handle sul file di log, quindi durante la pulizia
compare per un istante un toast "Kalico disconnected" — non è un errore. Moonraker rifiuta
comunque il rollover se una stampa è in corso.

### Update manager

Tutto in [moonraker-update.ts](../src/lib/services/moonraker-update.ts), usato da
[`/settings/update`](../src/routes/settings/update/+page.svelte):

| Operazione | Chiamata |
|---|---|
| Stato di tutti i componenti | `GET /machine/update/status` |
| Check update (interroga i remoti) | `POST /machine/update/refresh` (JSON: `{name?}`) |
| **Update all** | `POST /machine/update/upgrade` (JSON: `{}`, cioè `name` omesso = tutto) |
| Soft / hard recovery | `POST /machine/update/recover` (JSON: `{name, hard}`) |

**L'aggiornamento è solo totale, per scelta.** `upgrade` accetta un `name` per aggiornare un
singolo componente, ma l'interfaccia non lo usa: c'è un unico pulsante **Update all** e
`startUpgrade()` viene sempre chiamata senza argomenti. Il parametro resta supportato dal
servizio per non chiudere la porta, ma nessuna riga dell'elenco ha un proprio pulsante Update.

**Il rollback non è esposto.** `POST /machine/update/rollback` esiste in Moonraker ma non viene
chiamato da nessuna parte, e nell'interfaccia non c'è alcun modo di tornare alla versione
precedente. Il campo `rollback_version` viene ricevuto e ignorato.

**L'aggiornamento di sistema non è un endpoint a parte.** I pacchetti del sistema operativo
sono l'elemento `system` dentro `version_info`, un updater che incapsula apt: "aggiorna il
sistema" e "aggiorna un programma" sono la stessa `upgrade` con un `name` diverso. Gli endpoint
storici dedicati (`/machine/update/full`, `/system`, `/klipper`, `/moonraker`, `/client`) sono
deprecati dall'API 1.5.0 e non vengono usati.

`status` legge lo stato in cache e non contatta GitHub; `refresh` invece sì, e consuma il rate
limit anonimo (60 richieste/ora), motivo per cui è legato solo al pulsante **Check for updates**
e non a un polling. Restituisce **503** se un update o una stampa sono in corso, o se
l'update manager non ha finito di inizializzarsi.

`version_info` contiene una voce per componente, di tipo diverso a seconda di come è configurato
in `moonraker.conf` (`system`, `git_repo`, `web`, `zip`, `python`). I campi non sono gli stessi
per tutti, quindi [types/update.ts](../src/lib/types/update.ts) li modella come un'unica
interfaccia con tutto opzionale tranne `name` — funziona anche con versioni di Moonraker più
vecchie, che semplicemente omettono le chiavi recenti.

Su una macchina reale (Moonraker v0.10.0) le voci presenti sono `system`, `klipper`,
`moonraker`, `mainsail`, `mainsail-config`, `crowsnest` e `GingerView`.

**Le operazioni sono richieste lunghe.** `upgrade` e `recover` rispondono solo a
lavoro concluso — minuti, per un aggiornamento di sistema. Per questo il proxy nginx alza
`proxy_read_timeout` (vedi [06 — Il proxy](06-deploy.md#il-proxy)) e la pagina non tratta mai
una richiesta fallita come un aggiornamento fallito: se `status.busy` è ancora `true`, continua
a seguire l'operazione in polling finché non si esaurisce.

**La recovery è derivata, non sempre offerta.** È l'unica azione presente sulla singola riga, e
compare solo quando Moonraker segnala `is_valid: false`, `corrupt`, `detached` o `is_dirty` —
cioè quando `Update all` da solo non può risolvere. Passa da una modale di conferma che dice
cosa si perde.

L'elenco mostra **solo nome, versione e stato**: non c'è un pannello espandibile con i dettagli.
`commits_behind` (il changelog), `package_list` (i pacchetti apt in attesa), `warnings` e
`anomalies` vengono ricevuti ma non visualizzati. I tipi in
[types/update.ts](../src/lib/types/update.ts) restano completi perché descrivono il payload, non
l'interfaccia.

Attenzione a non confondere i flag con i messaggi: sulla macchina di prova `klipper` riporta
`warnings: ["Repo is corrupt"]` pur avendo `corrupt: false` e `is_valid: true` — è un residuo
testuale, dovuto al fatto che il repo è Kalico (`KalicoCrew/kalico` su `main`) e non il Klipper
ufficiale, come dicono le `anomalies`. Le decisioni si prendono **sui flag** e mai sulle
stringhe: fidarsi di quel `warnings` significherebbe proporre una recovery su un repo sano.

### Thumbnail: due strategie

1. **Percorso dai metadati** — se il file dichiara `thumbnails`, `getThumbnailUrl()` sceglie
   quella di area maggiore e ne compone l'URL.
2. **Estrazione dal G-code** — `extractThumbnailFromGcode()` scarica **solo i primi 32 KB**
   del file con un header `Range: bytes=0-32767`, cerca il blocco
   `; thumbnail begin WxH N ... ; thumbnail end`, ripulisce i prefissi `;` e ricompone il
   base64 in un data URI PNG.

Se entrambe falliscono si usa il placeholder [static/error-thumbnail.png](../static/error-thumbnail.png).

## WebSocket

Ci sono **quattro** utilizzi distinti del WebSocket, che non condividono una connessione comune.

### 1. `moonraker-notifier.ts` — notifiche globali

Attivato da `<MoonrakerNotifier />` nel layout, quindi sempre attivo.

All'apertura si identifica con:

```json
{
  "jsonrpc": "2.0",
  "method": "server.connection.identify",
  "params": { "client_name": "GingerView", "version": "0.0.1", "type": "web", "url": "..." },
  "id": 1234567890
}
```

Notifiche gestite:

| Metodo | Azione |
|---|---|
| `notify_klippy_ready` | toast di successo |
| `notify_klippy_shutdown` | recupera `state_message` da `/printer/info` e mostra un toast di errore persistente |
| `notify_klippy_disconnected` | toast di errore persistente |
| `notify_proc_stat_update` | estrae `moonraker_stats.warnings`, deduplicati tramite un `Set` |

Riconnessione: timer fisso a **10 secondi**, senza limite di tentativi.

All'avvio, `fetchAndDisplayWarnings()` legge `/server/info` e mostra come toast persistenti
i `warnings`, i `failed_components` e l'eventuale stato `error`/`shutdown` di Klippy.

### 2. `/settings/console` — terminale G-code

Apre una connessione propria su `config.moonrakerWsUrl` e invia:

```json
{ "jsonrpc": "2.0", "method": "printer.gcode.script", "params": { "script": "<comando>" }, "id": ... }
```

Le risposte arrivano come `notify_gcode_response`; le righe vengono ripulite dai prefissi
`//` e `;` e gli `ok` vengono scartati. Massimo **3 tentativi** di connessione, timeout di
5 secondi, riconnessione manuale tramite pulsante. Cronologia comandi navigabile con le frecce.

### 3. `/settings/update` — output degli aggiornamenti

Aperta da `connectUpdateSocket()` in
[moonraker-update.ts](../src/lib/services/moonraker-update.ts) e viva solo finché la pagina
Update è montata. Si identifica come il notifier e ascolta due notifiche:

| Metodo | Payload | Azione |
|---|---|---|
| `notify_update_response` | `application`, `proc_id`, `message`, `complete` | Aggiunge la riga al log della modale; `complete: true` segna la fine per quel componente |
| `notify_update_refreshed` | lo stesso oggetto di `/machine/update/status` | Aggiorna l'elenco in pagina, ma **solo se non c'è un'operazione in corso** |

Non riusa la connessione del notifier perché quella non espone un meccanismo di
sottoscrizione, e l'output degli aggiornamenti interessa solo a questa pagina. Riconnessione a
5 secondi, senza limite di tentativi — serve perché aggiornare Moonraker lo fa riavviare, e la
connessione cade a metà operazione.

### 4. `klipper-websocket.ts` — servizio con store

Espone `connectionStatus` e `klipperStatus` come store Svelte e riconnette con ritardo
crescente (`1000ms × tentativo`, max 5 tentativi). Il suo unico consumatore è
`DemoComponent.svelte`, che non è montato da nessuna rotta: in pratica **questa connessione
non viene mai aperta**. Vedi
[07 — Stato attuale](07-stato-attuale.md#codice-morto-da-rimuovere).

## Frequenze di polling

| Componente | Intervallo |
|---|---|
| `ToolheadPosition` | 1000 ms |
| `DashboardFlowPanel` | 1500 ms |
| `DashboardTemperaturePanel` | 1500 ms |
| `DashboardZHeightPanel` | 1500 ms |
| `DashboardControlPanel` | 2000 ms |
| `DashboardPrintJobPanel` | 2000 ms |
| `DashboardJobInfoCard` | 2000 ms |
| `DashboardQuickActionsPanel` | 2000 ms |
| `DashboardPelletPanel` | 3000 ms |
| `/settings/network` (stato rete) | 5000 ms |
| `/settings/update` (stato stampa, per bloccare gli update) | 5000 ms |

Ogni intervallo è una costante `pollIntervalMs` locale al componente. Nella dashboard sono
attivi contemporaneamente più pannelli, quindi il numero di richieste HTTP al secondo verso
Moonraker è la somma dei pannelli montati — anche di quelli fuori dalla viewport del carosello,
che restano montati e continuano a interrogare.

## Calcolo del tempo residuo

`DashboardControlPanel` stima il tempo rimanente con due strategie in cascata:

1. **Estrapolazione dall'avanzamento reale** — se `virtual_sdcard.progress > 0.001` e
   `print_duration > 0`, allora `totale ≈ print_duration / progress` e il residuo è la
   differenza. È la stima più affidabile a stampa avviata.
2. **Metadati dello slicer** — altrimenti usa `estimated_time` dai metadati del file, caricato
   una sola volta per nome file e memorizzato in `estimatedTotalSeconds`.

Se nessuna delle due è disponibile, l'interfaccia mostra `--:--:--`.

## Servizio di rete (non Moonraker)

[network-api.ts](../src/lib/services/network-api.ts) parla con un servizio separato, per
default sulla porta `8000`:

| Endpoint | Metodo | Uso |
|---|---|---|
| `/api/wifi/status` | GET | Stato adattatore, IP, segnale, SSID corrente |
| `/api/wifi/networks` | GET | Reti disponibili |
| `/api/wifi/connect` | POST | Connessione (`ssid`, `password`) |
| `/api/wifi/disconnect` | POST | Disconnessione |

Il metodo `scanNetworks()` non chiama un endpoint di scansione dedicato: **non esiste**, quindi
usa `/api/wifi/networks` e ne incapsula il risultato. Gli errori seguono il formato di
validazione FastAPI (`{ detail: [{ loc, msg, type }] }`), tipizzato in
[src/lib/types/wifi.ts](../src/lib/types/wifi.ts).

### Fuso orario: endpoint ancora da scrivere

Il fuso orario non è una funzione della stampante ma dell'host, e **Moonraker non espone niente**
per impostarlo. Il posto giusto è lo stesso servizio di rete, che gira già con i privilegi
necessari per chiamare `timedatectl`:

| Endpoint | Metodo | Uso |
|---|---|---|
| `/api/timezone` | GET | `{ timezone, ntpSynchronized }` — l'equivalente di `timedatectl show` |
| `/api/timezone` | POST | `{ timezone }` — `timedatectl set-timezone <id>` |

Nessuno dei due esiste ancora (`SET-9` in [TODO.md](TODO.md)). Finché non ci sono,
[timezone.ts](../src/lib/services/timezone.ts) li simula: la lettura ricava la zona dal browser,
la scrittura la ricorda in `localStorage`, e la pagina lo dichiara esplicitamente all'utente.
Quando arriveranno, va sostituito **solo il corpo** di `fetchTimezoneStatus()` e
`setSystemTimezone()`, e va tolto l'avviso dalla pagina.

L'elenco delle zone accettate non viene chiesto all'host: è compilato dentro l'applicazione a
partire da `zone.tab` di tzdata, che è lo stesso file da cui `timedatectl list-timezones` legge
il proprio (vedi [05 — Dati generati](05-sviluppo.md#dati-generati-fusi-orari-e-mappa)).

## Autenticazione

**Non c'è.** Moonraker su G2-OS è configurato senza autenticazione, e GingerView non invia mai
credenziali né usa gli endpoint `/access/*`. Con il proxy nginx le richieste raggiungono
Moonraker da `127.0.0.1`, quindi rientrano nei `trusted_clients` standard.

Se in futuro l'autenticazione venisse abilitata, andrebbero toccati tutti i punti che fanno
`fetch` — non esiste oggi un layer centralizzato che possa aggiungere un header in un colpo solo.

## CORS

**In produzione non serve alcuna configurazione CORS**: interfaccia e API stanno sulla stessa
origine grazie al proxy nginx installato da [script/install.sh](../script/install.sh).

Il tema si pone solo in sviluppo, quando si imposta `VITE_MOONRAKER_HOST` e le chiamate
diventano cross-origin. In quel caso va autorizzata l'origine del dev server in
`moonraker.conf`:

```ini
[authorization]
cors_domains:
    http://localhost:5173
trusted_clients:
    192.168.0.0/16
```
