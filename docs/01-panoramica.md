# 01 — Panoramica

## Cos'è GingerView

GingerView è l'interfaccia web con cui si controllano le stampanti 3D **Ginger Additive**.
Svolge lo stesso ruolo di [Mainsail](https://github.com/mainsail-crew/mainsail): è un client
web per uno stack **Kalico + Moonraker**, con cui l'utente monitora la stampa, muove la testa,
gestisce i file G-code e configura la macchina.

La differenza rispetto a Mainsail è l'**ambito**: GingerView è volutamente più semplice.
Mainsail è un'interfaccia generalista che espone quasi tutto ciò che Klipper e Moonraker
offrono; GingerView espone solo ciò che serve a usare una stampante Ginger.

## Il dispositivo di accesso è il telefono dell'utente

**Le macchine Ginger non hanno uno schermo.** L'utente si collega dal proprio cellulare,
raggiungendo la stampante tramite un **NFC/QR** applicato alla macchina, che punta
all'indirizzo mDNS **`g2.local`** (vedi [06 — Build e deploy](06-deploy.md#come-si-raggiunge-la-macchina)).

È il vincolo di progetto più importante e va tenuto presente in ogni scelta di layout:
il bersaglio primario è uno schermo di telefono tenuto in mano accanto a una stampante, non
un pannello touch fisso né un desktop. Il supporto a schermi larghi resta utile (un tecnico
che si collega dal portatile), ma non è il caso d'uso principale.

Alcune parti dell'interfaccia sono state riviste di recente per questo motivo e possono
contenere ancora residui dell'impostazione precedente.

## Perché non usare direttamente Mainsail

- **Superficie ridotta.** Meno pannelli, meno impostazioni, meno modi di rompere la macchina.
- **Layout da telefono.** Navigazione a dock in basso e caroselli a scorrimento orizzontale
  invece di dashboard a griglia densa (vedi [02 — Architettura](02-architettura.md)).
- **Identità Ginger.** Palette, logo e terminologia della macchina sono parte del prodotto,
  non un tema applicato sopra.
- **Controllo sul ciclo di rilascio.** L'interfaccia viene versionata e distribuita insieme
  all'immagine di sistema della stampante.

Mainsail resta il riferimento funzionale da cui prendere spunto, ma **non viene installato
accanto a GingerView**: su G2-OS c'è solo GingerView.

## Le macchine

Le stampanti Ginger sono **a estrusione di pellet**, non a filamento. Kalico però ragiona
nativamente a filamento, quindi le grandezze che espone (`filament_used`, `filament_total`)
sono in millimetri lineari di un filamento virtuale e vanno riconvertite per essere mostrate
come chilogrammi di pellet.

Un'altra particolarità: la macchina ha **un solo ugello suddiviso in più zone di
riscaldamento** — quattro sulla G2, tre sulla G1. Kalico non supporta nativamente un ugello
multi-zona, perciò la configurazione dichiara più estrusori (`extruder`, `extruder1`, …) usati
contemporaneamente come espediente. Nell'interfaccia vanno letti come zone dello stesso
ugello, non come utensili distinti.

## Cosa fa oggi l'applicazione

| Area | Rotta | Funzioni |
|---|---|---|
| **Dashboard** | `/` | Carosello con altezza Z, pellet, info job, temperature, flusso. Barra di controllo con avanzamento/tempo residuo/ETA, pausa, resume, cancel, ventola e luce |
| **Movimento** | `/movement` | Visualizzazione isometrica della posizione della testa nel volume di stampa + pannello di estrusione |
| **File** | `/filelist` | Navigazione delle cartelle `gcodes`, anteprime, metadati, upload, creazione cartella, rinomina, sposta, elimina |
| **Impostazioni** | `/settings` | Elenco di sottopagine: rete, console, update, log, history, statistiche, fuso orario, config editor, wiki |
| **Rete** | `/settings/network` | Stato adattatore, IP, scansione Wi-Fi, connessione a rete (anche nascosta), disconnessione |
| **Console** | `/settings/console` | Terminale G-code su WebSocket Moonraker, con cronologia comandi |
| **Log** | `/settings/log` | Download di `klippy.log`, `moonraker.log`, `crowsnest.log`; un pulsante pulisce (rollover) i log di Klipper e Moonraker |
| **Update** | `/settings/update` | Update manager di Moonraker: elenco dei componenti con versione e stato, check update, **Update all** (sistema operativo compreso), soft/hard recovery sui repo rotti, log live dell'operazione |
| **Fuso orario** | `/settings/timezone` | Mappa del mondo con la fascia oraria evidenziata, orologio della zona e tendina con ricerca sulle 419 zone IANA. Il salvataggio è ancora **finto**: manca l'endpoint lato host |
| **Config editor** | `/settings/config-editor` | Albero dei file di configurazione (cartelle comprese), modifica e salvataggio, crea/rinomina/elimina/upload/download, firmware restart suggerito al salvataggio o lanciabile a mano. Pagina **di sviluppo**, da disattivare in produzione |

Le notifiche di errore/avviso provenienti da Klipper e Moonraker sono globali: arrivano come
toast in sovrimpressione su qualunque pagina (`MoonrakerNotifier` + `ToastContainer`).

Globale è anche il **pulsante di emergency stop** in fondo alla dock: `POST /printer/emergency_stop`
da qualunque pagina, senza conferma. Lo stesso tasto è la via di ritorno — a macchina ferma diventa
il firmware restart che la rimette operativa, dietro conferma. Il pulsante fisico sulla macchina
resta il dispositivo di sicurezza; questo serve a chi ha in mano il telefono. Vedi
[04 — Emergency stop](04-moonraker.md#emergency-stop).

E quando Kalico è fermo — per un emergency stop, un errore o perché il processo host non c'è —
dashboard, file e movimento vengono coperti da un **avviso non chiudibile** con il motivo dello
stop: a firmware fermo quelle pagine mostrano solo valori congelati e comandi che non fanno
niente. Restano raggiungibili la dock e tutte le Impostazioni, cioè il pulsante che fa ripartire
la macchina e le pagine in cui si capisce cos'è successo.

## Fuori ambito per scelta

Cose che Mainsail fa e GingerView deliberatamente **non** farà. Sono decisioni prese, non
funzionalità mancanti:

- **Nessun controllo libero della temperatura.** Non c'è un termostato manuale in dashboard.
  Il flusso di estrusione (`ExtrudeDialog`, vedi [07 — Stato attuale](07-stato-attuale.md)) fa
  eccezione: imposta e attende le temperature, ma solo come passo automatico della sua
  sequenza guidata (homing → muovi → scalda → estrudi), non come controllo libero.
- **Nessuna autenticazione.** Moonraker su G2-OS è configurato senza, e GingerView non invia
  credenziali.
- **Nessun Mainsail affiancato.** Non viene installato accanto a GingerView; la voce di menu
  che oggi lo richiama va rimossa.

> L'**emergency stop** stava in questo elenco: la decisione è stata ribaltata e il pulsante ora è
> nella dock (vedi sopra). Non è cambiata la premessa — il pulsante fisico resta il dispositivo di
> sicurezza della macchina — è cambiato il fatto che, con l'utente collegato dal telefono, avere il
> comando anche a schermo non toglie niente al pulsante fisico.

## Dove gira

GingerView è una **SPA statica**: viene compilata in HTML/JS/CSS e servita da nginx
direttamente sul Raspberry Pi della stampante, sulla porta 80. Non c'è un backend proprio —
tutta la logica è nel browser, che parla direttamente con Moonraker e con G2-Service (rete e
fuso orario).

L'obiettivo di distribuzione è **G2-OS**, un fork di
[MainsailOS](https://github.com/mainsail-crew/MainsailOS) in cui, al posto di Mainsail, viene
installato GingerView. Vedi [06 — Build e deploy](06-deploy.md).

## Glossario

- **Kalico** — il firmware di stampa, fork di Klipper, usato da Ginger. Sempre nell'ultima
  versione disponibile. Nella documentazione "Klipper" compare solo dove si parla di API o
  concetti comuni a entrambi.
- **Moonraker** — il server API che espone Kalico via HTTP e WebSocket (porta `7125`).
  Su G2-OS è configurato **senza autenticazione**.
- **GingerSlicer** — lo slicer Ginger (basato su OrcaSlicer) che deve potersi connettere alla
  macchina per inviare i file.
- **G2-OS** — l'immagine di sistema Ginger, fork di MainsailOS:
  [gingeradditive/g2-os](https://github.com/gingeradditive/g2-os).
- **Zona** — una delle sezioni riscaldate dell'unico ugello. Esposta da Kalico come un
  `extruder` separato.
