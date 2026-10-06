# UltraPad 1.8

Icone per formato, tab stile Chrome e strumenti compatti: [guida 1.8](docs/V1_8.md).

Calendari su Markdown e fogli di calcolo con formule e toolbar: [guida 1.7](docs/V1_7.md).

## Versione 1.6 precedente

Nuove funzionalità e attivazione: [guida v1.6](docs/V1_6.md). Applicare le migrazioni 005–009 prima del deploy. Notebook/PDF richiedono il servizio isolato documentato; nessun runtime viene eseguito nel Worker.

## Il progetto

Web app collaborativa per note e codice, implementata a partire dall'SDD
UltraPad. Il client Electron in apps/desktop riutilizza la stessa web app.
La cronologia Git precedente è conservata.

**Stato: implementazione R1 da validare in staging, non beta certificata.**
Leggere [progressi e gate aperti](docs/PROGRESS.md) prima di affidarle dati
importanti. Account esterni e deploy non sono stati eseguiti automaticamente.

## Funzioni implementate

Versione 1.5: [Google OAuth e modalità ospite](docs/V1_5.md).

- Accesso Google o GitHub; ospite senza account con file esclusivamente locali.
- [Funzioni v1.3 e precedenti](docs/V1_3.md).

- Chiusura tab, spazio Temporanei, sidebar espandibile e anteprime dalla home.
- Profilo personale con nome/cognome/foto e presenza dei collaboratori nei file di team.

Versione 1.2: [novità e aggiornamento](docs/V1_2.md).

- Dialog per file/temi e panoramica dedicata per ogni workspace.
- Palette pastello, sfondo gradient glass animato e astratto statico.
- Editor visuale TXT: tipografia, paragrafi, liste, stili e pennello; stili condivisi e versionati.
- Export HTML e documento UltraPad reimportabile con formattazione.

- Home a tutto schermo con lavori recenti, modifiche del team e gruppi per tema.
- File singoli privati nel DB; temporanei della scheda esportabili e salvabili nel DB.
- Temi bianco/nero, colore principale personalizzato e Monaco coerente.
- Strumenti dedicati a TXT, MD, JSON, XML, HTML, CSS, JS, TS, Java, C#, Python, TEX e BIB.

- OAuth GitHub tramite Supabase, workspace, progetti, cartelle e file.
- Monaco con linguaggi testuali, ricerca, word wrap, tab, download.
- Yjs condiviso su WebSocket, cursori/presenza, ACK dopo commit SQLite.
- Ruoli, RLS, inviti monouso legati all'email verificata, revoca e lease.
- IndexedDB/outbox per file già aperti, reconnect, recupero ed export locale.
- Checkpoint manuali, preview, copia e restore con nuova generazione.
- Checkpoint privati Supabase, copie automatiche ogni 15 minuti se configurate.
- Import UTF-8/UTF-16 BOM, export UTF-8 LF e ZIP con hash e manifesto.
- Quote server: 1 MiB testo, 8 MiB stato CRDT, 64 KiB frame, 500 file/progetto,
  10 editor/room, prenotazioni conservative di 100 MiB per workspace.

La v1.6 aggiunge import DOCX/RTF, lavagna, commenti e pipeline JS/Python/LaTeX separata, con i limiti e gate indicati in [V1_6](docs/V1_6.md). DOC legacy, allegati generici e runtime Java/C# restano fuori da questa tranche. Senza runner configurato, i sorgenti restano modificabili ed esportabili.

## Avvio

Node 24 e pnpm 11.25.0. Serve un progetto Supabase development/staging.

```sh
pnpm install --frozen-lockfile
pnpm setup:local
# Inserire la chiave pubblica Supabase, applicare migrazioni e configurare OAuth.
# Guida Windows e valori del progetto: docs/LOCAL_LOGIN.md.
pnpm run doctor
pnpm dev
```

Frontend: http://localhost:5173 — API locale: http://127.0.0.1:8787.
In development HTTP e WebSocket usano il proxy `/api` di Vite.
Con i servizi avviati: `pnpm run doctor -- --api` verifica anche il backend.
In assenza di configurazione il frontend mostra istruzioni; non simula utenti.

## Verifiche

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration
pnpm build
pnpm exec playwright install --with-deps chromium
pnpm test:e2e
pnpm audit
```

I test PostgreSQL usano PGlite con fixture Auth/Storage e le migrazioni reali;
i test room usano workerd/SQLite reali con adapter ACL di test. I browser
usano provider e Monaco reali, metadati/Auth sintetici isolati nel test worker.
Per verificare anche Supabase reale: `pnpm test:rls` con tre JWT staging.
Non confondere questi test locali con una verifica OAuth sul provider.

[Login locale / Windows](docs/LOCAL_LOGIN.md) · [Deploy](docs/DEPLOY.md) · [Operazioni e backup](docs/RUNBOOK.md) ·
[API](docs/API.md) · [Sicurezza](docs/THREAT_MODEL.md) ·
[Dipendenze](docs/DEPENDENCIES.md) · [SDD integrale](docs/SDD.md)
# UltraPad Desktop

La versione Electron riutilizza l'interfaccia e i servizi della web app.
Da sorgenti: `pnpm install --frozen-lockfile` e `pnpm desktop:start`.
Su Windows, `pnpm desktop:make` genera installer e ZIP in `apps/desktop/out/make/`.
Configurazione login Google/GitHub e download CI: [docs/DESKTOP.md](docs/DESKTOP.md).
