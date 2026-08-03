# Documentazione GingerView

Documentazione tecnica di **GingerView**, l'interfaccia web di Ginger Additive per il
controllo delle proprie stampanti 3D basate su Klipper/Kalico + Moonraker.

## Indice

| Documento                                               | Contenuto                                                       |
| ------------------------------------------------------- | --------------------------------------------------------------- |
| [01 — Panoramica](01-panoramica.md)                     | Cos'è GingerView, a cosa serve, confronto con Mainsail          |
| [02 — Architettura](02-architettura.md)                 | Stack tecnologico, struttura del repo, routing, servizi e store |
| [03 — Configurazione](03-configurazione.md)             | Variabili `.env`, `configService`, risoluzione degli endpoint   |
| [04 — Integrazione Moonraker](04-moonraker.md)          | Endpoint HTTP e WebSocket usati, polling, G-code inviati        |
| [05 — Sviluppo](05-sviluppo.md)                         | Setup locale, script, convenzioni di codice, palette            |
| [06 — Build e deploy](06-deploy.md)                     | Build statica, nginx, script di installazione/aggiornamento, CI |
| [07 — Stato attuale e limiti noti](07-stato-attuale.md) | Cosa è implementato, cosa è placeholder, incongruenze aperte    |

## File di lavoro

| File                               | Contenuto                                                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [TODO.md](TODO.md)                 | Cose da fare, con codice univoco `AREA-n` per riferirvisi. I task completati vengono rimossi                   |
| [Q&A.md](Q&A.md)                   | Solo le domande ancora aperte. Quando una riceve risposta, esce da qui ed entra nella documentazione           |
| [PULIZIA-LINT.md](PULIZIA-LINT.md) | Piano per i 27 errori `eslint` residui (`QA-8`…`QA-11`, `CLN-4`) e le trappole di `build/` e del parser Svelte |

## In breve

- **Cos'è**: SPA SvelteKit (adapter statico) servita da nginx sulla stampante.
- **Con cosa parla**: Moonraker (HTTP + WebSocket) e G2-Service, il servizio di sistema
  dell'host per rete e fuso orario (`/service/`), entrambi raggiunti **sulla stessa origine**
  tramite proxy nginx — nessuna porta da indicare.
- **Come si installa**: `sudo script/install.sh` → build statica servita da nginx sulla porta 80.
- **Dove gira**: Raspberry Pi della stampante, all'interno dell'immagine di sistema (in prospettiva **G2OS**).

> **Nota** — `PROMPTS.md` è un file di appunti personali, non fa parte della documentazione e
> non va usato come fonte.
