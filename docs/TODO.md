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

## DEP — Build, deploy e G2-OS

- `DEP-7` Aggiungere un controllo in CI o un hook che impedisca di committare un `build/` con indirizzi compilati dentro — pronto
- `DEP-10` Documentare la configurazione `moonraker.conf` attesa (`authorization`, `update_manager`) — pronto
