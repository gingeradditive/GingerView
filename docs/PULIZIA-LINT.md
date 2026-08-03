# Pulizia lint

Piano di lavoro per i **9 errori `eslint` residui**, più le trappole da conoscere prima di
metterci mano. I task corrispondenti in [TODO.md](TODO.md) sono `QA-8`, `QA-10` e `QA-11`.

Fotografia al 2026-08-03, dopo `CLN-4`, `QA-9` e `CLN-9`: `prettier --check .` passa, `eslint .`
riporta 9 errori. `svelte-check` è pulito: 0 errori e 0 warning, da quando `QA-6` ha sistemato
`PrintCard.svelte` e `PrintList.svelte`.

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

## I 9 errori residui

I 9 `svelte/no-immutable-reactive-statements` che stavano qui sono spariti con `CLN-4`: la
conversione alle rune di `ToolheadPosition.svelte` ha reso `const` i valori costanti (gli otto
vertici del cubo e il centro base) e `$derived` i derivati veri. I 5
`svelte/require-each-key` sono spariti con `QA-9` (vedi in fondo), e due dei tre
`no-explicit-any` con `CLN-9` (vedi sotto).

### `QA-8` — `svelte/no-navigation-without-resolve` (7)

| File                                                                       | Righe          |
| -------------------------------------------------------------------------- | -------------- |
| [`+layout.svelte`](../src/routes/+layout.svelte)                           | 45, 52, 63, 74 |
| [`settings/+page.svelte`](../src/routes/settings/+page.svelte)             | 121            |
| [`SettingsSubpage.svelte`](../src/lib/components/SettingsSubpage.svelte)   | 9              |
| [`PrintStartWizard.svelte`](../src/lib/components/PrintStartWizard.svelte) | 82 (`goto()`)  |

La regola vuole che gli URL interni passino da `resolve()` di `$app/paths`, così restano
corretti se l'app viene servita sotto un percorso base.

**Oggi non è un bug**: `svelte.config.js` non imposta `kit.paths.base`, quindi la base è `''` e
i link funzionano. È lavoro di robustezza, da fare se e quando GingerView potrà essere servita
sotto un sottopercorso. Se si decide che non succederà mai, l'alternativa onesta è spegnere la
regola in `eslint.config.js` con un commento che spiega il perché, invece di lasciare sette
errori permanenti che rendono `npm run lint` rumoroso.

**Da verificare dopo**: navigazione del dock e ingresso/uscita da ogni sottopagina Impostazioni.

### `QA-10` — `@typescript-eslint/no-explicit-any` (1)

[`moonraker-notifier.ts:177`](../src/lib/services/moonraker-notifier.ts#L177) — il parametro
`data` di `handleNotification`.

Il quarto (`DemoComponent.svelte`) è sparito con `CLN-1`, gli altri due con `CLN-9` (vedi
sotto). Resta quello sul confine JSON-RPC con Moonraker, dove `any` è la scorciatoia tipica: la
sostituzione corretta è `unknown` più un narrowing esplicito dove il valore viene consumato, non
un'interfaccia inventata che dichiara più di quanto sappiamo davvero della risposta.

Nel caso concreto il narrowing serve a poco lì dentro: `handleNotification` legge `data.method`
e `data.params?.[0]`, quindi con `unknown` vanno aggiunti i controlli di forma prima di ogni
accesso, oppure un type guard `isNotification(data)` in cima alla funzione.

### `QA-11` — `svelte/prefer-svelte-reactivity` (1)

[`settings/update/+page.svelte:40`](../src/routes/settings/update/+page.svelte#L40) —
`let completedApps = new Set<string>()`.

**Qui la regola ha torto.** Suggerisce `SvelteSet` perché le mutazioni di un `Set` normale non
sono reattive, ma `completedApps` non viene mai letto da un template né da un `$derived`: è
scritto alla riga 80 e riletto alla 166 dentro il `catch` di `runOperation`, in codice
puramente imperativo. Convertirlo a `SvelteSet` aggiungerebbe overhead di reattività per un
valore che nessuno osserva.

La correzione giusta è un `eslint-disable-next-line` mirato con una riga di commento che spiega
perché lì il `Set` semplice è corretto. Se invece un domani quel valore finisse in un template,
allora `SvelteSet` diventerebbe la risposta vera — vale la pena scriverlo nel commento.

---

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
