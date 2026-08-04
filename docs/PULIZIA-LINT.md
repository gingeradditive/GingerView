# Pulizia lint

Storia della pulizia del lint e — soprattutto — le **trappole da conoscere** prima di rimetterci
mano. Non ci sono più task aperti in [TODO.md](TODO.md) su questo fronte.

Fotografia al 2026-08-04, dopo `CLN-4`, `QA-9`, `CLN-9`, `QA-10`, `QA-11` e `QA-8`:
`prettier --check .` passa, `eslint .` riporta **0 errori**, `svelte-check` è pulito con 0 errori
e 0 warning (da quando `QA-6` ha sistemato `PrintCard.svelte` e `PrintList.svelte`).

Da `QA-4` questo stato è **imposto dalla CI** a ogni push e pull request, quindi non può
regredire in silenzio: vedi [05 — CI](05-sviluppo.md#ci).

---

## Prima di iniziare: tre trappole

### 1. `build/` è tracciato in git ma è generato

Contiene l'output di `vite build` ed è committato perché viene deployato. Non è codice
sorgente: **non va né formattato né lintato**. È già escluso in entrambi i posti
(`/build/` in `.prettierignore`, `{ ignores: ['build/'] }` in `eslint.config.js`) — se quelle
righe spariscono, `eslint .` torna a riportare ~875 errori su bundle minificati e il numero
reale di problemi diventa illeggibile.

Conseguenza pratica: `npm run build` **riscrive un artefatto tracciato**. Se lo lanci solo per
verificare che il progetto compili, poi ripristina:

```sh
npm run build          # verifica
git checkout -- build/ # ripristina l'artefatto committato
git clean -fdq build/  # rimuove i chunk con hash nuovo rimasti orfani
git status --porcelain build/   # deve stampare zero righe
```

### 2. Il workaround del parser in `eslint.config.js` deve restare

`svelte-eslint-parser` marca le variabili implicite delle reactive statement `$:` con un tipo
di definizione custom, `"ComputedVariable"`. `@typescript-eslint/no-unused-vars` fa uno
`switch` sui tipi che conosce **senza ramo `default`**: quando prova a segnalare una di quelle
variabili ottiene `undefined` e ci legge sopra `.type`, facendo esplodere l'intera esecuzione.

```
TypeError: Cannot read properties of undefined (reading 'type')
Rule: "@typescript-eslint/no-unused-vars"
```

`eslint.config.js` avvolge il parser e rietichetta quelle definizioni come `Variable` prima che
girino le regole. Verificato al 2026-08-03: il bug è presente sia nelle versioni installate sia
nelle ultime stabili (`typescript-eslint@8.65.0`, `svelte-eslint-parser@1.8.0`), quindi
**aggiornare non basta**.

Per capire se un domani si può togliere: elimina il wrapper, lascia almeno un `$:` non
utilizzato nel codice e lancia `eslint`. Se non crasha, upstream ha aggiunto il ramo mancante e
il workaround (con la sua dipendenza diretta `svelte-eslint-parser` in `package.json`) va via.

Nota: `CLN-4` ha convertito `ToolheadPosition.svelte` alle rune, ma il workaround **non** è
diventato inutile: serve finché esiste anche un solo `$:` nel repo, e oggi ne resta uno in
[`CurrentDirectory.svelte`](../src/lib/components/CurrentDirectory.svelte).

### 3. Non impostare `destructuredArrayIgnorePattern`

In `eslint.config.js` la regola `no-unused-vars` è configurata con `argsIgnorePattern`,
`caughtErrorsIgnorePattern` e `varsIgnorePattern` su `^_`, **ma non** con
`destructuredArrayIgnorePattern`. Non è una dimenticanza: quell'opzione attiva un ramo di
`no-unused-vars` che legge `def.name.parent.type`, e sulle definizioni prodotte dal parser
Svelte quel `parent` può non esserci — si ricasca in un crash dello stesso tipo.

La convenzione `_` copre già il caso che serve: `{#each items as _, index}`, dove il binding
dell'elemento è posizionale e va tenuto per poter arrivare all'indice.

---

## Gli errori chiusi

I 9 `svelte/no-immutable-reactive-statements` che stavano qui sono spariti con `CLN-4`: la
conversione alle rune di `ToolheadPosition.svelte` ha reso `const` i valori costanti (gli otto
vertici del cubo e il centro base) e `$derived` i derivati veri. I 5
`svelte/require-each-key` sono spariti con `QA-9` (vedi in fondo), due dei tre
`no-explicit-any` con `CLN-9` (vedi sotto) e il terzo con `QA-10`. L'unico
`svelte/prefer-svelte-reactivity` è sparito con `QA-11` (vedi sotto).

### `svelte/no-navigation-without-resolve` (7) — fatto (`QA-8`)

La regola vuole che gli URL interni passino da `resolve()` di `$app/paths`, così restano
corretti se l'app viene servita sotto un percorso base. I sette punti erano i quattro link del
dock in [`+layout.svelte`](../src/routes/+layout.svelte), la riga di
[`settings/+page.svelte`](../src/routes/settings/+page.svelte), il "indietro" di
[`SettingsSubpage.svelte`](../src/lib/components/SettingsSubpage.svelte) e il `goto('/')` di
[`PrintStartWizard.svelte`](../src/lib/components/PrintStartWizard.svelte).

Delle due strade possibili — passare per `resolve()` oppure spegnere la regola dichiarando che
l'app non sarà mai servita sotto un sottopercorso — **è stata scelta la prima**. Non era un bug
(`svelte.config.js` non imposta `kit.paths.base`, quindi la base è `''`), ma era il lavoro di
robustezza che tiene aperta la porta.

Sei punti sono stati una sostituzione diretta. Il settimo, `settings/+page.svelte`, ha richiesto
un cambio di tipo: `resolve()` accetta un **route id tipizzato**, non una stringa qualsiasi,
mentre il tipo `Item` aveva un solo `href?: string` condiviso tra righe interne e link esterni
(il wiki). È diventato un'unione discriminata su `kind`:

```ts
type RouteItem = BaseItem & { kind: 'route'; href: RouteId };
type ExternalItem = BaseItem & { kind: 'external'; href: string };
```

`RouteId` viene da `$app/types` ed è generato da `svelte-kit sync`: aggiungere una sottopagina
senza crearne la rotta ora è un errore di compilazione invece di un 404 a runtime. In più
`href` non è più opzionale, quindi `handleExternalClick` ha perso il suo `if (item.href)`.

Restano fuori i confronti `class:active={$page.url.pathname.startsWith('/settings')}` del dock,
che eslint non guarda: se un domani `kit.paths.base` venisse impostata, quelli andrebbero
rifatti su `$page.route.id`.

**Da verificare su macchina**: navigazione del dock, ingresso/uscita da ogni sottopagina
Impostazioni, il link esterno al wiki e il ritorno alla dashboard dopo l'avvio di una stampa.

---

## Il `Set` non reattivo di `settings/update` — fatto (`QA-11`)

L'unico `svelte/prefer-svelte-reactivity` era su
[`settings/update/+page.svelte`](../src/routes/settings/update/+page.svelte) —
`let completedApps = new Set<string>()`.

**Lì la regola aveva torto.** Suggerisce `SvelteSet` perché le mutazioni di un `Set` normale non
sono reattive, ma `completedApps` non viene mai letto da un template né da un `$derived`: è
scritto e riletto solo dentro `runOperation`, in codice puramente imperativo. Convertirlo a
`SvelteSet` avrebbe aggiunto overhead di reattività per un valore che nessuno osserva.

La correzione applicata è un `eslint-disable-next-line svelte/prefer-svelte-reactivity` mirato,
preceduto da un commento che spiega perché lì il `Set` semplice è corretto e dice che se un
domani quel valore finisse in un template allora `SvelteSet` diventerebbe la risposta giusta.

## Le key degli `{#each}` — fatto (`QA-9`)

I 5 `{#each}` senza key sono stati sistemati distinguendo due casi, perché aggiungere una key
**cambia come Svelte riconcilia il DOM** e non è una modifica cosmetica:

- liste **statiche**, dove l'indice _è_ l'identità dell'elemento e non c'è riordino: le 40 bolle
  di [`DashboardPelletPanel.svelte`](../src/lib/components/DashboardPelletPanel.svelte) e le
  tacche/etichette di [`DashboardZHeightPanel.svelte`](../src/lib/components/DashboardZHeightPanel.svelte)
  usano `(i)`, con un commento accanto che dice perché lì va bene;
- liste **dinamiche**: le cartelle di destinazione in
  [`PrintCard.svelte`](../src/lib/components/PrintCard.svelte) sono ricaricate e filtrate, quindi
  la key è `dir.path`; le righe della console in
  [`settings/console/+page.svelte`](../src/routes/settings/console/+page.svelte) hanno ora un
  campo `id` progressivo.

Sulla console il `timestamp` sembrava una key pronta all'uso, ma non lo è: è un `Date` preso dal
browser all'arrivo della riga e più righe possono cadere nello stesso millisecondo (una risposta
multilinea di Klipper), quindi le key si duplicherebbero. Il contatore `nextEntryId` è unico per
costruzione e costa una riga.

**Da verificare su macchina**: che la console non perda righe né sfarfalli durante uno stream
lungo, e che il modal "Move" di `PrintCard` mostri la lista giusta dopo un cambio di cartella.

## L'`any` sul confine JSON-RPC — fatto (`QA-10`)

L'ultimo `no-explicit-any` era il parametro `data` di `handleNotification` in
[`moonraker-notifier.ts`](../src/lib/services/moonraker-notifier.ts): la funzione riceve i
messaggi grezzi della WebSocket di Moonraker, appena passati da `JSON.parse`.

La correzione applicata è quella già indicata come giusta qui sopra: `unknown` più narrowing
esplicito nel punto di consumo, **non** un'interfaccia del protocollo scritta a priori. In
concreto sono comparse tre funzioni piccole sopra `handleNotification`:

- `isJsonObject(value)` — il predicato di base, un oggetto che non è `null` né un array;
- `isNotification(data)` — il type guard in cima alla funzione, che pretende solo quello su cui
  il codice si appoggia davvero: `method` stringa e, se c'è, `params` array. Se non passa, la
  notifica viene ignorata invece di far esplodere l'handler;
- `readProcStatWarnings(params)` — scende in `params[0].moonraker_stats.warnings` un livello
  alla volta e restituisce `[]` appena qualcosa non ha la forma attesa, filtrando poi le sole
  stringhe. Il chiamante fa un `for` su un `string[]`, senza `?.` a catena.

Il guadagno non è solo il lint: il vecchio `data.params?.[0]` su un `any` non aveva alcuna
garanzia che `warnings` fosse iterabile, e un payload malformato sarebbe finito in un `TypeError`
dentro `onmessage`. Ora ogni accesso è verificato e il caso strano degrada a "nessun warning".

Il confine resta volutamente sottotipizzato: se un domani servirà il protocollo Moonraker
tipizzato per intero, si riparte dalla sua documentazione (vedi la nota su `klipper.ts` qui
sotto), non da questi tre guard, che coprono solo ciò che questo modulo legge.

## `src/lib/types/klipper.ts` — deciso: cancellato (`CLN-9`)

Il file dichiarava `KlipperMessage`, `KlipperStatus` e `WebSocketConnectionStatus`. L'unico
consumatore era `klipper-websocket.ts`, che non esiste più: dopo `CLN-1` nessun file del repo
importava più niente da lì, verificato con una ricerca sui tre nomi in tutto `src/`.

La decisione è **cancellarlo**. Non serviva tenerlo in attesa di `QA-10`: la strada giusta per
il confine JSON-RPC è `unknown` più narrowing esplicito nel punto di consumo, non un'interfaccia
scritta a priori — e quella interfaccia, con `params: Record<string, any>` e `result: any`,
dichiarava di sapere quello che non sapeva. Se un domani si vorrà tipizzare davvero il
protocollo, si riparte dalla documentazione di Moonraker, non da questo file; il contenuto
vecchio resta comunque recuperabile da git.

Effetto collaterale: due dei tre `no-explicit-any` sono spariti insieme al file, e `QA-10` si è
ridotto a una funzione sola in `moonraker-notifier.ts`.

## Due cose emerse durante la pulizia

Non sono errori di lint (`eslint` non le vede), ma sono venute fuori rimuovendo il codice morto
e vanno decise da una persona. Entrambe sono ora decise.

### Subscribe mai disiscritta in `CurrentDirectory.svelte` — risolta (`CLN-8`)

Il componente faceva `currentDirPath.subscribe(...)` senza mai annullare la sottoscrizione: prima
c'era `const unsubscribe = ...`, ma la variabile non era usata da nessuna parte, quindi il valore
di ritorno veniva scartato e la sottoscrizione restava viva per sempre. Nella pulizia era stato
tolto solo il binding inutilizzato, lasciando il comportamento identico, perché sistemarlo
davvero era un cambiamento funzionale. Il componente è montato dentro `PrintList`, quindi il leak
si accumulava a ogni entrata/uscita dalla lista di stampa.

La correzione applicata è l'auto-subscription: la variabile locale `dirPath` e la `subscribe`
manuale sono sparite, e `segments` deriva direttamente da `$currentDirPath`. È Svelte a
disiscrivere quando il componente viene distrutto, quindi non serve né `onDestroy` né la
conversione alle rune.

### Il marker di target in `ToolheadPosition.svelte` — deciso: rimozione definitiva

Il componente calcolava `targetMarker` (e le tre normalizzazioni `targetXNorm/YNorm/ZNorm` che
lo alimentavano) senza mai renderizzarlo: veniva proiettata la posizione di target del toolhead
e poi buttata via. Nella pulizia è stato rimosso come codice morto.

La decisione presa (`UI-9`) è **non disegnarlo**: la rimozione è definitiva e la parte SVG, che
non è mai esistita, non va scritta. Mostrare dove _sta andando_ la testa oltre a dov'è non è una
feature che serve. Se un giorno la si volesse, si riparte da zero sulla parte SVG; il calcolo
vecchio si recupera da git, ma è la porzione banale del lavoro.

Nota: gli store `targetX/targetY/targetZ` **sono ancora usati** (alimentano `actualX/Y/Z` alle
righe 118–130), non sono stati toccati.

---

## Come verificare di non aver rotto nulla

Da `GingerView/`, nell'ordine:

```sh
npm run lint     # prettier --check . && eslint .
npm run check    # svelte-check: atteso 0 errori, 0 warning
```

Il conteggio dei warning di `svelte-check` è il controllo più utile: **deve restare 0**. Se
sale, la modifica ha introdotto qualcosa.

Per confrontare con lo stato precedente senza fidarsi della memoria:

```sh
git stash push -- src/ && npm run check ; git stash pop
```

E se serve la prova che il progetto compili davvero, `npm run build` seguito dal ripristino di
`build/` descritto nella trappola 1.
