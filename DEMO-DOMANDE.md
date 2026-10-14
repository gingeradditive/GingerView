# Demo Formnext — domande aperte e segnalazioni

Punti emersi lavorando in autonomia sulle tappe 2–5. Nessuno è bloccante:
per ognuno ho scelto un default e sono andato avanti. Quando decidi, si
aggiorna DEMO.md e si cancella la voce da qui.

## Da decidere o fornire

1. **File G-code veri della G2.** Ora la lista contiene due file veri della
   **G1** (Bloom Vase, JUG) e quattro **segnaposto** G2 con miniature
   disegnate da me (Planter XL, Lamp Shade, Stool, Vase Wave in
   "Customer samples"). I metadati dei segnaposto sono inventati ma
   plausibili (9–19 h, 3–12 kg).
   Per sostituirli:

   ```sh
   node src/lib/demo/tools/import-gcode.mjs --reset file1.gcode file2.gcode
   node src/lib/demo/tools/import-gcode.mjs --dir "Customer samples" file3.gcode
   ```

   Il G-code non viene pubblicato, solo metadati e miniatura. Consiglio di
   esportare da Orca con **miniature grandi (300×300)**: quelle dei file G1
   sono 50×50 e si vedono sgranate. Le miniature dei segnaposto restano in
   `src/lib/demo/files/thumbs/` finché non le cancelli a mano.

2. **Configurazione nell'editor.** Ho messo una configurazione **ridotta e
   inventata** con la stessa struttura di quella vera (file per area, 4 zone,
   START_PRINT/END_PRINT), senza pin, PID e tarature. Il sito è pubblico e i
   concorrenti saranno in fiera. Se preferisci mostrare quella vera, o
   nascondere l'editor, basta dirlo. Per nasconderlo:
   `hiddenRoutes: ['/settings/config-editor']` in `src/lib/demo/config.ts`.

3. **Durata delle stampe.** Default applicato: 10 s di stampa per ogni ora
   reale, tra 75 s e 230 s, più 30–60 s di riscaldamento, quindi 2–5 minuti
   in tutto. L'etichetta mostra "Accelerated time ×360". Si cambia in
   `src/lib/demo/config.ts`.

4. **Cosa nascondere o bloccare.** Per ora è tutto visibile e funzionante
   come deciso. Il meccanismo è pronto in `src/lib/demo/config.ts`:
   - `hiddenRoutes` toglie i link e rimanda alla dashboard;
   - `blockedActions` fa rispondere "This action is not available in the
     demo", ad esempio `'POST /printer/emergency_stop'`.

   Candidati da valutare:
   - **Emergency stop**: porta la demo in "Kalico is shut down", con il
     riavvio dal dock. È credibile, ma può spaventare;
   - **Config editor**: vedi punto 2;
   - **Update**: funziona, ma "aggiornare" una demo è strano;
   - **Open Wiki**: link esterno.

5. **Reset per inattività.** Non l'ho fatto: ogni visitatore usa il proprio
   telefono e lo stato si azzera ricaricando la pagina. Serve solo se volete
   un telefono/tablet fisso allo stand che torni da solo allo stato iniziale.

6. **Web Analytics.** Va attivato a mano dalla dashboard Cloudflare
   (progetto `gingerview-demo` → Metrics → Web Analytics). Il token che ho
   non ha quel permesso.

7. **Token Cloudflare.** Il deploy automatico usa il secret
   `CLOUDFLARE_API_TOKEN`. Se revochi il token incollato in chat, il deploy
   si ferma: crea prima un token con solo _Account → Cloudflare Pages → Edit_
   e aggiornalo con
   `gh secret set CLOUDFLARE_API_TOKEN -R gingeradditive/GingerView`.

8. **Date di Formnext** (metà novembre 2026). Servono per fissare il
   congelamento, 3–4 giorni prima della partenza.

## Test che servono a te (tappa 5)

Ho provato tutto in automatico:

- Chromium e WebKit (motore di Safari), con viewport iPhone;
- percorso lista → dettagli → wizard → riscaldamento → stampa → fine;
- tutte le pagine di Settings, la console, homing/jog, l'emergency stop;
- 3G lento: ~150 KB e interattivo in 6 s.

Restano i **telefoni veri**: un iPhone e un Android, possibilmente su rete
mobile, scansionando un QR. Cose da guardare:

- l'avviso al primo accesso e la barra DEMO fissa in alto;
- la notch dell'iPhone sopra l'etichetta "Accelerated time";
- bloccare il telefono durante una stampa e riaprirlo: la stampa deve essere
  andata avanti nel frattempo.

## Segnalazioni su GingerView (valgono anche per `main`)

Non li ho corretti: sono fuori dal perimetro della demo. Dimmi se aprire i
fix su `main`.

- **Config editor sul telefono.** Il riquadro dell'albero è troppo basso: con
  tre voci la terza (`printer.cfg`) è tagliata e serve scorrere per vederla.
- **Durata nel popup dei dettagli.** Mostra `last_print_duration` (l'ultima
  stampa reale), mentre la card in lista mostra il tempo stimato: lo stesso
  file appare con "14h 10 min" e "14h 52 min". Forse è voluto; segnalo.
