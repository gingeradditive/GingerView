# TODO

Solo le cose da fare. Quando un task è completato viene **rimosso** da qui: quello che è già
stato fatto si legge nella documentazione (`01`–`07`), non in questo file.

**Codici.** Ogni task ha un codice `AREA-n` con cui puoi farvi riferimento rapidamente
("fai MOV-1", "MAT-2 è bloccato"). I codici sono **stabili e non vengono mai riusati**:
l'area indica l'argomento, non lo stato, così un task che si sblocca mantiene il suo codice.

**Stato.** `pronto` = si può iniziare. `→ Qn` = bloccato dalla domanda corrispondente in
[Q&A.md](Q&A.md).

| Area | Argomento |
|---|---|
| `MOV` | Movimento ed estrusione |
| `MAT` | Materiale e pellet |
| `TMP` | Temperature e zone dell'ugello |
| `PRN` | Avvio e gestione stampa |
| `CAM` | Webcam |
| `SET` | Sottopagine Impostazioni |
| `NET` | Rete e servizio Wi-Fi |
| `CFG` | Conoscenza della macchina a runtime |
| `UI` | Interfaccia, layout, lingua |
| `CLN` | Pulizia del codice |
| `QA` | Qualità e strumenti |
| `ROB` | Robustezza |
| `DEP` | Build, deploy e G2-OS |

---

## MOV — Movimento ed estrusione

| Codice | Task | Stato |
|---|---|---|
| `MOV-3` | Definire e implementare cosa fa il pulsante **Move** | → Q6 |
| `MOV-4` | Verificare su hardware reale la sequenza G-code di `handleExtrude()` (homing → move → heat → estrudi), in particolare l'ipotesi sul `rotation_distance` volumetrico | → Q32 |

## MAT — Materiale e pellet

| Codice | Task | Stato |
|---|---|---|
| `MAT-1` | Parametrizzare la capienza tramoggia per modello, oggi `maxPelletKg = 5` fisso | dipende da `CFG-1` |
| `MAT-2` | Definire la formula filamento → pellet e correggere `DashboardPelletPanel` | → Q1 |

## TMP — Temperature e zone dell'ugello

| Codice | Task | Stato |
|---|---|---|
| `TMP-1` | Ripensare la presentazione delle zone dell'ugello nel pannello temperature | → Q27 |
| `TMP-2` | Ricavare le zone da `/printer/objects/list` invece dell'elenco fisso a quattro | pronto |

## CAM — Webcam

| Codice | Task | Stato |
|---|---|---|
| `CAM-1` | Mostrare lo stream Crowsnest nell'interfaccia e aggiungere il proxy `/webcam/` all'installer | → Q11 |

## SET — Sottopagine Impostazioni

| Codice | Task | Stato |
|---|---|---|
| `SET-1` | Decidere se le sottopagine vanno riprogettate o solo implementate | → Q28 |
| `SET-4` | Rifare `/settings/history` su `GET /server/history/list` | dipende da `SET-1` |
| `SET-5` | Rifare `/settings/statistics` su `GET /server/history/totals` | dipende da `SET-1` |
| `SET-6` | Rifare `/settings/timezone`, che non ha un endpoint Moonraker | → Q16 |
| `SET-7` | Verificare su hardware reale le operazioni **mutanti** della pagina Update (`upgrade`, `recover`): finora è stato provato solo `status` in lettura | pronto |
| `SET-8` | Dopo un aggiornamento di **GingerView stesso** il browser continua a servire il bundle vecchio: valutare un reload automatico a fine operazione | pronto |

## NET — Rete e servizio Wi-Fi

| Codice | Task | Stato |
|---|---|---|
| `NET-1` | Decidere se il servizio di rete resta separato o entra in GingerView, e implementare di conseguenza | → Q16 |

## CFG — Conoscenza della macchina a runtime

| Codice | Task | Stato |
|---|---|---|
| `CFG-1` | Dare all'applicazione un modo per sapere su quale modello di macchina gira | → Q26 |

## UI — Interfaccia, layout, lingua

| Codice | Task | Stato |
|---|---|---|
| `UI-2` | Portare tutta l'interfaccia in inglese, `aria-label` e dialoghi compresi | pronto |
| `UI-3` | Verificare se l'accesso da telefono richiede pagine dedicate (onboarding, QR) | → Q31 |
| `UI-4` | Rivedere `zoom: 0.8` sotto 768px in `app.css`, residuo dell'impostazione pre-telefono | pronto |
| `UI-5` | Ritarare i breakpoint sul caso d'uso reale, cioè lo schermo di un cellulare | pronto |
| `UI-6` | Sostituire i colori hardcoded nei CSS dei componenti con i token della palette | pronto |

## CLN — Pulizia del codice

| Codice | Task | Stato |
|---|---|---|
| `CLN-1` | Rimuovere `DemoComponent.svelte` e `klipper-websocket.ts` (codice morto) | pronto |
| `CLN-2` | Disinstallare `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`, `@mdi/react` | pronto |
| `CLN-3` | Rimuovere i `console.log` di debug da `network-api.ts` | pronto |
| `CLN-4` | Convertire `ToolheadPosition.svelte` dalla sintassi legacy `$:` alle rune Svelte 5 | pronto |
| `CLN-5` | Decidere se cablare `configService.validateConfig()`, oggi implementato ma mai chiamato | pronto |
| `CLN-6` | Rimuovere `VITE_PRINTER_NAME` e `VITE_CONNECTION_TIMEOUT` da `config.ts`, oppure usarle davvero: oggi non hanno effetto | pronto |

## QA — Qualità e strumenti

| Codice | Task | Stato |
|---|---|---|
| `QA-1` | Riparare `npm run lint`: `prettier --check` fallisce su 93 file | pronto |
| `QA-2` | Riparare il crash di `eslint` su `ToolheadPosition.svelte` (`@typescript-eslint/no-unused-vars`) | pronto |
| `QA-3` | Eseguire `npm run format` una volta su tutto il repo, in un commit isolato | pronto |
| `QA-4` | Aggiungere un hook pre-commit o un job CI che esegua `check` e `lint` | pronto |
| `QA-5` | Valutare test unitari o end-to-end sul frontend | pronto |
| `QA-6` | Risolvere i 16 warning di `svelte-check` in `PrintList.svelte` (a11y, `non_reactive_update`) | pronto |
| `QA-7` | Valutare `npm audit fix`: 15 vulnerabilità, di cui 4 raggiungono il bundle. Comporta rigenerare `build/` | pronto |

## ROB — Robustezza

| Codice | Task | Stato |
|---|---|---|
| `ROB-1` | Mostrare uno stato "dati non aggiornati" quando il polling fallisce, oggi silenzioso | pronto |
| `ROB-2` | Sospendere il polling dei pannelli fuori dalla viewport del carosello | pronto |
| `ROB-3` | Ottimizzare `fetchDirectoriesRecursive()`, che scarica tutto l'albero `gcodes` in sequenza | pronto |
| `ROB-4` | Valutare `printer.objects.subscribe` via WebSocket al posto del polling HTTP | pronto |
| `ROB-5` | Verificare il comportamento dell'interfaccia con Kalico in stato `shutdown` o disconnesso | pronto |

## DEP — Build, deploy e G2-OS

| Codice | Task | Stato |
|---|---|---|
| `DEP-3` | Scrivere il modulo GingerView per G2-OS, o concordare chi lo fa | → Q30 |
| `DEP-4` | Verificare che G2-OS imposti hostname `g2` e avahi, così che `g2.local` risolva | pronto |
| `DEP-7` | Aggiungere un controllo in CI o un hook che impedisca di committare un `build/` con indirizzi compilati dentro | pronto |
| `DEP-8` | Verificare l'installazione su una macchina reale, non solo nel container di test | pronto |
| `DEP-9` | Verificare la connessione da GingerSlicer senza indicare la porta | pronto |
| `DEP-10` | Documentare la configurazione `moonraker.conf` attesa (`authorization`, `update_manager`) | pronto |
