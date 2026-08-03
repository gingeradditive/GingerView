# TODO

Solo le cose da fare. Quando un task è completato viene **rimosso** da qui: quello che è già
stato fatto si legge nella documentazione (`01`–`07`), non in questo file.

**Codici.** Ogni task ha un codice `AREA-n` con cui puoi farvi riferimento rapidamente
("fai MOV-1", "MAT-2 è bloccato"). I codici sono **stabili e non vengono mai riusati**:
l'area indica l'argomento, non lo stato, così un task che si sblocca mantiene il suo codice.

**Formato.** Una riga per task: `` `CODICE` `` + descrizione + stato in fondo. Lo stato è
`— pronto` (si può iniziare), `→ Qn` (bloccato dalla domanda corrispondente in
[Q&A.md](Q&A.md)) oppure `— dipende da CODICE` (bloccato da un altro task).

**Aree.**

- `MOV` — Movimento ed estrusione
- `MAT` — Materiale e pellet
- `TMP` — Temperature e zone dell'ugello
- `PRN` — Avvio e gestione stampa
- `CAM` — Webcam
- `SET` — Sottopagine Impostazioni
- `NET` — Rete e G2-Service
- `CFG` — Conoscenza della macchina a runtime
- `UI` — Interfaccia, layout, lingua
- `CLN` — Pulizia del codice
- `QA` — Qualità e strumenti
- `ROB` — Robustezza
- `DEP` — Build, deploy e G2-OS

---

## MOV — Movimento ed estrusione

- `MOV-3` Definire e implementare cosa fa il pulsante **Move** → Q6

## MAT — Materiale e pellet

- `MAT-1` Parametrizzare la capienza tramoggia per modello, oggi `maxPelletKg = 5` fisso — dipende da `CFG-1`
- `MAT-2` Definire la formula filamento → pellet e correggere `DashboardPelletPanel` → Q1

## TMP — Temperature e zone dell'ugello

- `TMP-1` Ripensare la presentazione delle zone dell'ugello nel pannello temperature → Q27

## CAM — Webcam

- `CAM-1` Mostrare lo stream Crowsnest nell'interfaccia e aggiungere il proxy `/webcam/` all'installer → Q11

## SET — Sottopagine Impostazioni

- `SET-1` Decidere se le sottopagine vanno riprogettate o solo implementate → Q28
- `SET-4` Rifare `/settings/history` su `GET /server/history/list` — dipende da `SET-1`
- `SET-5` Rifare `/settings/statistics` su `GET /server/history/totals` — dipende da `SET-1`
- `SET-10` Decidere quando disattivare il config editor (`CONFIG_EDITOR_ENABLED = false`) e se la rotta va rimossa del tutto: oggi resta raggiungibile scrivendo l'URL a mano. Se la rotta sparisce vanno disinstallate anche le dipendenze CodeMirror (`codemirror`, `@codemirror/*`, `@lezer/highlight`) e cancellato `src/lib/editor/`, usati solo lì — pronto

## NET — Rete e G2-Service

- `NET-6` Valutare un pulsante **Disconnect** sulla rete corrente: l'endpoint c'è
  (`POST /service/network/wifi/disconnect`, asincrono come `connect`) e spegne anche
  l'autoconnect, ma oggi nessuna pagina lo chiama e la riga della rete attiva non è cliccabile
  — pronto
- `NET-7` Valutare la gestione delle **reti salvate**: `GET /service/network/wifi/saved`
  (`ssid`, `autoconnect`, `lastUsed`) e `DELETE /service/network/wifi/saved/{ssid}` per
  dimenticarne una. Oggi non c'è modo di rimuovere una rete salvata dall'interfaccia — pronto
- `NET-8` Valutare l'uso di `GET /service/network/ethernet/status`: dà `cableConnected` e
  `addressing` (`dhcp`/`static`), che lo stato unificato non riporta. Oggi la pagina deduce
  "cavo staccato" da `interfaces[].state === "unavailable"`, che è sufficiente per il messaggio
  ma non per una sezione Ethernet vera — pronto

## CFG — Conoscenza della macchina a runtime

- `CFG-1` Dare all'applicazione un modo per sapere su quale modello di macchina gira → Q26

## CLN — Pulizia del codice

- `CLN-2` Disinstallare `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`, `@mdi/react` — pronto
- `CLN-4` Convertire `ToolheadPosition.svelte` dalla sintassi legacy `$:` alle rune Svelte 5. Risolve da solo tutti e 9 gli errori `svelte/no-immutable-reactive-statements` del repo, che sono lì (righe 68–77): correggerli a mano prima è lavoro buttato — vedi [PULIZIA-LINT.md](PULIZIA-LINT.md) — pronto
- `CLN-5` Decidere se cablare `configService.validateConfig()`, oggi implementato ma mai chiamato — pronto
- `CLN-6` Rimuovere `VITE_PRINTER_NAME` e `VITE_CONNECTION_TIMEOUT` da `config.ts`, oppure usarle davvero: oggi non hanno effetto — pronto
- `CLN-7` Spostare `:global(.spin)` + `@keyframes spin` in `app.css`: oggi è ridefinita in sei componenti/pagine, e chi usa `class="spin"` senza dichiararla localmente ha uno spinner immobile — la pagina Update funziona solo perché `UpdateLogModal` la porta dietro — pronto
- `CLN-8` Annullare la subscribe a `currentDirPath` in `CurrentDirectory.svelte:11`, oggi mai disiscritta: il componente è montato dentro `PrintList`, quindi il leak si accumula a ogni entrata/uscita dalla lista di stampa — vedi [PULIZIA-LINT.md](PULIZIA-LINT.md) — pronto
- `CLN-9` Decidere se cancellare `src/lib/types/klipper.ts`: dopo `CLN-1` nessun file lo importa
  più, l'unico consumatore era `klipper-websocket.ts`. `KlipperMessage` può tornare utile se si
  tipizza il confine JSON-RPC (`QA-10`), quindi va deciso insieme a quello — pronto

## QA — Qualità e strumenti

- `QA-4` Aggiungere un hook pre-commit o un job CI che esegua `check` e `lint` — pronto
- `QA-5` Valutare test unitari o end-to-end sul frontend — pronto
- `QA-6` Risolvere i 16 warning di `svelte-check` in `PrintList.svelte` e `PrintCard.svelte` (a11y, `non_reactive_update`) — pronto
- `QA-7` Valutare `npm audit fix`: 15 vulnerabilità, di cui 4 raggiungono il bundle. Comporta rigenerare `build/` — pronto
- `QA-8` Passare i link e i `goto()` interni per `resolve()`, 7 punti (`svelte/no-navigation-without-resolve`), oppure spegnere la regola motivandolo: oggi non è un bug perché `kit.paths.base` non è impostata — vedi [PULIZIA-LINT.md](PULIZIA-LINT.md) — pronto
- `QA-9` Aggiungere le key ai 5 `{#each}` che ne sono privi (`svelte/require-each-key`), distinguendo liste statiche (indice va bene) da liste dinamiche come la console (serve una key vera) — vedi [PULIZIA-LINT.md](PULIZIA-LINT.md) — pronto
- `QA-10` Togliere i 3 `any` residui passando a `unknown` + narrowing: sono sul confine JSON-RPC di Moonraker e due stanno nel tipo `KlipperMessage`, che oggi nessuno importa più — vedi [PULIZIA-LINT.md](PULIZIA-LINT.md) — dipende da `CLN-9`
- `QA-11` Silenziare con commento motivato `svelte/prefer-svelte-reactivity` su `completedApps` in `settings/update`: lì la regola sbaglia, il valore non è mai osservato da un template e `SvelteSet` sarebbe la correzione sbagliata — vedi [PULIZIA-LINT.md](PULIZIA-LINT.md) — pronto

## ROB — Robustezza

- `ROB-1` Mostrare uno stato "dati non aggiornati" quando il polling fallisce, oggi silenzioso — pronto
- `ROB-2` Sospendere il polling dei pannelli fuori dalla viewport del carosello — pronto
- `ROB-3` Ottimizzare `fetchDirectoriesRecursive()`, che scarica tutto l'albero `gcodes` in sequenza — pronto
- `ROB-4` Valutare `printer.objects.subscribe` via WebSocket al posto del polling HTTP — pronto
- `ROB-6` `uploadFile()` in `moonraker-files.ts` passa il percorso completo nel campo `root` (`root=gcodes/sottocartella`), ma per Moonraker `root` può essere solo `gcodes` o `config` e la sottocartella va nel campo `path`: l'upload in una sottocartella dei G-code dovrebbe quindi fallire. Da verificare su una macchina reale e, se confermato, allineare a `writeConfigFile()` in `moonraker-config.ts`, che separa i due campi — pronto

## DEP — Build, deploy e G2-OS

- `DEP-3` Scrivere il modulo GingerView per G2-OS, o concordare chi lo fa → Q30
- `DEP-7` Aggiungere un controllo in CI o un hook che impedisca di committare un `build/` con indirizzi compilati dentro — pronto
- `DEP-10` Documentare la configurazione `moonraker.conf` attesa (`authorization`, `update_manager`) — pronto
