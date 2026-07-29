# TODO

Elenco piatto dei task. `→ Qn` rimanda alla domanda corrispondente in [Q&A.md](Q&A.md):
quei task restano bloccati finché non c'è una risposta.

Aggiornato al 29 luglio 2026, dopo il primo giro di risposte alle Q&A.

---

## Fatto

- [x] Riscrivere `install.sh` da zero, non interattivo e idempotente
- [x] Servire GingerView come interfaccia predefinita su nginx porta 80
- [x] Proxare Moonraker sulla stessa origine, senza dover indicare la porta
- [x] Proxare il servizio Wi-Fi su `/api/wifi/` con precedenza sulla regex Moonraker
- [x] Non installare Mainsail e rimuoverne i site nginx in conflitto
- [x] Rendere l'installer eseguibile in chroot senza systemd, `sudo` o `$SUDO_USER`
- [x] Passare l'applicazione a endpoint same-origin come default (`config.ts`)
- [x] Unificare i 9 `getApiUrl()` duplicati in `getMoonrakerApiUrl()`
- [x] Allineare l'URL WebSocket tra `config.ts` e `moonraker-notifier.ts`
- [x] Scrivere il test di integrazione dell'installer (`script/test-install.sh`)
- [x] Documentare il progetto in `docs/` (panoramica, architettura, config, API, deploy)

## Decise — si può procedere

- [ ] Rimuovere `DemoComponent.svelte` e `klipper-websocket.ts` (codice morto)
- [ ] Disinstallare le dipendenze React: `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`, `@mdi/react`
- [ ] Rimuovere la voce di menu "Mainsail" da `src/routes/settings/+page.svelte`
- [ ] Allineare gli script e la CI a **Node 22** (`build.sh`, `update.sh`, `rundev.sh`, workflow)
- [ ] Unificare `rundev.sh` nella root e `script/rundev.sh` in un solo script su Node 22
- [ ] Portare tutta l'interfaccia in inglese, `aria-label` e dialoghi compresi
- [ ] Collegare il pulsante **Home** di `ToolheadPosition.svelte` a `G28`
- [ ] Collegare il pulsante **Disable Motors** di `ToolheadPosition.svelte` a `M84`
- [ ] Implementare l'avvio stampa dal popup dettagli file (`POST /printer/print/start?filename=...`)
- [ ] Parametrizzare la capienza tramoggia per modello, oggi `maxPelletKg = 5` fisso
- [ ] Rimuovere i `console.log` di debug da `network-api.ts`

## Bloccate — servono risposte

- [ ] Definire la formula di conversione filamento → pellet e correggere `DashboardPelletPanel` → Q1
- [ ] Definire cosa fa il pulsante **Move** della pagina Movement → Q6
- [ ] Implementare `handleExtrude()` con i valori reali di quantità e velocità → Q7
- [ ] Aggiungere la webcam all'interfaccia e il proxy `/webcam/` nell'installer → Q11
- [ ] Decidere se il servizio di rete resta separato o entra in GingerView → Q16
- [ ] Dare all'applicazione un modo per sapere su quale modello di macchina gira → Q26
- [ ] Ripensare la presentazione delle zone dell'ugello nel pannello temperature → Q27
- [ ] Riprogettare le sottopagine Impostazioni → Q28
- [ ] Definire il wizard pre-stampa → Q29
- [ ] Scrivere il modulo GingerView per G2-OS, o concordare chi lo fa → Q30
- [ ] Verificare se l'accesso da telefono richiede pagine dedicate (onboarding, QR) → Q31
- [ ] Definire come la macchina è raggiungibile in modo stabile (hostname, IP, AP) → Q32

## Sottopagine Impostazioni (tutte "Coming soon")

- [ ] Rifare `/settings/update` per aggiornare **tutto il sistema** via `GET /machine/update/status` e `POST /machine/update/upgrade`
- [ ] Rifare `/settings/log` come pagina di download di `klippy.log` e `moonraker.log`
- [ ] Rifare `/settings/history` su `GET /server/history/list`
- [ ] Rifare `/settings/statistics` su `GET /server/history/totals`
- [ ] Rifare `/settings/timezone`, che non ha un endpoint Moonraker → Q16

## Pulizia e coerenza

- [ ] Ricavare le zone dell'ugello da `/printer/objects/list` invece dell'elenco fisso
- [ ] Rivedere `zoom: 0.8` sotto 768px in `app.css`, residuo dell'impostazione pre-telefono
- [ ] Ritarare i breakpoint sul caso d'uso reale, cioè lo schermo di un cellulare
- [ ] Convertire `ToolheadPosition.svelte` dalla sintassi legacy `$:` alle rune Svelte 5
- [ ] Decidere se cablare `configService.validateConfig()`, oggi implementato ma mai chiamato
- [ ] Sostituire i colori hardcoded nei CSS dei componenti con i token della palette

## Qualità e strumenti

- [ ] Riparare `npm run lint`: `prettier --check` fallisce su 93 file
- [ ] Riparare il crash di `eslint` su `ToolheadPosition.svelte` (`@typescript-eslint/no-unused-vars`)
- [ ] Eseguire `npm run format` una volta su tutto il repo, in un commit isolato
- [ ] Aggiungere un hook pre-commit o un job CI che esegua `check` e `lint`
- [ ] Valutare test unitari o end-to-end sul frontend (oggi l'unico test è quello dell'installer)
- [ ] Risolvere i 16 warning di `svelte-check` in `PrintList.svelte` (a11y e `non_reactive_update`)

## Robustezza

- [ ] Mostrare uno stato "dati non aggiornati" quando il polling fallisce, oggi silenzioso
- [ ] Sospendere il polling dei pannelli fuori dalla viewport del carosello
- [ ] Ottimizzare `fetchDirectoriesRecursive()`, che scarica tutto l'albero `gcodes` in sequenza
- [ ] Valutare `printer.objects.subscribe` via WebSocket al posto del polling HTTP
- [ ] Verificare il comportamento dell'interfaccia con Kalico in stato `shutdown` o disconnesso

## Build, deploy e G2-OS

- [ ] Rifare `script/build.sh` e `script/update.sh`, oggi fragili e ridondanti
- [ ] Correggere `update.sh`, che forza `git checkout main` e può sovrascrivere modifiche locali
- [ ] Impedire che una build locale con `.env` finisca committata in `build/`
- [ ] Verificare l'installazione su una macchina reale, non solo nel container di test
- [ ] Verificare la connessione da GingerSlicer senza indicare la porta
- [ ] Documentare la configurazione `moonraker.conf` attesa (`authorization`, `update_manager`)
