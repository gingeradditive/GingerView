# 06 — Build e deploy

## Modello di distribuzione

GingerView non ha un server proprio. Il deploy consiste in:

1. compilare la SPA in `build/`;
2. far servire quella cartella da **nginx sulla porta 80** del Raspberry Pi della stampante;
3. far inoltrare a nginx le API di Moonraker sulla **stessa origine**, così che né il browser
   né GingerSlicer debbano indicare una porta.

Il risultato è che aprendo l'IP della stampante si ottiene GingerView, e che
`http://<ip>/server/info` risponde con Moonraker.

## Installazione

```bash
sudo script/install.sh
```

Lo script è idempotente: rieseguirlo converge allo stesso stato invece di accumulare
configurazioni. Non richiede Node, perché `build/` arriva già compilato dal repository.

### Opzioni

| Opzione | Default | Descrizione |
|---|---|---|
| `--src PATH` | cartella padre dello script | Checkout di GingerView da servire |
| `--user NAME` | `$SUDO_USER`, poi proprietario del checkout, poi primo utente ≥1000 | Proprietario di checkout e `printer_data` |
| `--port N` | `80` | Porta su cui esporre GingerView |
| `--moonraker-host H` | `127.0.0.1` | Indirizzo di Moonraker |
| `--moonraker-port N` | `7125` | Porta di Moonraker |
| `--network-api-host H` | `127.0.0.1` | Indirizzo del servizio Wi-Fi |
| `--network-api-port N` | `8000` | Porta del servizio Wi-Fi |
| `--printer-data PATH` | `~USER/printer_data` | Per registrare l'`update_manager` |
| `--purge-mainsail` | off | Elimina anche i file Mainsail e la sua voce `update_manager` |
| `--skip-packages` | off | Non installa nginx via apt |
| `--no-reload` | off | Scrive la configurazione senza ricaricare nginx |
| `--print-config` | — | Stampa il site nginx su stdout ed esce (non richiede root) |

`--print-config` è utile per ispezionare o diffare la configurazione prima di applicarla:

```bash
script/install.sh --print-config --moonraker-port 7125
```

### Cosa fa lo script

1. Verifica che esista `build/index.html`, altrimenti si ferma con un messaggio esplicito.
2. Installa nginx se manca (`apt-get`, non interattivo).
3. **Libera la porta**: disabilita il site `default` e i site Mainsail che rivendicano la
   porta scelta. Un Mainsail su un'altra porta viene lasciato in funzione (vedi sotto).
4. Scrive `/etc/nginx/conf.d/gingerview-common.conf` (la `map` per l'upgrade WebSocket) e il
   site GingerView.
5. Corregge i permessi di traversata verso la web root.
6. Esegue `nginx -t` e ricarica nginx se systemd è attivo.
7. Registra GingerView nell'`update_manager` di Moonraker.

### Layout nginx

Lo script usa `sites-available`/`sites-enabled` quando `nginx.conf` li include davvero,
altrimenti ricade su `conf.d`, che ogni distribuzione include. La `map` per l'upgrade
WebSocket sta sempre in `conf.d` perché deve stare nel contesto `http`, e usa una variabile
namespaced (`$gingerview_connection_upgrade`) per non collidere con il
`$connection_upgrade` che le immagini MainsailOS definiscono in `conf.d/common_vars.conf`.

### Il proxy

```nginx
location /websocket                            → 127.0.0.1:7125/websocket
location ^~ /api/wifi/                         → 127.0.0.1:8000
location ~ ^/(printer|api|access|machine|server)/ → 127.0.0.1:7125$request_uri
location /                                     → try_files … /index.html
```

Due dettagli non ovvi:

- **`/api/wifi/` usa `^~`.** Senza quel modificatore la regex di Moonraker, che include `api`,
  avrebbe la precedenza sul prefisso e le chiamate Wi-Fi finirebbero a Moonraker con un 404.
  Con `^~` il prefisso vince sulla regex.
- **`/api/` va a Moonraker** perché è il suo livello di compatibilità OctoPrint, che gli
  slicer interrogano (`/api/version`).

Sono impostati anche `client_max_body_size 0` e `proxy_request_buffering off`, perché gli
upload di G-code sono grandi e non vanno né limitati né bufferizzati su disco.

`index.html` è servito con `no-store`, mentre `/_app/immutable/` è marcato `immutable` con
scadenza a un anno: senza la prima direttiva un aggiornamento continuerebbe a servire il
vecchio entry point.

### Permessi

nginx deve poter attraversare ogni cartella superiore alla web root. Le immagini Raspberry Pi
OS recenti creano le home con permessi `750`, il che produce un 403 silenzioso: lo script
rileva la situazione leggendo direttamente i bit di permesso e aggiunge `o+x` solo dove serve,
segnalando ogni modifica. Il controllo non usa `sudo` né `runuser`, che possono mancare in un
chroot di build.

### Cosa lo script non fa

**Non crea `.env`.** Sarebbe inutile: i valori `VITE_*` sono già compilati dentro il bundle
(vedi [03 — Configurazione](03-configurazione.md)), quindi un `.env` scritto in fase di
installazione non avrebbe alcun effetto.

**Non installa Mainsail, e non lo rimuove senza motivo.** Che su G2-OS non ci sia Mainsail è
compito dell'immagine, non dell'installer: l'unica cosa che questo script deve fare è liberare
la porta che sta per occupare.

Quindi un site Mainsail viene toccato **solo se rivendica la stessa porta**, e in quel caso
viene *disabilitato* (rimosso il symlink da `sites-enabled`), non cancellato: la configurazione
in `sites-available` resta al suo posto. Un Mainsail su un'altra porta — **8081 è il caso
tipico di una macchina di sviluppo** — viene lasciato in funzione, e lo script lo dice.

Il riconoscimento guarda le direttive `listen`: conta solo un ascolto *wildcard* sulla porta in
questione. Un site legato a un indirizzo specifico, tipo `listen 192.168.4.1:80` di un portale
access point, può convivere con `listen 80 default_server` e non viene toccato.

`--purge-mainsail` è la rimozione esplicita: cancella i site, i file e la voce
`[update_manager mainsail]`.

## Build

```bash
npm ci
npm run build      # output in build/
```

L'adapter statico produce `index.html` più gli asset. Con `fallback: 'index.html'` il
risultato è una SPA: qualunque percorso deve essere servito da `index.html`.

## Build artifacts committati nel repo

La pipeline [.github/workflows](../.github/workflows) si attiva a ogni push su `main`:

1. checkout, Node dalla versione in `.nvmrc`, `npm ci`;
2. `npm run build`;
3. commit e push della cartella `build/` con messaggio `chore: update build artifacts [skip ci]`.

`build/` è quindi **committato nel repository**. È una scelta deliberata e confermata: permette
all'installazione sulla stampante di non richiedere Node né una toolchain di build — basta
un `git clone` o un `git pull` — ed è il motivo per cui `install.sh` si aspetta di trovare
`build/` già presente.

Il modello di lavoro che la rende sostenibile è: **si sviluppa su branch e si fa merge su
`main` a ogni release**. La CI ricompila e committa `build/` solo sui push a `main`, quindi i
diff binari si concentrano sulle release invece di accumularsi a ogni commit.

Poiché `.env` è gitignorato, la CI compila **sempre** senza variabili, e il bundle risultante
non contiene alcun indirizzo. È esattamente ciò che serve perché la stessa build funzioni su
tutte le macchine.

> Attenzione: se compili in locale **con** un `.env` e committi `build/`, ci finisce dentro
> l'IP della tua stampante. Lascia che sia la CI a produrre gli artefatti.

## Altri script

Tutti condividono `script/_common.sh` (messaggi, prompt, bootstrap di Node da `.nvmrc`).
`install.sh` è l'eccezione: resta autonomo perché deve girare nella pipeline G2-OS, anche
lontano dai suoi fratelli.

| Script | A cosa serve |
|---|---|
| [script/build.sh](../script/build.sh) | Build di produzione locale. Normalmente non serve: ci pensa la CI |
| [script/update.sh](../script/update.sh) | Aggiorna un'installazione esistente. Niente Node, niente root |
| [script/rundev.sh](../script/rundev.sh) | Server di sviluppo. `./rundev.sh` nella root è un forwarder a questo |
| [script/test-install.sh](../script/test-install.sh) | Test di integrazione dell'installer in container |

### build.sh

```bash
script/build.sh [--ci] [--no-env]
```

Usa la versione di Node dichiarata in `.nvmrc`, installa le dipendenze, compila e verifica
l'output. Alla fine **ispeziona il bundle** e dice se contiene indirizzi compilati dentro:

```
✓ Same-origin bundle: no addresses compiled in, works on any printer
```

Questo è il punto importante. Se hai un `.env` locale, i suoi valori finiscono nel bundle e
quella build funziona solo contro la tua stampante: lo script avvisa prima e dopo. Con
`--no-env` mette temporaneamente da parte il `.env` e produce lo stesso bundle della CI; il
file viene ripristinato anche se interrompi con Ctrl-C.

`--ci` usa `npm ci` invece di `npm install`, per una installazione esatta da lockfile.

### update.sh

```bash
script/update.sh [--build] [--reload-nginx]
```

Aggiornare è **solo un fast-forward**: la CI compila e committa `build/`, e nginx serve
direttamente quella cartella. Quindi lo script non richiede Node, non ricompila, non riavvia
nginx e **non ha bisogno di root** — esattamente come l'`update_manager` di Moonraker, che è
registrato con `is_system_service: False`.

Differenze rispetto alla versione precedente, che erano veri e propri difetti:

- **aggiorna il branch su cui sei**, invece di forzare `git checkout main` buttando via quello
  che avevi in mano;
- **si ferma se il working tree è sporco**, invece di rischiare di sovrascrivere modifiche non
  committate;
- **rifiuta un merge non fast-forward** con un messaggio esplicito, invece di creare un merge
  commit a sorpresa;
- non ricompila e non tocca nginx, perché per un aggiornamento di file statici non serve
  (`index.html` è servito con `no-store`).

Dopo il pull mostra i commit applicati e riallinea i permessi dentro `build/`, che i file
appena scaricati ereditano dalla umask.

`--build` ricompila in locale, per una macchina di sviluppo o un branch senza artefatti.
`--reload-nginx` ricarica nginx, utile solo se hai toccato anche la sua configurazione.

### rundev.sh

```bash
script/rundev.sh [--install|--no-install] [argomenti per Vite]
```

Chiede se reinstallare le dipendenze prima di partire:

```
Reinstall dependencies? (s/N)
```

Accetta sia `s`/`si` sia `y`/`yes`. Il default cambia da solo in base alla situazione:

- `node_modules` assente → installa senza chiedere, non è una scelta;
- `package-lock.json` più recente dell'ultima installazione (tipicamente dopo un `git pull`)
  → avvisa e propone **S** come default;
- altrimenti → default **N**.

Il confronto usa `node_modules/.package-lock.json`, che npm 7+ tiene allineato a ogni
installazione: è un marcatore più affidabile della data di modifica della cartella, che si
muove anche per scritture non correlate.

Gli argomenti in più passano a Vite, quindi `./rundev.sh --host` espone il dev server sulla
rete locale — comodo per aprirlo dal telefono, che è il dispositivo di destinazione reale.

Senza terminale interattivo (pipeline, `< /dev/null`) non si blocca mai ad aspettare: usa il
default.

## Aggiornamento di una macchina installata

`install.sh` registra GingerView nell'`update_manager` di Moonraker:

```ini
[update_manager GingerView]
type: git_repo
path: /home/<utente>/GingerView
origin: https://github.com/gingeradditive/GingerView.git
primary_branch: main
is_system_service: False
```

L'aggiornamento diventa così disponibile dall'interfaccia di Moonraker: `git pull` sul repo, e
poiché `build/` è committato **e nginx serve direttamente quella cartella**, il nuovo bundle è
attivo subito, senza ricompilare né riavviare nginx.

## Come si raggiunge la macchina

L'indirizzo è **mDNS**: `g2.local`. Il QR/NFC applicato alla stampante porta lì, e non a un IP,
che con DHCP cambierebbe rendendo il codice inutile.

Perché funzioni, l'hostname di sistema dev'essere `g2` e `avahi-daemon` dev'essere attivo:
sono entrambi compiti dell'immagine G2-OS, non di `install.sh`. Vale la pena verificarlo
esplicitamente quando si scrive il modulo, perché è l'unico modo previsto per arrivare
all'interfaccia.

> Un limite da conoscere: il supporto mDNS su Android è storicamente incostante fra versioni e
> produttori. iOS lo risolve nativamente. Se in campo emergessero telefoni che non risolvono
> `g2.local`, l'alternativa è un access point della macchina con un captive portal, oppure un
> IP fisso stampato accanto al QR.

## GingerSlicer

Con il proxy attivo, in GingerSlicer si aggiunge la stampante come **Klipper/Moonraker**
indicando solo `http://g2.local`, lasciando vuoto il campo della porta. Lo slicer
raggiunge `/server/files/upload` per l'invio dei file e `/printer/...` per lo stato, tutto
sulla porta 80.

## G2-OS

**G2-OS** è l'immagine di sistema Ginger, fork di
[MainsailOS](https://github.com/mainsail-crew/MainsailOS), che al posto di Mainsail installa
GingerView. Il repository esiste: [gingeradditive/g2-os](https://github.com/gingeradditive/g2-os).

> **Stato attuale**: è ancora il fork non adattato. Il README descrive la distribuzione come
> basata su "Kalico Firmware e **Mainsail**", e i moduli preinstallano Mainsail insieme a
> Moonraker, Crowsnest, Sonar e nginx. **Il modulo che installa GingerView al posto di Mainsail
> non è ancora stato scritto**: è il pezzo mancante fra questo repository e l'immagine.

Nota utile: G2-OS include già **Crowsnest**, quindi lo stream webcam è disponibile lato
macchina e serve solo proxarlo e mostrarlo nell'interfaccia.

Lo script è pensato per essere eseguito dalla pipeline durante la costruzione dell'immagine,
non a mano su una macchina già avviata:

- **nessun prompt**: non usa `read`, quindi non blocca una pipeline non presidiata;
- **nessuna dipendenza da `$SUDO_USER`**, che in un chroot non è definito: l'utente si passa
  con `--user` o viene dedotto dal proprietario del checkout;
- **nessuna dipendenza da systemd attivo**: se `/run/systemd/system` non esiste, lo script
  scrive la configurazione, tenta `systemctl enable` ignorando l'esito e lascia l'avvio al
  primo boot;
- **niente `sudo`/`runuser`**, che possono mancare in un'immagine minimale.

Il modulo va scritto seguendo le convenzioni di MainsailOS — in g2-os la struttura è
`modules/`, `patches/` e `config.yml` — sostituendo il modulo `mainsail` con uno che clona
GingerView ed esegue `install.sh`.

## Test dell'installer

[script/test-install.sh](../script/test-install.sh) esegue `install.sh` dentro un container
Debian usa e getta, con finti Moonraker e servizio Wi-Fi, e verifica che:

- la SPA venga servita e che il fallback funzioni su una rotta client-side;
- `/server/`, `/printer/`, `/machine/`, `/api/version` e `/websocket` finiscano a Moonraker,
  query string inclusa;
- `/api/wifi/` vinca sulla regex di Moonraker e vada al servizio Wi-Fi;
- un site Mainsail preesistente venga rimosso e la porta 80 resti a GingerView;
- `index.html` non sia cacheato e `/_app/immutable/` lo sia;
- l'`update_manager` venga registrato una sola volta anche rieseguendo lo script;
- `--purge-mainsail` elimini file e voce `update_manager`.

Serve solo Docker:

```bash
script/test-install.sh
```

Il container riproduce anche la home a permessi `750` delle immagini Raspberry Pi OS recenti,
che è la causa più comune di 403 dopo l'installazione.

## Verifica su una macchina reale

```bash
curl -sS http://<ip>/                 # deve restituire l'HTML di GingerView
curl -sS http://<ip>/settings/network # stessa pagina: fallback SPA
curl -sS http://<ip>/server/info      # deve rispondere Moonraker
curl -sS http://<ip>/api/wifi/status  # deve rispondere il servizio Wi-Fi
```

Se `nginx -t` fallisce con *duplicate default server*, un altro site sta ancora reclamando la
porta 80:

```bash
grep -rl default_server /etc/nginx/sites-enabled /etc/nginx/conf.d
```
