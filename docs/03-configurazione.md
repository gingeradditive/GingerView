# 03 — Configurazione

## Il default: nessuna configurazione

**Su una stampante GingerView non richiede alcuna configurazione.** Di default l'applicazione
parla con Moonraker sulla **propria origine**: nginx serve la build sulla porta 80 e inoltra
`/printer/`, `/server/`, `/machine/`, `/access/`, `/api/` e `/websocket` a Moonraker.

Le richieste partono quindi come percorsi relativi:

```
GET /printer/objects/query?print_stats     →  nginx  →  127.0.0.1:7125
WS  /websocket                             →  nginx  →  127.0.0.1:7125/websocket
```

È lo stesso meccanismo di Mainsail, e porta tre vantaggi:

- **Niente porta da indicare**, né nel browser né in GingerSlicer.
- **Niente CORS** da configurare in `moonraker.conf`: l'origine è la stessa.
- **Il bundle non contiene indirizzi**, quindi una sola build funziona su tutte le macchine.

Quest'ultimo punto è importante perché `build/` viene compilato dalla CI e committato nel
repository (vedi [06 — Build e deploy](06-deploy.md)): un indirizzo compilato dentro il
bundle sarebbe sbagliato per ogni stampante tranne quella per cui è stato costruito.

## Le variabili servono solo in sviluppo

Le variabili `VITE_*` sono un **override per lo sviluppo**, quando il dev server Vite e la
stampante sono host diversi. Vengono **sostituite da Vite al momento della build** e finiscono
dentro i file JavaScript, quindi:

1. **Modificare `.env` non ha effetto su un'installazione già compilata.** Serve rifare
   `npm run build` e ridistribuire `build/`.
2. **I valori sono pubblici.** Chiunque apra l'interfaccia può leggerli nel bundle. Non
   inserire nulla di segreto in `.env`.
3. `.env` è **gitignorato**, quindi la CI compila sempre senza: il risultato è la
   configurazione same-origin.

### Moonraker

| Variabile                | Default                 | Descrizione                              |
| ------------------------ | ----------------------- | ---------------------------------------- |
| `VITE_MOONRAKER_HOST`    | _(vuoto → same-origin)_ | Impostandolo si passa a URL assoluti     |
| `VITE_MOONRAKER_PORT`    | `7125`                  | Usata solo se è impostato l'host         |
| `VITE_MOONRAKER_WS_URL`  | derivato                | URL WebSocket completo, ha la precedenza |
| `VITE_MOONRAKER_API_URL` | derivato                | URL HTTP completo, ha la precedenza      |

`configService` legge anche `VITE_PRINTER_NAME` e `VITE_CONNECTION_TIMEOUT`, ma **nessuna delle
due ha effetto**: il nome non viene mostrato da alcun componente, e il timeout viene solo
validato da `validateConfig()`, mai usato per una richiesta (la console ha il proprio timeout
scritto nel codice). Per questo non compaiono in [.env.example](../.env.example).

### G2-Service (rete e fuso orario)

Rete e fuso orario **non** passano da Moonraker: sono funzioni dell'host, e stanno in
[G2-Service](https://github.com/gingeradditive/G2-Service), un servizio separato sulla porta
`8000` che espone tutto sotto `/service/`. Anche questo viene proxato da nginx sulla porta 80,
quindi in produzione non va configurato nulla.

| Variabile                  | Default                         | Descrizione                          |
| -------------------------- | ------------------------------- | ------------------------------------ |
| `VITE_G2_SERVICE_HOST`     | valore di `VITE_MOONRAKER_HOST` | Impostandolo si passa a URL assoluti |
| `VITE_G2_SERVICE_PORT`     | `8000`                          | Usata solo se è impostato l'host     |
| `VITE_G2_SERVICE_BASE_URL` | derivato                        | URL base completo, ha la precedenza  |

Il prefisso `/service` **non** è configurabile e non va incluso in queste variabili: lo
aggiunge `g2-service.ts`, ed è appaiato alla regola nginx `location ^~ /service/`.

## Come vengono risolti gli endpoint

[src/lib/services/config.ts](../src/lib/services/config.ts) espone il singleton
`configService`, che risolve la configurazione una sola volta e la memorizza:

```ts
import { configService, getMoonrakerApiUrl } from '$lib/services/config';

const base = getMoonrakerApiUrl(); // '' in same-origin
const { moonrakerWsUrl } = configService.getKlipperConfig();
```

La regola di precedenza:

```
URL esplicito (VITE_*_URL / VITE_*_BASE_URL)
   └─ altrimenti, se è impostato l'HOST → http://<HOST>:<PORT>
        └─ altrimenti → same-origin
             · HTTP: stringa vuota, quindi percorsi relativi
             · WS:   ws(s)://<origine corrente>/websocket
```

Due dettagli che vale la pena conoscere:

- **`moonrakerApiUrl` è la stringa vuota** in same-origin. I chiamanti concatenano
  (`` `${base}/server/info` ``) ottenendo `/server/info`, che il browser risolve
  sull'origine della pagina. Per questo l'helper condiviso `getMoonrakerApiUrl()` non deve
  mai essere sostituito da un fallback tipo `?? 'http://localhost:7125'`: reintrodurrebbe
  un URL assoluto.
- **L'URL WebSocket è derivato da `window.location`**, così lo stesso bundle funziona sia in
  http sia in https e su qualunque hostname. La funzione è protetta da un controllo
  `typeof window`, perché l'adapter statico renderizza la pagina di fallback in Node durante
  la build; per lo stesso motivo la configurazione viene messa in cache **solo nel browser**.

`configService.validateConfig()` restituisce `{ isValid, errors }` e verifica la coerenza di
un eventuale override esplicito: porte fuori intervallo (Moonraker e G2-Service), URL WebSocket
non risolto, timeout di connessione sotto il secondo.

È cablato nel layout radice ([+layout.svelte](../src/routes/+layout.svelte)) **solo in
sviluppo**, dentro `onMount`: se la configurazione non è valida gli errori finiscono in
console. Le due restrizioni sono volute:

- **solo in sviluppo**, perché le variabili `VITE_*` sono un meccanismo di sviluppo. Una build
  di produzione è same-origin e non contiene indirizzi, quindi non c'è niente da validare e
  nessun errore che l'utente della stampante possa correggere;
- **dentro `onMount`** e non a livello di modulo, perché l'URL WebSocket viene derivato da
  `window.location`: durante il prerender in Node è vuoto per costruzione, e il controllo
  segnalerebbe un errore inesistente.

## Configurazione tipica in sviluppo

Il browser gira sul portatile e deve raggiungere la stampante per IP:

```env
VITE_MOONRAKER_HOST=192.168.1.147
VITE_MOONRAKER_PORT=7125
```

Non serve impostare gli URL completi: host e porta bastano, e il WebSocket viene costruito
come `ws://192.168.1.147:7125/websocket`.

In questo scenario Moonraker deve avere l'origine del dev server tra le `cors_domains` in
`moonraker.conf`, altrimenti il browser blocca le richieste:

```ini
[authorization]
cors_domains:
    http://localhost:5173
```

In alternativa si può sviluppare **senza `.env`** e far servire il dev server da un proxy che
riproduce il comportamento di nginx, ma la via più semplice resta l'override esplicito.

## Versione di Node

La versione di riferimento è **Node 22**, dichiarata in [.nvmrc](../.nvmrc). È l'unica fonte:
gli script la applicano tramite `nvm` e la CI la legge con `node-version-file`.
