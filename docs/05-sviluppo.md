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

| Comando               | Cosa fa                                 |
| --------------------- | --------------------------------------- |
| `npm run dev`         | Server di sviluppo con HMR              |
| `npm run build`       | Build di produzione in `build/`         |
| `npm run preview`     | Anteprima locale della build            |
| `npm run check`       | Type-check con `svelte-check`           |
| `npm run check:watch` | Type-check in watch                     |
| `npm run lint`        | `prettier --check` + `eslint`           |
| `npm run format`      | `prettier --write` su tutto il progetto |

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

Attenzione: [CurrentDirectory.svelte](../src/lib/components/CurrentDirectory.svelte) usa ancora
la sintassi reattiva vecchia (`$:`). È codice preesistente, non un modello da replicare.

Per le animazioni si usa la classe `Tween` di `svelte/motion` (API a rune, `.current` per
leggere e `.set()` per animare), non lo store `tweened` deprecato — vedi
[ToolheadPosition.svelte](../src/lib/components/ToolheadPosition.svelte).

### Stili

Lo stile predominante è **CSS scoped dentro il componente**, non classi Tailwind. Tailwind è
configurato e disponibile, ma nella pratica i componenti scrivono il proprio blocco `<style>`.
Segui la convenzione del file che stai modificando invece di introdurre l'altro approccio.

**Nei CSS dei componenti non si scrivono valori esadecimali**: si usano i token della
palette, cioè i custom properties dichiarati in `:root` in [src/app.css](../src/app.css).
Se un colore ti serve e non c'è, aggiungi il token lì invece di scriverlo nel componente.

```css
.qualcosa {
	color: var(--color-text-soft);
	background: var(--color-white);
	border: 1px solid var(--color-gray);
}
```

Oltre alla palette, `app.css` tiene le poche classi davvero globali. Tra queste **`.spin`**, che
fa ruotare qualsiasi icona (`<LoaderCircle class="spin" />`): la classe e i suoi `@keyframes spin`
sono dichiarati una volta sola lì, quindi non vanno ridefiniti nei componenti — chi ha bisogno di
un'animazione di rotazione propria può usare direttamente `animation: spin …`.

### Palette

I cinque colori Ginger, che sono la palette di prodotto:

| Nome        | Token                | Hex       | Uso                                       |
| ----------- | -------------------- | --------- | ----------------------------------------- |
| Bianco      | `--color-white`      | `#FFFFFF` | Sfondi card, testo su fondo scuro         |
| Sfondo      | `--color-background` | `#F5F5F5` | Sfondi secondari                          |
| Grigio      | `--color-gray`       | `#C8C8C8` | Bordi, separatori, sfondo applicativo     |
| RossoGinger | `--color-red`        | `#D72E28` | Azioni primarie, accenti, stati di errore |
| Nero        | `--color-black`      | `#111111` | Testo principale                          |

Sono ripetuti in [tailwind.config.cjs](../tailwind.config.cjs) per le classi Tailwind, ma la
sorgente per i CSS dei componenti è `app.css`. Font: **Montserrat**.

`--color-red-dark` (`#B82520`) è il rosso premuto: hover e stato attivo delle azioni primarie.

### Neutri

Scala di grigi fuori palette, dal testo secondario allo sfondo incassato. Esisteva già sparsa
nei componenti in decine di varianti indistinguibili (`#333`/`#444`/`#4a4a4a`,
`#666`/`#6e6e6e`, `#828282`/`#888`/`#8a8a8a`, …): qui è ridotta a un valore per gradino.
Prendi il gradino più vicino invece di introdurne uno nuovo.

| Token                    | Hex       | Uso                                              |
| ------------------------ | --------- | ------------------------------------------------ |
| `--color-text-secondary` | `#222222` | Titoli e testo secondario                        |
| `--color-text-muted`     | `#444444` | Testo di supporto                                |
| `--color-text-soft`      | `#6E6E6E` | Etichette, didascalie                            |
| `--color-text-subtle`    | `#8A8A8A` | Testo terziario, icone spente                    |
| `--color-text-disabled`  | `#9A9A9A` | Controlli disabilitati                           |
| `--color-gray-light`     | `#B5B5B5` | Tratti e riempimenti chiari                      |
| `--color-divider`        | `#D9D9D9` | Separatori                                       |
| `--color-border-light`   | `#E2E2E2` | Bordi tenui                                      |
| `--color-surface-sunken` | `#ECECEC` | Sfondi incassati                                 |
| `--color-black-pure`     | `#000000` | Nero pieno, solo dove serve (console, contrasto) |

### Stati

Quattro famiglie: sfondo (`-bg`), bordo (`-border`) e variante satura per icone e indicatori
(`-vivid`). Lo stato negativo non ha un colore di testo proprio, usa `--color-red`. Se ti
serve un colore di stato, riusa questi invece di inventarne di nuovi.

| Stato     | Testo             | Sfondo               | Uso                                               |
| --------- | ----------------- | -------------------- | ------------------------------------------------- |
| Positivo  | `--color-success` | `--color-success-bg` | "Connected", "Up to date", operazione riuscita    |
| In attesa | `--color-warning` | `--color-warning-bg` | "Update available", avvisi, operazione in corso   |
| Negativo  | `--color-red`     | `--color-danger-bg`  | "Disconnected", repo corrotto, operazione fallita |
| Neutro    | `--color-info`    | `--color-info-bg`    | Informazioni, assi del toolhead, mappa fusi       |

### Trasparenze e ombre

`rgba()` non accetta un colore già composto, quindi i colori usati con trasparenza hanno
anche un token con i soli canali: `rgba(var(--rgb-black), 0.25)`, `rgba(var(--rgb-red), 0.3)`.
Le due ombre ricorrenti — quella dei pannelli e quella degli elementi flottanti — sono
`var(--shadow-panel)` e `var(--shadow-float)`, da usare come declaration intera.

Restano fuori dai token due casi: i colori del **syntax highlighting** in
[klipper-config-language.ts](../src/lib/editor/klipper-config-language.ts), che sono un tema
per il codice e non colori di interfaccia, e gli attributi `fill=` degli **SVG inline** nel
markup, dove `var()` non è supportato in modo affidabile dai browser.

### Nomenclatura

- Componenti: `PascalCase.svelte`.
- I pannelli della dashboard hanno prefisso `Dashboard*`.
- Servizi, store e tipi: `kebab-case.ts` / `camelCase.ts`, importati via alias `$lib`.

### Lingua

**L'interfaccia è tutta in inglese**, `aria-label` e testi dei dialoghi compresi. La
documentazione in [docs/](.) resta in italiano, e così i commenti nel codice.

Non esiste un sistema di i18n: le stringhe sono letterali nei componenti. Quando ne aggiungi
una, scrivila direttamente in inglese — non c'è un file di traduzioni da aggiornare.

L'unica eccezione è il confine con G2-Service, che risponde con messaggi in italiano: le
traduzioni verso l'inglese stanno in `SERVICE_MESSAGES` nella pagina di rete e in
`TIMEZONE_MESSAGES` in `timezone.ts`, vedi [04-moonraker.md](04-moonraker.md).

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

| File           | Contenuto                                                           | Sorgente                                                                  |
| -------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `timezones.ts` | Le 418 zone IANA con paese e coordinate della città di riferimento  | `/usr/share/zoneinfo/zone.tab` e `iso3166.tab` (tzdata, pubblico dominio) |
| `world-map.ts` | Le terre emerse in proiezione equirettangolare, come unico path SVG | Natural Earth `ne_110m_land`, scaricato al momento della generazione      |

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
4. Controlla i breakpoint responsive (vedi [02 — Breakpoint](02-architettura.md#breakpoint)):
   sopra 1200px di larghezza e 600px di altezza il carosello mostra 5 slide con `flex: 0 0 20%`;
   con un numero diverso di pannelli quella percentuale va aggiornata. Le condizioni stanno sia
   nelle media query sia nel `matchMedia` di `updateVisibleCount()` e vanno tenute allineate.

## Debug

- `ToolheadPosition` espone `window.setToolheadTestPosition(x, y, z)` per pilotare la
  visualizzazione senza una stampante collegata.
- I toast riportano la sorgente (`klipper`, `moonraker`, `network`, `system`): utile per capire
  da quale integrazione arriva un problema.
- Con `duration: 0` un toast resta finché non viene chiuso a mano — comodo per riprodurre
  errori che altrimenti sparirebbero.
