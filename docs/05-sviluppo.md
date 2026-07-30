# 05 — Sviluppo

## Requisiti

- **Node.js 22** — dichiarata in [.nvmrc](../.nvmrc), che è l'unica fonte: gli script la
  applicano via `nvm` e la CI la legge con `node-version-file`, quindi non possono divergere.
  Node 20 è **End-of-Life da aprile 2026** e Node 22 è l'ultima LTS con build ARM a 32 bit
  ufficiali, quindi copre il Raspberry Pi 4 sia a 64 sia a 32 bit.
- **npm** — il progetto usa `package-lock.json`, non pnpm/yarn.
- Una stampante con Moonraker raggiungibile, oppure un'istanza Moonraker di prova.

## Avvio

```bash
npm install
cp .env.example .env      # e imposta l'IP della tua stampante
npm run dev
```

In alternativa [script/rundev.sh](../script/rundev.sh), che applica la versione di Node da
`.nvmrc`, chiede se reinstallare le dipendenze e avvia Vite. `./rundev.sh` nella root è un
forwarder allo stesso script. Gli argomenti in più passano a Vite, quindi `./rundev.sh --host`
espone il dev server sulla rete locale, comodo per aprirlo dal telefono. Vedi
[06 — rundev.sh](06-deploy.md#rundevsh).

Il server di sviluppo Vite parte su `http://localhost:5173`. Perché le chiamate a Moonraker
funzionino, quell'origine deve essere tra le `cors_domains` di `moonraker.conf`
(vedi [04 — CORS](04-moonraker.md#cors)).

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm run dev` | Server di sviluppo con HMR |
| `npm run build` | Build di produzione in `build/` |
| `npm run preview` | Anteprima locale della build |
| `npm run check` | Type-check con `svelte-check` |
| `npm run check:watch` | Type-check in watch |
| `npm run lint` | `prettier --check` + `eslint` |
| `npm run format` | `prettier --write` su tutto il progetto |

Prima di aprire una PR conviene eseguire `npm run check`: non ci sono hook git configurati,
quindi nulla lo impone automaticamente.

`npm run lint` **oggi non è eseguibile**: prettier segnala 93 file non formattati e eslint va
in crash su `ToolheadPosition.svelte`. Dettagli in
[07 — Stato attuale](07-stato-attuale.md#npm-run-lint-non-è-eseguibile).

Se modifichi [script/install.sh](../script/install.sh), verificalo con
[script/test-install.sh](../script/test-install.sh), che lo esegue in un container Debian
(serve Docker). È l'unico test del repository.

## Convenzioni di codice

### Svelte 5, non Svelte 4

Il progetto usa le runes: `$state`, `$derived`, `$props`, `$effect`. I componenti nuovi devono
seguire lo stesso stile.

```svelte
<script lang="ts">
    let { title, children }: { title: string; children?: import('svelte').Snippet } = $props();
    let count = $state(0);
    let doubled = $derived(count * 2);
</script>
```

Attenzione: [ToolheadPosition.svelte](../src/lib/components/ToolheadPosition.svelte) usa ancora
la sintassi reattiva vecchia (`$:`) mescolata a `tweened`. È codice preesistente, non un
modello da replicare.

### Stili

Lo stile predominante è **CSS scoped dentro il componente**, non classi Tailwind. Tailwind è
configurato e disponibile, ma nella pratica i componenti scrivono il proprio blocco `<style>`.
Segui la convenzione del file che stai modificando invece di introdurre l'altro approccio.

I valori della palette sono spesso scritti a mano nei CSS dei componenti (`#D72E28`,
`#C8C8C8`, …) invece di passare dai token Tailwind. È duplicazione esistente: se tocchi un
componente puoi allinearlo, ma non è richiesto un refactor generale.

### Palette

| Nome | Hex | Uso |
|---|---|---|
| Bianco | `#FFFFFF` | Sfondi card, testo su fondo scuro |
| Sfondo | `#F5F5F5` | Sfondi secondari |
| Grigio | `#C8C8C8` | Bordi, separatori, sfondo applicativo |
| RossoGinger | `#D72E28` | Azioni primarie, accenti, stati di errore |
| Nero | `#111111` | Testo principale |

Definita in [tailwind.config.cjs](../tailwind.config.cjs) e in
[src/app.css](../src/app.css). Font: **Montserrat**.

Fuori palette ci sono tre coppie sfondo/testo usate per gli **stati**, nate nella pagina
console e riprese da quella update. Non sono in `tailwind.config.cjs`: se ne servono altre,
riusa queste invece di inventarne di nuove.

| Stato | Sfondo | Testo | Uso |
|---|---|---|---|
| Positivo | `#DDF3DF` | `#1A7F37` | "Connected", "Up to date", operazione riuscita |
| In attesa | `#FDF0D5` | `#9A6700` | "Update available", avvisi, operazione in corso |
| Negativo | `#F7D9D8` | `#D72E28` | "Disconnected", repo corrotto, operazione fallita |

### Nomenclatura

- Componenti: `PascalCase.svelte`.
- I pannelli della dashboard hanno prefisso `Dashboard*`.
- Servizi, store e tipi: `kebab-case.ts` / `camelCase.ts`, importati via alias `$lib`.

### Lingua

**L'interfaccia va tutta in inglese**, `aria-label` e testi dei dialoghi compresi. La
documentazione in [docs/](.) resta in italiano.

Oggi le stringhe sono miste: etichette in inglese ma `aria-label` e alcuni dialoghi in
italiano ("Crea", "Annulla", "Rinomina", "Torna a Settings"). Se tocchi un componente che
contiene stringhe italiane, convertile — non esiste un sistema di i18n, sono letterali nei
componenti.

### Formattazione

Prettier con configurazione in [.prettierrc](../.prettierrc): tab per l'indentazione,
virgolette singole, niente trailing comma, larghezza 100. Alcuni file preesistenti usano spazi
invece di tab — `npm run format` li normalizza.

## Aggiungere una sottopagina di impostazioni

1. Crea `src/routes/settings/<nome>/+page.svelte`.
2. Per un segnaposto bastano tre righe, sfruttando il wrapper esistente:

```svelte
<script lang="ts">
    import SettingsSubpage from '$lib/components/SettingsSubpage.svelte';
</script>

<SettingsSubpage title="Nome" />
```

`SettingsSubpage` fornisce intestazione, pulsante "indietro" verso `/settings` e, in assenza
di contenuto, il testo "Coming soon". Per una pagina reale, passa il contenuto come figlio.

3. Aggiungi la voce all'array `items` in
   [src/routes/settings/+page.svelte](../src/routes/settings/+page.svelte), scegliendo
   un'icona da `lucide-svelte`.

## Dati generati (fusi orari e mappa)

`src/lib/data/` contiene due file **generati**, non da modificare a mano:

| File | Contenuto | Sorgente |
|---|---|---|
| `timezones.ts` | Le 418 zone IANA con paese e coordinate della città di riferimento | `/usr/share/zoneinfo/zone.tab` e `iso3166.tab` (tzdata, pubblico dominio) |
| `world-map.ts` | Le terre emerse in proiezione equirettangolare, come unico path SVG | Natural Earth `ne_110m_land`, scaricato al momento della generazione |

Si rigenerano entrambi con:

```bash
node script/generate-timezone-data.mjs
```

Lo script legge `zone.tab` dalla macchina su cui gira: è la stessa fonte da cui `timedatectl`
ricava l'elenco delle zone valide, quindi l'elenco compilato è per costruzione accettato dal
Raspberry Pi. Va rieseguito quando tzdata cambia (zone aggiunte, rinominate o ritirate), non a
ogni build. La mappa richiede rete solo in quel momento; a runtime non scarica nulla.

I due file sono in [.prettierignore](../.prettierignore): una riga per zona resta leggibile in
diff, mentre `npm run format` la spezzerebbe su più righe a ogni rigenerazione.

## Aggiungere un pannello alla dashboard

1. Crea `src/lib/components/Dashboard<Nome>Panel.svelte` seguendo il pattern di polling
   descritto in [02 — Architettura](02-architettura.md#pattern-ricorrenti).
2. Aggiungi una `<div class="embla__slide">` in
   [DashboardCarousel.svelte](../src/lib/components/DashboardCarousel.svelte).
3. Aggiorna `pageCount` (usato per i pallini di navigazione) e verifica `startIndex`, che
   determina quale slide è visibile all'apertura.
4. Controlla i breakpoint responsive: sopra 1200px il carosello mostra 5 slide con
   `flex: 0 0 20%`; con un numero diverso di pannelli quella percentuale va aggiornata.

## Debug

- `ToolheadPosition` espone `window.setToolheadTestPosition(x, y, z)` per pilotare la
  visualizzazione senza una stampante collegata.
- I toast riportano la sorgente (`klipper`, `moonraker`, `network`, `system`): utile per capire
  da quale integrazione arriva un problema.
- `network-api.ts` logga in console ogni richiesta e risposta.
- Con `duration: 0` un toast resta finché non viene chiuso a mano — comodo per riprodurre
  errori che altrimenti sparirebbero.
