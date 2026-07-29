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

| Variabile | Default | Descrizione |
|---|---|---|
| `VITE_MOONRAKER_HOST` | *(vuoto → same-origin)* | Impostandolo si passa a URL assoluti |
| `VITE_MOONRAKER_PORT` | `7125` | Usata solo se è impostato l'host |
| `VITE_MOONRAKER_WS_URL` | derivato | URL WebSocket completo, ha la precedenza |
| `VITE_MOONRAKER_API_URL` | derivato | URL HTTP completo, ha la precedenza |

`configService` legge anche `VITE_PRINTER_NAME` e `VITE_CONNECTION_TIMEOUT`, ma **nessuna delle
due ha effetto**: il nome non viene mostrato da alcun componente, e il timeout è usato solo da
`validateConfig()`, che non viene mai invocato (la console ha il proprio timeout scritto nel
codice). Per questo non compaiono in [.env.example](../.env.example).

### Servizio di rete (Wi-Fi)

La gestione Wi-Fi **non** passa da Moonraker: è un servizio separato con API proprie
(`/api/wifi/*`), tipicamente sulla porta `8000`. Anche questo viene proxato da nginx sulla
porta 80, quindi in produzione non va configurato nulla.

| Variabile | Default | Descrizione |
|---|---|---|
| `VITE_NETWORK_API_HOST` | valore di `VITE_MOONRAKER_HOST` | Impostandolo si passa a URL assoluti |
| `VITE_NETWORK_API_PORT` | `8000` | Usata solo se è impostato l'host |
| `VITE_NETWORK_API_BASE_URL` | derivato | URL base completo, ha la precedenza |

## Come vengono risolti gli endpoint

[src/lib/services/config.ts](../src/lib/services/config.ts) espone il singleton
`configService`, che risolve la configurazione una sola volta e la memorizza:

```ts
import { configService, getMoonrakerApiUrl } from '$lib/services/config';

const base = getMoonrakerApiUrl();                    // '' in same-origin
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
un eventuale override esplicito. **Non è invocato da nessuna parte dell'applicazione**:
è disponibile ma non cablato.

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
