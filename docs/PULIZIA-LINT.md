# Pulizia lint

Piano di lavoro per i **26 errori `eslint` residui**, più le trappole da conoscere prima di
metterci mano. I task corrispondenti in [TODO.md](TODO.md) sono `QA-8`…`QA-11` e `CLN-4`.

Fotografia al 2026-08-03: `prettier --check .` passa, `eslint .` riporta 26 errori,
`svelte-check` 0 errori e 16 warning (quelli sono `QA-6`, non riguardano questo file).

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

Nota: `CLN-4` converte `ToolheadPosition.svelte` alle rune, ma **non** rende il workaround
inutile — serve finché esiste anche un solo `$:` nel repo, e oggi ce ne sono in vari componenti.

### 3. Non impostare `destructuredArrayIgnorePattern`

In `eslint.config.js` la regola `no-unused-vars` è configurata con `argsIgnorePattern`,
`caughtErrorsIgnorePattern` e `varsIgnorePattern` su `^_`, **ma non** con
`destructuredArrayIgnorePattern`. Non è una dimenticanza: quell'opzione attiva un ramo di
`no-unused-vars` che legge `def.name.parent.type`, e sulle definizioni prodotte dal parser
Svelte quel `parent` può non esserci — si ricasca in un crash dello stesso tipo.

La convenzione `_` copre già il caso che serve: `{#each items as _, index}`, dove il binding
dell'elemento è posizionale e va tenuto per poter arrivare all'indice.

---

## I 26 errori residui

### `CLN-4` — `svelte/no-immutable-reactive-statements` (9)

Tutti e nove in [`ToolheadPosition.svelte`](../src/lib/components/ToolheadPosition.svelte),
righe 68–77. Sono i `$: pNNN = project(...)` con argomenti costanti: gli otto vertici del
cubo e il centro base, che non dipendono da nulla di mutabile e quindi non sono reattivi.

Non vanno corretti uno per uno: **rientrano interamente in `CLN-4`**, la conversione del
componente alle rune Svelte 5. In rune, i valori costanti diventano semplici `const` e i
derivati veri `$derived`, e i nove errori spariscono insieme. Farlo prima a mano sarebbe lavoro
buttato.

### `QA-8` — `svelte/no-navigation-without-resolve` (7)

| File                                                                       | Righe          |
| -------------------------------------------------------------------------- | -------------- |
| [`+layout.svelte`](../src/routes/+layout.svelte)                           | 29, 36, 47, 58 |
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

### `QA-9` — `svelte/require-each-key` (5)

| File                                                                                 | Riga   |
| ------------------------------------------------------------------------------------ | ------ |
| [`DashboardPelletPanel.svelte`](../src/lib/components/DashboardPelletPanel.svelte)   | 93     |
| [`DashboardZHeightPanel.svelte`](../src/lib/components/DashboardZHeightPanel.svelte) | 76, 81 |
| [`PrintCard.svelte`](../src/lib/components/PrintCard.svelte)                         | 254    |
| [`settings/console/+page.svelte`](../src/routes/settings/console/+page.svelte)       | 237    |

Aggiungere una key a un `{#each}` **cambia come Svelte riconcilia il DOM**: non è una modifica
cosmetica. Vale la pena distinguere due casi:

- liste **statiche** (tacche e etichette dei pannelli dashboard): l'indice come key è corretto
  e innocuo, perché gli elementi non vengono mai riordinati;
- liste **dinamiche** (le righe della console, che crescono nel tempo): serve una key
  realmente identificante, non l'indice, altrimenti si sposta il problema invece di risolverlo.
  La console ha già un `timestamp` per riga.

**Da verificare dopo**: che la console non perda righe né sfarfalli durante uno stream lungo.

### `QA-10` — `@typescript-eslint/no-explicit-any` (4)

| File                                                                 | Riga | Nota                                          |
| -------------------------------------------------------------------- | ---- | --------------------------------------------- |
| [`DemoComponent.svelte`](../src/lib/components/DemoComponent.svelte) | 8    | **coperto da `CLN-1`**: il file va cancellato |
| [`klipper.ts`](../src/lib/types/klipper.ts)                          | 4, 5 | `params` e `result` di `KlipperMessage`       |
| [`moonraker-notifier.ts`](../src/lib/services/moonraker-notifier.ts) | 177  | parametro `data` di `handleNotification`      |

Uno dei quattro sparisce gratis con `CLN-1`. Restano i tre sul confine JSON-RPC con Moonraker,
dove `any` è la scorciatoia tipica: la sostituzione corretta è `unknown` più un narrowing
esplicito dove il valore viene consumato, non un'interfaccia inventata che dichiara più di
quanto sappiamo davvero della risposta.

Attenzione all'effetto a cascata: `KlipperMessage` è un tipo condiviso, quindi passare a
`unknown` fa emergere errori di tipo in tutti i punti che oggi accedono ai campi senza
controllarli. È il motivo per cui va fatto in un passaggio dedicato e non in mezzo ad altro.

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

## Due cose emerse durante la pulizia

Non sono errori di lint (`eslint` non le vede), ma sono venute fuori rimuovendo il codice morto
e vanno decise da una persona. La prima è ancora aperta (`CLN-8`), la seconda è decisa.

### Subscribe mai disiscritta in `CurrentDirectory.svelte`

[Riga 11](../src/lib/components/CurrentDirectory.svelte#L11): `currentDirPath.subscribe(...)`
non viene mai annullata. Prima c'era `const unsubscribe = ...`, ma la variabile non era usata da
nessuna parte — quindi il valore di ritorno veniva scartato e la sottoscrizione restava viva per
sempre. Nella pulizia è stato tolto solo il binding inutilizzato, **lasciando il comportamento
identico**, perché sistemarlo davvero è un cambiamento funzionale.

La correzione è `onDestroy(unsubscribe)`, oppure `$derived`/`$state` se il componente viene
convertito alle rune. Il componente è montato dentro `PrintList`, quindi il leak si accumula a
ogni entrata/uscita dalla lista di stampa.

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
npm run check    # svelte-check: atteso 0 errori, 16 warning (QA-6)
```

Il conteggio dei warning di `svelte-check` è il controllo più utile: **deve restare 16**, tutti
in `PrintCard.svelte` e `PrintList.svelte`. Se sale, la modifica ha introdotto qualcosa.

Per confrontare con lo stato precedente senza fidarsi della memoria:

```sh
git stash push -- src/ && npm run check ; git stash pop
```

E se serve la prova che il progetto compili davvero, `npm run build` seguito dal ripristino di
`build/` descritto nella trappola 1.
