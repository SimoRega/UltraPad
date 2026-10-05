# Rendere operativo UltraPad

Il codice è preparato per frontend Cloudflare Pages, API Worker e Durable
Objects SQLite, Supabase Auth/Postgres/Storage. Non sono stati creati account,
registrate applicazioni OAuth o pubblicati deploy durante l'implementazione.
I seguenti passaggi sono manuali e ordinati.

Per il progetto UltraPad già creato (`iqlxqzfivunyudfaxjlr`) e l’avvio Windows,
seguire prima [LOCAL_LOGIN.md](LOCAL_LOGIN.md). `pnpm setup:local` configura i
due file locali con URL corretto e chiave pubblica inserita sul PC.

## 1. Supabase e OAuth

1. Creare un progetto Supabase separato per staging. Annotare URL e chiave
   pubblicabile/anon; non usare la service role nel frontend.
2. Applicare, in ordine, i quattro file `supabase/migrations/20261005000*.sql` con
   SQL Editor o migrazioni CLI. Richiedono lo schema Auth/Storage Supabase.
3. Creare un'app OAuth GitHub con callback
   `https://<project-ref>.supabase.co/auth/v1/callback`.
4. In Supabase Authentication → Providers abilitare GitHub e configurare
   client ID/client secret dell'app OAuth.
5. Impostare Site URL all'origine del frontend. Consentire esattamente il
   redirect locale `http://localhost:5173/` e quello di staging/produzione.
6. Verificare utenti con email confermata: gli inviti sono bound a quella
   email, non al nome GitHub. Nessuna email viene inviata dall'app.

## 2. Development

Copiare `.env.example` in `.env` e `apps/api/.dev.vars.example` in
`apps/api/.dev.vars`. Inserire URL e chiave pubblica Supabase in entrambi.
Lasciare API localhost:8787 e APP_ORIGIN localhost:5173 nel profilo locale.

```sh
pnpm install --frozen-lockfile
pnpm run doctor
pnpm dev
```

Le variabili `VITE_*` vengono incorporate nel bundle. Ogni cambiamento
richiede nuova build. `.env` e `.dev.vars` sono ignorati da Git.

## 3. API Cloudflare

1. Accedere al proprio account Cloudflare con `pnpm exec wrangler login`.
   Il login Wrangler è specifico del computer: non viene copiato con Git.
2. `apps/api/wrangler.jsonc` contiene già l’account UltraPad, la variabile
   `APP_ORIGIN=https://ultrapad-5q2.pages.dev`, URL Supabase e Publishable key.
   `apps/api/.dev.vars` continua a fornire i valori localhost nello sviluppo;
   crearlo con `pnpm setup:local` su ogni nuovo computer.
3. Eseguire i check e pubblicare l'API:

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration
pnpm build
pnpm deploy:api
```

4. Annotare l'URL HTTPS del Worker. Le migrazioni Wrangler creano il namespace
   SQLite: mantenere binding `ROOMS` e classe `DocumentRoom` nelle release.
5. Configurare il segreto **solo server** per la pubblicazione checkpoint:

```sh
pnpm exec wrangler secret put CHECKPOINT_SERVICE_ROLE --config apps/api/wrangler.jsonc
```

Inserire la chiave Supabase privilegiata nel prompt, mai in un comando,
file committato o variabile `VITE_*`. È usata solo dal publisher interno.
Senza questo segreto i checkpoint restano in SQLite e la copia automatica
esterna non è configurata: la release con dati importanti è bloccata.

`GET /health` deve indicare `configured: true`. Per un file autorizzato,
`GET /v1/files/:id/backup-health` indica stato della copia automatica.
Non loggare URL/headers WebSocket o payload. Logging automatico disabilitato
nel template; configurare solo metriche redatte prima della produzione.

## 4. Frontend Cloudflare Pages

Il progetto Pages `ultrapad` è già creato, con sito di produzione
`https://ultrapad-5q2.pages.dev`. La configurazione pubblica è salvata nel
file **`.env.production` nella radice del repository** (non `.env.productions`).
Vite la carica automaticamente durante `pnpm build:web`, anche dopo un nuovo
clone e senza copiare file dal vecchio computer. Il frontend usa:

- API: `https://ultrapad-api.ultrapad-backend.workers.dev`
- Supabase: `https://iqlxqzfivunyudfaxjlr.supabase.co`
- La Publishable key del progetto, già presente nel file pubblico.

Su un altro computer, dal checkout `codex/evolutive-v1.3` (o da `main` dopo
il merge delle PR #2 e #3):

```sh
pnpm install --frozen-lockfile
pnpm exec wrangler login
pnpm deploy:api
pnpm build:web
pnpm deploy:web
```

Non ricreare il progetto Pages: il comando `deploy:web` pubblica su `ultrapad`.
Le variabili PowerShell `$env:VITE_*`, le variabili CI e `.env.production.local`
possono prevalere sul file committato: rimuovere eventuali vecchi override
localhost prima della build. `.env.production` contiene esclusivamente dati
pubblici; token Cloudflare, credenziali OAuth e service role restano fuori Git.
Il segreto Worker `CHECKPOINT_SERVICE_ROLE` già impostato nel cloud non viene
sostituito dai deploy e non deve essere copiato nel frontend.

Supabase → Authentication → URL Configuration:
Site URL `https://ultrapad-5q2.pages.dev`; Redirect URLs
`https://ultrapad-5q2.pages.dev/` e `http://localhost:5173/` per lo sviluppo.
Queste impostazioni del servizio non si configurano mediante i file Git.

In alternativa collegare il repository a Pages: root repository, comando
`pnpm build:web`, output `apps/web/dist`, Node 24 e le tre variabili sopra.
Verificare che refresh su `/projects/:id/files/:id` serva la SPA.
APP_ORIGIN deve coincidere con l'origine finale, senza slash terminale.
La CSP distribuita permette connessioni HTTPS/WSS: restringere `connect-src`
in `apps/web/public/_headers` agli host effettivi del proprio ambiente.

## 5. Gate prima di invitare il gruppo

- OAuth reale login/logout/scadenza/redirect in staging.
- `pnpm test:rls` con owner/viewer/outsider reali; richieste dirette al DB.
- Tre browser, offline, revoca durante editing e reader silenzioso.
- Crash, aggiornamento duplicato e reconnect anche tra nuove release.
- Restore dopo disconnessione e retry di un restore interrotto.
- Un file da 1 MiB, 10 editor: misurare CPU, memoria, ACK p95 e write volume
  sul piano Cloudflare scelto. Il benchmark locale non certifica il piano.
- Checkpoint nello Storage privato e checksum verificato dopo download.
- Backup cifrato indipendente schedulato e un restore completo di prova.
- Chrome, Firefox, Safari/Edge, tastiera, screen reader e dispositivi previsti.

`docs/PROGRESS.md` elenca anche il lavoro software residuo. **Pubblicare il
bundle non equivale a completare R1.** Non attivare M4–M8 per coprire questi gate.

## Costi

Non sono stati acquistati servizi. Consultare quote e prezzi del proprio
piano prima della pubblicazione; nessuna promessa di costo zero o uptime.
Il provider scrive una snapshot per ogni update, quindi il volume di
scrittura va misurato. Se non rientra nel budget, ottimizzare con log e
compaction oppure adottare Workers Paid/Hocuspocus tramite ADR.

Fonti ufficiali consultate: Cloudflare Durable Objects Storage/WebSockets,
Supabase getClaims/RLS, Monaco Editor/y-monaco; link in DEPENDENCIES.md.

## Aggiornamento dalla v1 alla v1.1

Seguire [V1_1.md](V1_1.md). Su un DB già inizializzato applicare soltanto
`202610050004_v11.sql`, senza rieseguire 001–003. Nessun reset dei dati.
