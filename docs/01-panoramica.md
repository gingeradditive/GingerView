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
| **Impostazioni** | `/settings` | Elenco di sottopagine: rete, console, update, log, history, statistiche, fuso orario, wiki |
| **Rete** | `/settings/network` | Stato adattatore, IP, scansione Wi-Fi, connessione a rete (anche nascosta), disconnessione |
| **Console** | `/settings/console` | Terminale G-code su WebSocket Moonraker, con cronologia comandi |

Le notifiche di errore/avviso provenienti da Klipper e Moonraker sono globali: arrivano come
toast in sovrimpressione su qualunque pagina (`MoonrakerNotifier` + `ToastContainer`).

## Fuori ambito per scelta

Cose che Mainsail fa e GingerView deliberatamente **non** farà. Sono decisioni prese, non
funzionalità mancanti:

- **Nessun pulsante di emergency stop.** La macchina ne ha uno fisico, che resta l'unico
  modo previsto per fermarla in emergenza. L'interfaccia non espone
  `POST /printer/emergency_stop`.
- **Temperature in sola lettura.** I setpoint non si impostano dall'interfaccia.
- **Nessuna autenticazione.** Moonraker su G2-OS è configurato senza, e GingerView non invia
  credenziali.
- **Nessun Mainsail affiancato.** Non viene installato accanto a GingerView; la voce di menu
  che oggi lo richiama va rimossa.

## Dove gira

GingerView è una **SPA statica**: viene compilata in HTML/JS/CSS e servita da nginx
direttamente sul Raspberry Pi della stampante, sulla porta 80. Non c'è un backend proprio —
tutta la logica è nel browser, che parla direttamente con Moonraker e con il servizio di rete.

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
