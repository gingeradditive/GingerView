# Q&A

Domande aperte che servono per procedere con lo sviluppo. Rispondi sotto ogni `A:` con calma,
anche in momenti diversi. Le domande sono numerate così che [TODO.md](TODO.md) possa
farvi riferimento.

Le domande risolte sono state rimosse; le decisioni prese sono riassunte in fondo e riportate
per esteso nella documentazione. La numerazione **non** viene riusata: le nuove domande
partono da dove finiscono le vecchie, così i rimandi restano validi nel tempo.

---

## Ancora aperte

**Q1: Qual è la formula per convertire le misure da filamento a pellet?**
Contesto: hai confermato che la macchina è a pellet ma Kalico ragiona a filamento, e che le
misure vanno riconvertite — lasciando la formula come `[TODO]`. Oggi
[DashboardPelletPanel.svelte](../src/lib/components/DashboardPelletPanel.svelte) fa questo:

```
peso(g) = filament_used(mm) × π × 0.875² × 0.00124
```

cioè assume filamento da 1.75 mm e densità PLA 1.24 g/cm³. Per convertire correttamente serve
sapere: la densità reale del materiale a pellet, e se il rapporto tra "millimetri di filamento
virtuale" che Kalico conta e materiale realmente estruso è una costante di calibrazione
(tipo `rotation_distance`) o va letto da un oggetto Klipper.
A:

**Q6: Cosa deve fare il pulsante "Move" della pagina Movement?**
Contesto: hai detto di considerare la grafica corretta e che ogni pulsante deve fare qualcosa.
In [ToolheadPosition.svelte](../src/lib/components/ToolheadPosition.svelte) ci sono
esattamente tre pulsanti: **Move**, **Home**, **Disable Motors**. Per gli ultimi due propongo
`G28` e `M84` e procedo se non dici altro. "Move" invece non ha un bersaglio: non ci sono
frecce per asse né selettore di step. Deve aprire un pannello di jog (che quindi va disegnato),
oppure muovere verso una posizione fissa tipo parcheggio/manutenzione?
A:

**Q7: A cosa corrispondono Low/Mid/High e Slow/Standard/Boost nell'estrusione?**
Contesto: [ExtrudeDialog.svelte](../src/lib/components/ExtrudeDialog.svelte) ha i selettori ma
`handleExtrude()` fa solo `console.log`. Servono i valori reali in **mm** (quantità) e
**mm/min** (velocità), più l'eventuale controllo di temperatura minima prima di estrudere.
Avevi detto che li devi ancora definire.
A:

**Q11: Dove va inserita la webcam nell'interfaccia?**
Contesto: hai confermato che serve. G2-OS include già **crowsnest**, quindi lo stream esiste
lato macchina e va solo proxato (`/webcam/`) e mostrato. Da definire: se diventa una slide del
carosello dashboard, una pagina dedicata, o un riquadro sempre visibile durante la stampa.
A:

**Q16: Il servizio di rete resta separato o entra dentro GingerView?**
Contesto: stavi riflettendo se implementarlo nel repo GingerView visto che fa poche cose.
Un vincolo da tenere presente: **GingerView oggi è una SPA statica senza backend** — non c'è
un processo lato server. Portarlo dentro significa aggiungere al repository un servizio
(Python/FastAPI o altro) con il suo systemd unit, e l'installer dovrebbe installarlo e
avviarlo. Non è impossibile, ma cambia la natura del progetto: da interfaccia pura a
interfaccia + servizio. In alternativa resta separato e G2-OS lo installa.
A:

---

## Nuove

**Q26: Come fa GingerView a sapere su quale modello di macchina sta girando?**
Contesto: serve per parametrizzare la capienza tramoggia (Q2: G2 = 5 kg, ma cambierà) e già
oggi c'è un asset per modello, `static/Printers/G2/Logo.svg`, referenziato con un percorso
fisso nel layout. Le opzioni: leggerlo da un oggetto Klipper o da una variabile in
`printer.cfg`, da un file scritto da G2-OS, o da una `VITE_*` compilata per modello (che però
romperebbe il "una build per tutte le macchine").
A:

**Q27: Le 4 zone dell'ugello vanno presentate come "zone" invece che come 4 estrusori?**
Contesto: hai spiegato che è **un solo ugello a 4 zone** e che gli estrusori multipli di
Kalico sono un espediente. Oggi il pannello temperature li mostra come `extruder`,
`extruder1`, `extruder2`, `extruder3`, cioè come se fossero quattro utensili distinti.
Se la lettura corretta è "una temperatura per zona dello stesso ugello", l'etichettatura va
cambiata (Zona 1..4? nomi funzionali tipo Ingresso/Centro/Punta?). E per la G1 a 3 zone serve
adattarsi al numero effettivo.
A:

**Q28: Le pagine Impostazioni vecchie vanno riprogettate o solo riempite?**
Contesto: per Update, Log, History, Statistics e Timezone hai detto "è roba vecchia, da
rifare". Non è chiaro se intendi che manca solo l'implementazione dietro un layout già
concordato, o se anche la struttura della sezione Impostazioni va ripensata. Esiste un
mockup/Figma di riferimento a cui allinearmi?
A:

**Q29: Il wizard pre-stampa cosa dovrà chiedere?**
Contesto: hai detto che per ora la stampa parte diretta dal popup dettagli, ma che "in teoria"
ci sarà prima un wizard di setup. Sapere già cosa dovrà coprire (controllo materiale in
tramoggia? preriscaldo? verifica piano? conferma profilo?) evita di progettare l'avvio stampa
in un modo che poi va buttato.
A:

**Q30: Chi si occupa di sostituire il modulo Mainsail in G2-OS?**
Contesto: ho guardato https://github.com/gingeradditive/g2-os — è ancora il fork MainsailOS non
adattato: il README parla di "Kalico Firmware e **Mainsail**" e la distribuzione preinstalla
Mainsail. Il modulo che installa GingerView al posto suo non esiste ancora. Lo scrivo io in
quel repo, o lo fate voi e io mi limito a mantenere `install.sh` pronto per essere invocato?
A:

**Q31: L'accesso da telefono richiede qualcosa lato GingerView?**
Contesto: hai detto che la macchina è senza schermo e che si accede dal proprio cellulare
tramite NFC/QR. Se il QR contiene solo l'indirizzo della stampante non serve nulla. Ma se
serve una pagina di benvenuto, un onboarding al primo accesso, o un modo per generare/mostrare
il QR dall'interfaccia stessa, va messo in conto. Inoltre: chi genera il QR/NFC, e cosa
contiene esattamente (IP? hostname `.local`? un dominio)?
A:

**Q32: L'hostname della macchina è stabile e risolvibile?**
Contesto: senza schermo, l'utente arriva da telefono. Un IP che cambia via DHCP rende il QR
inutile dopo un rinnovo. Usate un hostname mDNS fisso tipo `ginger-g2.local` (che su Android
storicamente ha supporto mDNS scadente), un IP statico, o la macchina espone un access point
proprio quando non è connessa a una rete?
A:

---

## Decisioni prese

Riepilogo compatto di quanto già risolto. Il dettaglio è nella documentazione indicata.

| Tema | Decisione | Dove |
|---|---|---|
| Firmware | Kalico, sempre ultima versione | [01](01-panoramica.md) |
| Macchina | G2 a pellet, un ugello a 4 zone (G1: 3 zone) | [01](01-panoramica.md), [04](04-moonraker.md) |
| Tramoggia | Capienza da parametrizzare per modello, G2 = 5 kg | [07](07-stato-attuale.md) |
| `fan`, `led LED_CAMERA` | Nomi validi su tutte le macchine, si possono dare per scontati | [04](04-moonraker.md) |
| Avvio stampa | Sì, dal popup dettagli file; per ora diretto, in futuro dietro wizard | [07](07-stato-attuale.md) |
| Temperature | **Non** modificabili dall'interfaccia, sola lettura | [07](07-stato-attuale.md) |
| Emergency stop | Non serve, c'è il pulsante fisico | — |
| Webcam | Serve, posizione da definire (Q11) | [07](07-stato-attuale.md) |
| Pagina Update | Deve aggiornare tutto il sistema, non solo GingerView | [07](07-stato-attuale.md) |
| Pagina Log | Semplice pagina di download dei log | [07](07-stato-attuale.md) |
| Autenticazione | Nessuna, né Moonraker né GingerView | [04](04-moonraker.md) |
| Display | La macchina **non ha schermo**: si usa il proprio cellulare via NFC/QR | [01](01-panoramica.md), [02](02-architettura.md) |
| Voce menu Mainsail | Da rimuovere | [07](07-stato-attuale.md) |
| Lingua | Interfaccia tutta in **inglese**, documentazione in italiano | [05](05-sviluppo.md) |
| Node | **22** — Node 20 è EOL da aprile 2026 | [05](05-sviluppo.md) |
| `build/` committato | Confermato; branch di lavoro, merge su `main` a ogni release | [06](06-deploy.md) |
| Dipendenze React (MUI, Emotion, `@mdi/react`) | Da rimuovere | [07](07-stato-attuale.md) |
| `DemoComponent` + `klipper-websocket.ts` | Codice morto, da rimuovere | [07](07-stato-attuale.md) |
| G2-OS | Repo esiste: [gingeradditive/g2-os](https://github.com/gingeradditive/g2-os), ancora da adattare | [06](06-deploy.md) |
