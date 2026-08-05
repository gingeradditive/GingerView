# Q&A

Domande aperte che servono per procedere con lo sviluppo. Rispondi sotto ogni `A:` con calma,
anche in momenti diversi.

**Come funziona il file.** Quando una domanda riceve risposta, viene rimossa da qui e la
decisione finisce nella documentazione (`01`–`07`) e, se comporta lavoro, in
[TODO.md](TODO.md). L'obiettivo è arrivare ad avere questo file **vuoto**.

La numerazione **non** viene mai riusata: le nuove domande partono da dove finiscono le
vecchie, così i rimandi `Qn` in TODO.md e nella documentazione restano validi nel tempo.

---

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
esattamente tre pulsanti: **Move**, **Home**, **Disable Motors**. Per gli ultimi due procedo
con `G28` e `M84`. "Move" invece non ha un bersaglio: non ci sono frecce per asse né selettore
di step. Deve aprire un pannello di jog (che quindi va disegnato), oppure muovere verso una
posizione fissa tipo parcheggio/manutenzione?
A:

**Q11: Dove va inserita la webcam nell'interfaccia?**
Contesto: hai confermato che serve. G2-OS include già **crowsnest**, quindi lo stream esiste
lato macchina e va solo proxato (`/webcam/`) e mostrato. Da definire: se diventa una slide del
carosello dashboard, una pagina dedicata, o un riquadro sempre visibile durante la stampa.
A:

**Q32: La sequenza reale di `handleExtrude()` è corretta, in particolare l'ipotesi sul "rotation volume"?**
Contesto: `handleExtrude()` ora esegue davvero, in sequenza: popup di avvertimento homing (`HomingWarningModal`, riusato) → `G28` → `G1 X<centro> Y0 Z250` → per le 4 zone `SET_HEATER_TEMPERATURE` + `TEMPERATURE_WAIT` (comandi Klipper standard, confidenza alta) → infine

```
SET_EXTRUDER_ROTATION_DISTANCE EXTRUDER=extruder DISTANCE=<rotationVolume>
M83
G1 E<volumeMm3> F<speedMm3PerS*60>
M82
```

Il pulsante Extrude mostra la fase corrente (Homing.../Moving.../Heating.../Extruding...) ed è
disabled durante l'esecuzione. Il punto debole è l'ultimo blocco: presuppongo che il
`rotation_distance` dell'estrusore reale (quello con lo stepper, cioè `extruder`) sia calibrato
in **mm³ per rotazione** per il materiale attivo — così un `G1 E<volumeMm3>` relativo dispensa
esattamente quel volume — e che `rotation_distance`/`SET_EXTRUDER_ROTATION_DISTANCE` sia il
meccanismo giusto per applicare il "rotation volume" che mi hai dato per materiale. Non l'ho
verificato su hardware reale: puoi confermare che questa è la calibrazione giusta prima che
qualcuno lo provi sulla macchina? Se sbagliata, un valore enorme di `E` potrebbe far girare lo
stepper molto più a lungo del previsto.
A:

**Q33: Cosa deve contenere `gingerview.conf` oltre al modello?**
Contesto: su Q26 hai deciso che i parametri della stampante stanno in un file
`gingerview.conf` versionato nel repository (per ora fisso sulla G2, in futuro un template
popolato da G2-OS). Le voci che l'interfaccia userebbe **subito** sono: identificativo del
modello (`G2`), nome mostrato, capienza tramoggia in kg (oggi `maxPelletKg = 5` hardcoded) e
percorso del logo (oggi `/Printers/G2/Logo.svg` fisso in due componenti). Confermi questo
elenco iniziale, e vuoi che ci finiscano anche i preset materiale dell'estrusione
(temperature per zona e rotation volume di PETG/PLA), oggi scritti dentro `ExtrudeDialog`?
A:
