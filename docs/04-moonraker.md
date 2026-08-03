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
| `movementStore` (sequenza di `ExtrudeDialog`) | `toolhead=axis_maximum` (una tantum, per calcolare il centro X prima dello spostamento) |
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

### `print_stats.filename` sopravvive alla fine della stampa

Kalico **non** azzera `print_stats.filename` quando un lavoro finisce: negli stati `complete`,
`cancelled` ed `error` il campo contiene ancora il nome dell'ultimo file, e si svuota solo con
una nuova stampa o con `SDCARD_RESET_FILE`. Un componente che si fidi del solo `filename`
continua quindi a mostrare la stampa appena conclusa come se fosse in corso — è il motivo per
cui `DashboardJobInfoCard` guarda prima `print_stats.state` e considera "in corso" soltanto
`printing` e `paused`, come già fanno `DashboardZHeightPanel`, `DashboardFlowPanel` e
`DashboardPelletPanel`.

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
| `G28` | `movementStore` — `startHoming()` (pulsante Home di `ToolheadPosition`, dietro conferma `HomingWarningModal`) e primo passo di `startExtrudeSequence()` |
| `M84` | `ToolheadPosition` — pulsante Disable Motors |
| `G90` + `G1 X<centro> Y0 Z250 F3000` | `movementStore` — spostamento in posizione di purge dopo l'homing |
| `SET_HEATER_TEMPERATURE HEATER=<extruder\|extruder1\|extruder2\|extruder3> TARGET=<°C>` + `TEMPERATURE_WAIT SENSOR=<stesso> MINIMUM=<°C>` | `movementStore` — una coppia per zona, preset PETG/PLA/Custom |
| `SET_EXTRUDER_ROTATION_DISTANCE EXTRUDER=extruder DISTANCE=<rotationVolume>` + `M83` + `G1 E<volumeMm3> F<speedMm3PerS*60>` + `M82` | `movementStore` — ultimo passo, estrusione vera e propria. **Non verificato su hardware reale**, vedi Q32 in [Q&A.md](Q&A.md) |

Ognuno di questi script multi-linea viene inviato in **una sola chiamata**: `printer/gcode/script`
accetta più comandi separati da `\n` nello stesso `script` urlencoded, eseguiti in sequenza da
Klipper prima che la risposta HTTP torni al browser (per `TEMPERATURE_WAIT` questo significa che
la richiesta resta in attesa finché la temperatura non è raggiunta).

Proprio perché la risposta arriva a comandi eseguiti, uno status non-2xx significa che la macchina
**non** ha fatto quel che le è stato chiesto: `movementStore` lo tratta come errore e interrompe la
sequenza, invece di passare al passo successivo. Senza quel controllo un `G28` rifiutato (ugello
sporco, Kalico in `shutdown`) veniva ignorato e si andava comunque a spostare, scaldare ed estrudere
da una posizione sconosciuta. Il messaggio mostrato è quello di Kalico, letto da
`{"error": {"message": ...}}`, in un toast intitolato con il passo fallito.

La console (`/settings/console`) invia G-code arbitrario, ma via WebSocket (vedi sotto).

### Emergency stop

```
POST /printer/emergency_stop
```

È l'unica chiamata del **pulsante rosso nella dock**
([EmergencyStopButton.svelte](../src/lib/components/EmergencyStopButton.svelte)), la stessa che fa
il pulsante di Mainsail. Klipper spegne riscaldatori e motori e passa in stato `shutdown`: **non
torna operativo da solo**, l'unico modo è un firmware restart (vedi [Riavvii](#riavvii)). Per
questo il tasto è uno solo con due comportamenti — a macchina in marcia la ferma, a macchina ferma
la fa ripartire.

Il pulsante di emergenza **fisico** sulla macchina resta il dispositivo di sicurezza: questo è una
comodità per chi ha in mano il telefono, non un suo sostituto.

A differenza dei riavvii, `emergency_stop` **non uccide Moonraker**: la risposta è affidabile e un
fallimento è un fallimento vero, quindi `emergencyStop()` in
[moonraker-printer.ts](../src/lib/services/moonraker-printer.ts) controlla `res.ok` e in caso di
errore mostra un toast persistente che rimanda al pulsante fisico.

Lo stop **non chiede conferma** — come in Mainsail: un dialogo davanti a un arresto di emergenza
annulla il senso del pulsante. Il riavvio invece la chiede, perché rimette riscaldatori e motori
sotto il controllo di Kalico su una macchina che qualcuno ha fermato apposta. Non serve invece la
guardia "stampa in corso" del config editor: il riavvio compare solo quando Kalico è già fermo,
quindi non c'è più un lavoro da perdere.

Quale dei due comportamenti mostrare lo decide lo stato di Klippy letto dallo store `klippyState`
di [moonraker-notifier.ts](../src/lib/services/moonraker-notifier.ts) — nessun polling aggiuntivo,
vedi [WebSocket](#1-moonraker-notifierts--notifiche-globali). Il tasto diventa "riavvia" solo su
`shutdown` e `error`, cioè quando Klippy è vivo ma fermo; su `disconnected` il processo host non
c'è e `/printer/firmware_restart` verrebbe rifiutato, quindi resta un pulsante di stop.

### Avviso a schermo quando Kalico è fermo

Lo stesso stato che comanda il pulsante alimenta
[KlipperDownOverlay.svelte](../src/lib/components/KlipperDownOverlay.svelte): quando `klippyState`
è `shutdown`, `error` o `disconnected` (`isKlippyDown()`), le pagine operative vengono coperte da
un avviso **non chiudibile** al centro dello schermo, con il motivo riportato da Klippy
(`state_message`, nello store `klippyMessage`).

Non è un dialogo di conferma ma una constatazione: a firmware fermo i valori in dashboard sono
congelati e i comandi non fanno niente, quindi non c'è nulla da confermare e nulla da chiudere.

Due cose però non devono finirci sotto, ed è la parte che conta:

- **la dock**, per geometria — l'overlay si ferma a `bottom: 96px`, sopra la barra (alta 88px dal
  bordo inferiore). Non dipende dallo `z-index`: navigazione ed emergency stop restano cliccabili
  comunque, ed è così che si lancia il firmware restart che toglie l'avviso;
- **Settings e le sue sottopagine**, per rotta — l'overlay non compare se il percorso inizia con
  `/settings`. Log, Update e Console sono esattamente i posti in cui si va a capire *perché*
  Kalico si è fermato.

Lo `z-index` è `2900`: sopra il contenuto delle pagine, sotto le modali (`3000`) — compresa la
conferma del riavvio, che nasce dalla dock — e sotto i toast (`9999`).

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

### Config editor

Tutto in [moonraker-config.ts](../src/lib/services/moonraker-config.ts), usato da
[`/settings/config-editor`](../src/routes/settings/config-editor/+page.svelte):

| Operazione | Chiamata |
|---|---|
| Elenco di una cartella | `GET /server/files/directory?path=config[/sottocartella]` |
| Lettura di un file | `GET /server/files/config/<percorso>?t=<timestamp>` |
| Scrittura di un file | `POST /server/files/upload` (multipart: `file`, `root=config`, `path=<sottocartella>`) |
| Download | `GET /server/files/config/<percorso>` |
| Crea cartella / rinomina / elimina | le funzioni generiche di [moonraker-files.ts](../src/lib/services/moonraker-files.ts) |

**Non esiste un endpoint "config".** La cartella di configurazione della stampante è
semplicemente la **root `config`** del file manager, quindi sfogliarla e modificarla usa le
stesse chiamate dei G-code: leggere un file è un download, salvarlo è un upload che sovrascrive.
`config` e `gcodes` sono le uniche due root scrivibili, e `config` può essere configurata in
sola lettura: la pagina legge `root_info.permissions` e se non contiene `w` si blocca da sola
invece di far fallire il salvataggio.

Nell'upload `root` e `path` sono **due campi separati**, e `path` è la sottocartella *relativa
alla root*: `config/macros/park.cfg` si scrive come `root=config`, `path=macros`, nome file
`park.cfg`. Moonraker crea le sottocartelle mancanti.

La lettura porta un `?t=<timestamp>`: per il browser è il download di un file statico, quindi
senza cache-buster una riapertura subito dopo il salvataggio può legittimamente essere servita
dalla cache restituendo la versione appena sostituita.

**L'albero è pigro.** `fetchConfigDirectory()` elenca **una cartella per volta**: una cartella
mai aperta non costa niente. È il contrario di `fetchDirectoriesRecursive()` per i G-code
(vedi `ROB-3` in [TODO.md](TODO.md)). Le voci che iniziano con `.` (i backup `.moonraker_backup`,
`.git`) vengono nascoste: sono bookkeeping di Moonraker, non file da modificare a mano.

**L'editor è CodeMirror 6**, come in Mainsail e Fluidd, incapsulato in
[CodeEditor.svelte](../src/lib/components/CodeEditor.svelte): numeri di riga, undo/redo,
ricerca (`Ctrl`/`Cmd`+`F`), piegatura del codice e parentesi abbinate. Il tasto Tab indenta di
4 spazi invece di spostare il fuoco, e `Ctrl`/`Cmd`+`S` salva — quest'ultimo resta gestito
dalla pagina, CodeMirror non intercetta la combinazione.

La dipendenza è ammessa proprio perché la pagina è **di sviluppo e da PC**: i ~145 kB gzip di
CodeMirror stanno tutti nel chunk della rotta, che il resto dell'applicazione non carica mai
(vedi [Il config editor va disattivato in produzione](07-stato-attuale.md#il-config-editor-va-disattivato-in-produzione)).
Quando la pagina verrà rimossa se ne va anche la dipendenza.

#### Evidenziazione della sintassi

Il modo per i `.cfg` è scritto a mano in
[klipper-config-language.ts](../src/lib/editor/klipper-config-language.ts) perché **il formato
Klipper non è un INI** e nessun modo pronto lo copre:

- oltre a `[sezione]`, `chiave: valore` e commenti `#` / `;`, ogni opzione lasciata **senza
  valore apre un blocco indentato** (`gcode:`, `points:`), che finisce alla prima riga con del
  contenuto indentata quanto o meno dell'opzione che l'ha aperto — le righe vuote restano dentro;
- i blocchi delle opzioni che contengono G-code (`gcode`, `*_script`, i template) prendono
  l'evidenziazione dei comandi: nome del comando, parametri `HEATER=` e la forma `X10` / `F3000`;
- dentro c'è **Jinja2 con le delimitazioni di Klipper**, che usa la graffa singola
  (`{ params.X }`) invece della doppia: il tokenizer riconosce `{% %}`, `{{ }}` e `{ }`, le
  parole di controllo (`if`, `for`, `set`, …) e i nomi che Klipper inietta (`printer`, `params`).

Nell'intestazione `[gcode_macro START_PRINT]` il **tipo** e il **nome dell'istanza** sono
colorati diversamente. I valori vengono presi come token interi e non carattere per carattere:
altrimenti le cifre dentro un nome di pin (`PF13`) o dentro un percorso (`/dev/serial/...`)
verrebbero lette come numeri.

`.conf` (il config di Moonraker) condivide lo stesso modo, `.json` usa `@codemirror/lang-json`,
tutto il resto (`.md`, `.txt`) resta testo semplice.

### Riavvii

| Operazione | Chiamata | Effetto |
|---|---|---|
| Firmware restart | `POST /printer/firmware_restart` | Riavvia Klipper **e gli MCU**, ricaricando la configurazione della stampante |
| Host restart | `POST /printer/restart` | Ricarica solo Klippy sull'host, senza resettare gli MCU |
| Moonraker restart | `POST /server/restart` | Riavvia il servizio Moonraker, necessario dopo aver modificato `moonraker.conf` |

Sono le stesse tre opzioni di Mainsail, con lo stesso default: **`firmware_restart`**, l'unico
che ricarica anche la configurazione degli MCU e quindi applica davvero la maggior parte delle
modifiche a `printer.cfg`.

I tre riavvii **non stanno in `moonraker-config.ts`** ma in
[moonraker-printer.ts](../src/lib/services/moonraker-printer.ts), insieme all'emergency stop:
sono comandi della stampante, non del config editor, e il firmware restart è anche il modo in cui
il pulsante nella dock recupera una macchina fermata (vedi
[Emergency stop](#emergency-stop)).

Il riavvio è **suggerito al salvataggio e attivabile a mano**. Dopo un salvataggio la pagina
mostra un banner con il riavvio adatto al file salvato — `moonraker.conf` chiede il riavvio di
Moonraker, un `.cfg` il firmware restart — ma non lo esegue: decidere *quando* riavviare spetta
all'operatore. In cima alla pagina ci sono comunque una tendina e un pulsante **Restart** per
lanciare uno qualsiasi dei tre in qualunque momento, dietro conferma.

**I riavvii sono bloccati durante una stampa.** Klipper accetta `FIRMWARE_RESTART` anche a
stampa in corso e perde il lavoro, e Moonraker non lo impedisce: il divieto sta
nell'interfaccia. La pagina interroga `print_stats.state` insieme a `/printer/info` e, se è
`printing` o `paused`, disabilita la tendina, il pulsante **Restart** e **Save & restart**
mostrando il motivo — è la stessa guardia della pagina Update. Il **salvataggio** resta
permesso: scrivere un file non tocca la stampa in corso, è il riavvio che la interrompe.

**La richiesta di riavvio non ha una risposta affidabile.** Tutti e tre gli endpoint uccidono la
connessione che sta servendo la richiesta: la `fetch` può fallire, o restare appesa e poi
fallire, anche se il riavvio è stato accettato. `requestRestart()` quindi **ignora l'esito**
della richiesta, e l'esito vero si legge dopo, con `waitForKlipperReady()` che interroga
`GET /printer/info` ogni 2 secondi (fino a 90) finché Klippy esce da `startup`. È lì che emerge
una configurazione rotta: Klippy torna in stato `error` con l'errore di parsing in
`state_message`, che la pagina mostra in un toast.

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
| `notify_klippy_ready` | toast di successo, `klippyState = 'ready'` |
| `notify_klippy_shutdown` | recupera `state_message` da `/printer/info` e mostra un toast di errore persistente, `klippyState = 'shutdown'` |
| `notify_klippy_disconnected` | toast di errore persistente, `klippyState = 'disconnected'` |
| `notify_proc_stat_update` | estrae `moonraker_stats.warnings`, deduplicati tramite un `Set` |

Riconnessione: timer fisso a **10 secondi**, senza limite di tentativi.

All'avvio, `fetchAndDisplayWarnings()` legge `/server/info` e mostra come toast persistenti
i `warnings`, i `failed_components` e l'eventuale stato `error`/`shutdown` di Klippy.

**Gli store `klippyState` e `klippyMessage`.** Oltre ai toast, il notifier tiene lo stato di Klippy
in uno store esportato (`'' | 'ready' | 'startup' | 'shutdown' | 'error' | 'disconnected'`) e, se
Klippy è fermo, il suo `state_message` in un secondo store. Servono al pulsante di
[emergency stop](#emergency-stop) — fermare o far ripartire — e all'
[avviso a schermo](#avviso-a-schermo-quando-kalico-è-fermo), e stanno qui perché il notifier è
montato nel layout e riceve già le notifiche: nessuna seconda connessione, nessun polling in più.
Vengono riallineati con `refreshKlippyState()` all'avvio e a **ogni (ri)connessione** del
WebSocket — quello che è successo mentre la socket era giù non è stato annunciato a nessuno.

Il motivo (`state_message`) si legge da `/printer/info`, quindi solo negli stati `shutdown` ed
`error`: se il processo host è `disconnected` non c'è nessuno a cui chiederlo.

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
| `/settings/config-editor` (`/printer/info` + `print_stats`, due richieste) | 5000 ms |

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

## G2-Service (non Moonraker)

Rete e fuso orario non sono funzioni della stampante ma dell'host, e Moonraker non se ne occupa.
Stanno in [G2-Service](https://github.com/gingeradditive/G2-Service), sulla porta `8000`, con
**tutti** gli endpoint sotto il prefisso `/service/` — scelto per non collidere con i namespace
di Moonraker (`/api/`, `/printer/`, `/machine/`, `/server/`, `/access/`). Attenzione a non
confondere `/service/` con `/server/`, che è di Moonraker.

Il contratto completo è in
[G2-Service `docs/03`](https://github.com/gingeradditive/G2-Service/blob/main/docs/03-proposta-api-rete-timezone.md).
Qui interessa quello che GingerView usa davvero:

| Endpoint | Metodo | Uso | Client |
|---|---|---|---|
| `/service/network/status` | GET | Stato unificato: `adapter`, `ip`, `signalInfo`, `interfaces` | `network-api.ts` |
| `/service/network/wifi/networks` | GET | Ultima scansione nota, risponde subito | `network-api.ts` |
| `/service/network/wifi/rescan` | POST | Forza una scansione e aspetta i risultati | `network-api.ts` |
| `/service/network/wifi/connect` | POST | `{ ssid, password? }` → `202` + job | `network-api.ts` |
| `/service/jobs/{jobId}` | GET | Avanzamento ed esito di un'operazione asincrona | `g2-service.ts` |
| `/service/timezone` | GET/POST | `{ timezone, ntpSynchronized }` | `timezone.ts` |

Tre cose valgono per tutti e stanno in
[g2-service.ts](../src/lib/services/g2-service.ts), non nei singoli client:

- **`camelCase`** in tutti i corpi JSON, richieste comprese.
- **Due forme di errore**, entrambe sotto `detail`: `{ code, message }` per gli errori
  applicativi (`SYSTEM_TOOL_UNAVAILABLE`, `INVALID_INPUT`, ...) e la lista di FastAPI per i
  `422` di validazione. `ServiceError` le normalizza in un `code` unico su cui il chiamante può
  ramificare, aggiungendo i propri per i casi che non hanno una risposta:
  `SERVICE_UNREACHABLE` e `JOB_TIMEOUT`.
- **I job asincroni**: `connect` risponde `202` con un `jobId` e l'esito si legge da
  `/service/jobs/{jobId}`. Non è una questione di durata — connettersi **cambia l'indirizzo IP
  della macchina**, quindi la risposta a una chiamata sincrona non avrebbe dove tornare.
  `waitForJob()` continua a interrogare il job anche mentre il servizio non risponde, perché
  perdere la connessione a metà è il decorso *normale* dell'operazione che sta seguendo.

Gli esiti negativi previsti **non sono errori HTTP**: una password sbagliata arriva come
`status: "failed"` del job con `WIFI_AUTH_FAILED` (o `WIFI_NETWORK_NOT_FOUND`, `WIFI_TIMEOUT`).

I messaggi mostrati all'utente si scelgono in base al **`code`**, non al `message`: il primo è
la parte stabile del contratto, e i messaggi di G2-Service sono in italiano mentre
l'interfaccia è in inglese. Le traduzioni stanno in `SERVICE_MESSAGES` nella pagina di rete e
in `TIMEZONE_MESSAGES` in `timezone.ts`; il messaggio del servizio resta come ultima risorsa
per un codice imprevisto.

### Endpoint disponibili ma non usati

G2-Service ne espone altri, che oggi nessuna pagina chiama: `GET /service/health`,
`POST /service/network/wifi/disconnect`, `GET`/`DELETE /service/network/wifi/saved[/{ssid}]` e
`GET /service/network/ethernet/status`. Vedi `NET-6`…`NET-9` in [TODO.md](TODO.md).

**L'interfaccia non segnala che il salvataggio è finto** — l'avviso c'era ed è stato tolto per
scelta. Chi salva vede il toast "Timezone saved" e nient'altro, quindi finché `SET-9` non è
fatto la pagina promette più di quanto mantenga.

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
