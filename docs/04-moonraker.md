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
| `ToolheadPosition` | `toolhead=position,axis_maximum`, `gcode_move=gcode_position` |

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

La console (`/settings/console`) invia G-code arbitrario, ma via WebSocket (vedi sotto).

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

### Thumbnail: due strategie

1. **Percorso dai metadati** — se il file dichiara `thumbnails`, `getThumbnailUrl()` sceglie
   quella di area maggiore e ne compone l'URL.
2. **Estrazione dal G-code** — `extractThumbnailFromGcode()` scarica **solo i primi 32 KB**
   del file con un header `Range: bytes=0-32767`, cerca il blocco
   `; thumbnail begin WxH N ... ; thumbnail end`, ripulisce i prefissi `;` e ricompone il
   base64 in un data URI PNG.

Se entrambe falliscono si usa il placeholder [static/error-thumbnail.png](../static/error-thumbnail.png).

## WebSocket

Ci sono **tre** utilizzi distinti del WebSocket, che non condividono una connessione comune.

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

### 3. `klipper-websocket.ts` — servizio con store

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
