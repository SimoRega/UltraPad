# Stato dell'implementazione — 5 ottobre 2026

Il prototipo Electron è sostituito dall'implementazione web M0–M3/R1 prevista
dall'SDD. La cronologia precedente resta recuperabile in Git. Questo è codice
da validare in staging: **R1 non è ancora certificata e non è stato effettuato
un deploy**. L'SDD completo è conservato in `docs/SDD.md`.

## Realizzato

- Monorepo TypeScript, React/Vite/Monaco, Hono Worker, Durable Objects SQLite,
  migrazioni Supabase Auth/Postgres/Storage, CI e configurazioni di esempio.
- Workspace, progetti, albero cartelle/file, tab, ricerca per nome, rename,
  move, eliminazione, import testuale, download e ZIP con manifesto/hash.
- OAuth GitHub, ruoli effettivi, isolamento tenant RLS, inviti monouso legati
  all'email verificata, revoca, ticket monouso e lease di autorizzazione.
- Yjs/Y.Text e presenza; protocollo binario con chunk, deduplicazione,
  commit SQLite e sync prima dell'ACK; limiti testo/stato/frame e quote.
- IndexedDB e outbox per file già aperti, replay, reconnect, indicatori di
  salvataggio e export delle copie locali prima di perdere l'accesso.
- Checkpoint manuali, preview, copia, restore con nuova generazione e saga
  ripetibile; publisher verso Storage privato con checksum, automatico ogni
  15 minuti dopo modifiche se configurato. Script backup cifrato indipendente.
- ADR, threat model, API, guida di deploy e runbook.

## Verifiche locali eseguite

| Verifica | Esito |
|---|---|
| TypeScript strict e lint | Passati |
| Test dominio/protocollo + PostgreSQL PGlite | 7 passati |
| Test workerd/SQLite/Durable Objects | 7 passati |
| Playwright Chromium | 5 passati |
| Setup locale Node | 3 passati |
| Build frontend + dry run Worker | Passati |
| Audit dipendenze | Nessun advisory rilevato al controllo |

I test PostgreSQL applicano le tre migrazioni con fixture Auth/Storage e
verificano permessi, inviti, revoca, quote e Storage privato. Non sono una
prova su Supabase ospitato. I test room usano SQLite/workerd reali e un adapter
ACL isolato. I browser usano Monaco e provider reali, ma Auth e metadati del
backend sono fixture: OAuth GitHub reale non è stato verificato.

La prova browser comprende tre contesti indipendenti, editing concorrente,
offline, recupero dopo reload e viewer; la suite room include evizione,
ACK/dedup, frame spezzati da 1 MiB, scadenza lease e revoca. Nel container
gestito è servito uno shim locale per la sola enumerazione delle interfacce
di rete Node, non incluso nel prodotto o nella CI.

## Gate necessari prima di una beta operativa

1. Provisioning e deploy: Supabase, tre migrazioni, OAuth, variabili ambiente,
   namespace Durable Objects, Worker, Pages, origini HTTPS e CSP. Seguire
   [DEPLOY.md](DEPLOY.md).
2. Integrazione reale: JWT e RLS con owner/viewer/outsider, Storage privato,
   checksum, OAuth/redirect/logout/scadenza, restore interrotto e aggiornamento
   del Worker con room attive. Non eseguiti senza account/credenziali staging.
3. Durabilità indipendente: schedulare backup cifrati, rinnovo credenziali e
   prova di ripristino completo. Lo script estrae dump e documenti; il flusso
   automatico di ricostruzione di tutte le room da disaster recovery manca.
4. Misurare sul piano scelto ACK p95, CPU, memoria e costo di scrittura con
   1 MiB e 10 editor. La snapshot completa per ogni update è una scelta
   documentata in ADR; il budget remoto non è stato dimostrato.
5. Browser diversi da Chromium, accessibilità, mobile, carico prolungato,
   fuzzing dei frame e test di failure di rete/provider.

## Lavoro software ancora aperto

- Cleanup sicuro di room, checkpoint e prenotazioni orfane dopo eliminazioni;
  le quote sono conservative e non restituiscono automaticamente tutto lo
  spazio. Dashboard operativa, metriche redatte e allarmi vanno configurati.
- Rate limit per account/IP e limiti della presenza separati dalle modifiche;
  quote e autorizzazione attuali non sostituiscono la protezione da abuso.
- Round trip dei byte/encoding originali e allegati binari. Oggi import UTF-8
  e UTF-16 BOM viene normalizzato; export dichiarato UTF-8/LF.
- Tema chiaro, palette comandi completa e verifica di tutti i flussi tramite
  tastiera/screen reader. Gestione ownership e amministrazione da completare
  oltre ai flussi membri e ruoli disponibili.
- Automazione operativa del backup e disaster restore sopra descritti.

M4–M8 restano successive come richiesto dall'SDD: editor rich text,
commenti, lavagna, runner isolati, compilazione LaTeX, Office/RTF e relative
policy/licenze. Java/C#/TEX sono ora sorgenti testuali, senza esecuzione.
Non attivare queste milestone per aggirare i gate R1.

## Aggiornamento login locale e Windows

Configurati gli URL pubblici del progetto `iqlxqzfivunyudfaxjlr`, introdotto
`pnpm setup:local` per inserire la chiave pubblica senza committarla, corretto
il quoting dello script dev su Windows e fissata la porta 5173. Doctor ora
verifica coerenza frontend/API, chiave pubblica e provider GitHub remoto.
Gestiti errori sessione e callback OAuth, con redirect esplicito alla root.
Guida dedicata: [LOCAL_LOGIN.md](LOCAL_LOGIN.md).

La Publishable key fornita dal proprietario è configurata negli example e
nel Worker; nessuna Secret key è stata inserita. OAuth, migrazioni e creazione
del workspace sul progetto reale restano da verificare dal PC dell’utente.
Il collegamento Supabase/GitHub del repo non configura il provider OAuth.

Verifica reale del progetto: endpoint Auth raggiungibile e Publishable key
accettata; `external.github` risulta disabilitato al controllo. Il login è
bloccato finché il proprietario non configura il provider e i redirect.
Typecheck, lint, 7 test dominio/PostgreSQL, 7 room, 3 setup e 5 browser
passati; build frontend e dry run Worker passati. Test OAuth browser
verificano richiesta PKCE/redirect e callback di errore con fixture, non
un’autorizzazione GitHub reale. Usare `pnpm run doctor`: `pnpm doctor` è
un comando interno di pnpm 11 e non esegue lo script del progetto.
