# TODO — cosa serve da Giacomo per la demo Formnext

Le spiegazioni e i default già applicati sono in [DEMO-DOMANDE.md](DEMO-DOMANDE.md).
Quando una voce è fatta, si spunta qui e si aggiorna DEMO.md.

## Da fare subito

- [ ] **Token Cloudflare permanente.** Va fatto prima di revocare quello
      incollato in chat: con quello revocato il deploy automatico si ferma.
  1. Crea il token: Cloudflare → My Profile → API Tokens, permesso
     _Account → Cloudflare Pages → Edit_, scadenza dopo la fiera.
  2. Salvalo nel repo:
     `gh secret set CLOUDFLARE_API_TOKEN -R gingeradditive/GingerView`.
  3. Revoca il token vecchio.
- [ ] **Web Analytics.** Cloudflare → Workers & Pages → `gingerview-demo` →
      Metrics → attiva Web Analytics. Va fatto da te: il mio token non ha il
      permesso.

## Materiale da fornire

- [ ] **G-code veri della G2**, quelli da far stampare ai visitatori.
  - Esportali da Orca con **miniature 300×300**.
  - Dimmi in quale cartella vanno: la radice oppure "Customer samples".
  - Il G-code non viene pubblicato: si tengono solo metadati e miniatura.
  - Se preferisci importarli tu:

    ```sh
    node src/lib/demo/tools/import-gcode.mjs --reset file1.gcode file2.gcode
    node src/lib/demo/tools/import-gcode.mjs --dir "Customer samples" file3.gcode
    ```

- [ ] **Date esatte di Formnext**, per fissare il congelamento della demo
      (3–4 giorni prima della partenza).

## Decisioni da prendere

- [ ] **Config editor**: tenere la configurazione ridotta e inventata
      (default), mostrare quella vera, oppure nascondere la pagina?
- [ ] **Cosa nascondere o bloccare.** Ora è tutto visibile. Candidati:
  - [ ] Emergency stop: porta la demo in "Kalico is shut down", con il
        riavvio dal dock;
  - [ ] Update;
  - [ ] Config editor;
  - [ ] Open Wiki: è un link esterno.
- [ ] **Durata delle stampe**: ok il default di 2–5 minuti con
      "Accelerated time ×360"?
- [ ] **Reset per inattività**: serve solo se allo stand c'è un
      telefono/tablet fisso con la demo aperta. Sì o no?
- [ ] **Bug di GingerView anche su `main`**: li correggo? Dettagli in
      DEMO-DOMANDE.md.
  - [ ] Pannello pellet: peso calcolato con filamento da 1,75 mm invece della
        convenzione Ginger 1 mm = 1 mm³;
  - [ ] Config editor sul telefono: l'albero dei file è troppo basso;
  - [ ] Durata diversa tra card in lista e popup dei dettagli.

## Test sui telefoni veri (tappa 5)

Da fare dopo aver caricato i file veri, scansionando un QR con rete mobile, non
con il Wi‑Fi dell'ufficio.

- [ ] iPhone (Safari)
- [ ] Android (Chrome)

Su ciascuno controllare:

- [ ] avviso al primo accesso, poi badge DEMO in alto a destra;
- [ ] percorso completo: file → dettagli → wizard → stampa fino alla fine;
- [ ] etichetta "Accelerated time" non coperta dalla notch;
- [ ] telefono bloccato a metà stampa e poi riaperto: la stampa è andata
      avanti;
- [ ] pausa, ripresa e annullamento di una stampa;
- [ ] movimenti: Home, poi Move.

## Prima della fiera

- [ ] Congelamento: da 3–4 giorni prima della partenza, nessun push su
      `demo/fiera`.
- [ ] QR stampati che puntano a https://gingerview-demo.pages.dev.
- [ ] Ultimo controllo del sito il giorno prima.
