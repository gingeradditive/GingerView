# 07 — Stato attuale e limiti noti

Fotografia del progetto al **30 luglio 2026**, branch `graphics-fixes`, dopo la riscrittura
dell'installer, il passaggio a same-origin e l'implementazione di homing/estrusione/avvio
stampa guidati. Serve a evitare che si perda tempo su cose già note o si scambi un segnaposto
per un bug.

## Funzionalità complete

- Dashboard, in sola lettura: temperature, flusso, altezza Z, pellet, info job, avanzamento, ETA.
- Controlli di stampa: pausa, resume, cancel.
- Ventola e luce (`LED_CAMERA`) con popup a slider.
- Browser file: navigazione cartelle, thumbnail, metadati, upload, crea cartella, rinomina,
  sposta, elimina.
- Impostazioni rete: stato, scansione Wi-Fi, connessione (anche a rete nascosta), disconnessione.
- Console G-code con cronologia comandi.
- Pagina Log (`/settings/log`): download di `klippy.log`, `moonraker.log`, `crowsnest.log` e
  pulsante per pulire (rollover) i log di Klipper e Moonraker in un colpo solo, senza chiedere
  quale — vedi [04 — Moonraker](04-moonraker.md#log). Crowsnest non ha un meccanismo di
  rollover lato Moonraker, quindi il suo log non viene mai pulito da qui.
- Sistema di notifiche toast collegato agli eventi Klipper/Moonraker.
- Avvio stampa dal popup dettagli file: il pulsante **Print** apre
  [PrintStartWizard.svelte](../src/lib/components/PrintStartWizard.svelte), un wizard a 4 step
  (procedi/cancel) — materiale/tubi, ugello/bed, spray protettivo piano, aspiratore/valvola
  dryer — e solo all'ultimo step invia `POST /printer/print/start?filename=...`, poi torna
  sulla dashboard (`goto('/')`).

## Segnaposto

### Sottopagine "Coming soon"

`/settings/update`, `/settings/history`, `/settings/statistics`, `/settings/timezone` sono
tutte tre righe che istanziano `SettingsSubpage` senza contenuto. La voce è nel menu, la rotta
esiste, la funzionalità no. Sono considerate "roba vecchia da rifare", non solo da riempire
(Q28). `/settings/log` è uscito da questo elenco: vedi "Funzionalità complete" sopra.

Indicazioni già raccolte:

- **Update** deve aggiornare **tutto il sistema**, non solo GingerView.
- **History**, **Statistics** e **Timezone** restano da progettare. Per il fuso orario va
  tenuto presente che **Moonraker non espone alcun endpoint**: serve passare dal servizio di
  rete o aggiungerne uno, il che dipende da come si risolve Q16.

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
  (verifica ugello pulito / bed libero) e solo alla conferma invia `G28`; è disabilitato mentre
  il comando è in corso.
- [ExtrudeDialog.svelte](../src/lib/components/ExtrudeDialog.svelte) ha tre selettori: quantità
  (Low/Mid/High → 1000/10000/20000 mm³), velocità (Slow/Standard/Boost → 50/150/250 mm³/s) e
  temperatura (PETG/PLA/Custom). I preset temperatura coprono le 4 zone dell'ugello
  (`extruder`..`extruder3`, vedi nota sotto) e portano anche un `rotation_distance` non
  mostrato in interfaccia (PETG 450, PLA e Custom 330); "Custom" apre un popup con un campo
  °C per ciascuna delle quattro zone. Il pulsante **Extrude** ora esegue davvero una sequenza,
  mostrando la fase in corso come testo del pulsante (disabled nel frattempo): stesso popup di
  avvertimento homing → `G28` → spostamento al centro X, Y0, Z250 → `SET_HEATER_TEMPERATURE` +
  `TEMPERATURE_WAIT` sulle 4 zone → `SET_EXTRUDER_ROTATION_DISTANCE` + `G1 E<volume>` relativo.
  L'ultimo passaggio è **non verificato su hardware reale** (Q32 in [Q&A.md](Q&A.md)): presuppone
  che il `rotation_distance` dell'estrusore reale sia calibrato in mm³/rotazione per materiale.

Il pulsante **Move** non ha ancora un bersaglio (Q6).

### Il calcolo del pellet non ha fondamento fisico

[DashboardPelletPanel.svelte](../src/lib/components/DashboardPelletPanel.svelte) ricava i
chilogrammi consumati da `print_stats.filament_used` assumendo **filamento da 1.75 mm e
densità PLA 1.24 g/cm³**. La macchina è a pellet: quel calcolo è un segnaposto. Kalico espone
le grandezze in filamento virtuale e serve una formula di riconversione, ancora da definire
(Q1 in [Q&A.md](Q&A.md)).

Anche `maxPelletKg = 5` è hardcoded: è la capienza della G2, ma va parametrizzata per modello,
il che presuppone che l'applicazione sappia su quale macchina gira (Q26).

### Le 4 zone dell'ugello sono presentate come 4 estrusori

`DashboardTemperaturePanel` interroga un elenco fisso `extruder`, `extruder1`, `extruder2`,
`extruder3`. Non sono quattro utensili: sono le **zone riscaldate dell'unico ugello** (tre
sulla G1). L'etichettatura andrebbe rivista di conseguenza, e l'elenco ricavato da
`/printer/objects/list` invece che fissato nel codice (Q27).

In dashboard restano **in sola lettura**: non c'è un termostato manuale. Il flusso di
estrusione fa eccezione (vedi sopra): imposta e attende le temperature, ma solo come passo
automatico della sua sequenza, non come controllo libero.

## Decisioni prese, ancora da applicare

Queste non sono più questioni aperte: la scelta è fatta, manca l'esecuzione. I task
corrispondenti sono in [TODO.md](TODO.md).

### Codice morto da rimuovere

[DemoComponent.svelte](../src/lib/components/DemoComponent.svelte) non è referenziato da
nessuna rotta ed è l'unico consumatore di `klipper-websocket.ts`: i due si tengono in vita a
vicenda senza che nulla li usi. Le connessioni WebSocket realmente attive sono quelle aperte
da `moonraker-notifier.ts` e dalla pagina console. **Entrambi vanno eliminati.**

### Dipendenze React da rimuovere

`@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled` e `@mdi/react`
sono librerie React, presenti in `package.json` ma non importate da alcun file Svelte.
**Da disinstallare**; se in futuro servissero, si reinstallano.

### Interfaccia da riportare tutta in inglese

Oggi è mista: etichette in inglese, `aria-label` e alcuni dialoghi in italiano ("Crea",
"Annulla", "Rinomina", "Torna a Settings"). **La lingua dell'interfaccia è l'inglese**; la
documentazione resta in italiano. Non serve i18n: le stringhe sono letterali nei componenti.

## Incoerenze aperte

### `validateConfig()` mai chiamato

`configService.validateConfig()` è implementato e testabile, ma non viene invocato all'avvio:
una configurazione errata si manifesta come richieste fallite invece che come messaggio chiaro.

### `npm run lint` non è eseguibile

Due problemi indipendenti, entrambi preesistenti:

- `prettier --check .` segnala **93 file** non formattati. Il repository non è mai stato
  passato con `npm run format`.
- `eslint .` va in **crash** su `ToolheadPosition.svelte` con
  `TypeError: Cannot read properties of undefined (reading 'type')` nella regola
  `@typescript-eslint/no-unused-vars`. Il crash si riproduce sul file non modificato, ed è
  verosimilmente legato alla sintassi reattiva legacy `$:` presente in quel componente.

Poiché lo script è `prettier --check . && eslint .`, oggi eslint non viene nemmeno raggiunto.

### Il servizio di rete è un'architettura da decidere

La gestione Wi-Fi passa da un servizio separato sulla porta 8000, installato da G2-OS. È in
discussione se assorbirlo dentro GingerView, dato che fa poche cose — scelta che però
trasformerebbe il progetto da SPA statica a interfaccia + backend, con un servizio e un unit
systemd da installare. Vedi Q16 in [Q&A.md](Q&A.md).

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
  in CI o un hook.

Il repository [gingeradditive/g2-os](https://github.com/gingeradditive/g2-os) esiste ma è
ancora il fork MainsailOS non adattato: preinstalla Mainsail e **non ha un modulo GingerView**.
È il pezzo mancante fra questo repository e l'immagine di sistema.

## Robustezza

- **Fallimenti di polling silenziosi.** I pannelli della dashboard usano `catch {}`: se la
  stampante non risponde, i valori restano fermi all'ultima lettura senza indicazione visiva.
  È voluto per non riempire lo schermo di toast, ma significa che un dato "vecchio" e uno
  "attuale" sono indistinguibili.
- **Pannelli non visibili continuano a interrogare.** Le slide fuori dalla viewport del
  carosello restano montate e mantengono attivo il proprio `setInterval`.
- **Nessun test sul frontend.** L'unico test del progetto è
  [script/test-install.sh](../script/test-install.sh), che copre l'installer in un container.
  Non esistono unit test né test end-to-end sull'applicazione, e nessun hook git impone
  `lint`/`check` prima del commit.
- **`fetchDirectoriesRecursive` scarica tutto l'albero.** Viene invocata all'apertura del
  dialogo "sposta" e visita ricorsivamente ogni sottocartella di `gcodes`: su una struttura
  profonda genera molte richieste sequenziali.
