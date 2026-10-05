# Stato dell'implementazione — 5 ottobre 2026

Il prototipo Electron è sostituito dall'implementazione web M0–M3/R1 prevista
dall'SDD. La cronologia precedente resta recuperabile in Git. Questo è codice
da validare in staging: **R1 non è ancora certificata per staging/produzione e non è stato effettuato
un deploy da questa sessione**. L'SDD completo è conservato in `docs/SDD.md`.

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
| Test dominio/protocollo, presentazione + PostgreSQL PGlite | 16 passati |
| Test workerd/SQLite/Durable Objects | 17 passati |
| Playwright Chromium | 25 passati |
| Setup locale Node | 3 passati |
| Build frontend + dry run Worker | Passati |
| Audit dipendenze produzione v1.2 | 1 advisory low di Quill sull’export HTML; funzione vulnerabile esclusa, export validato indipendente (vedere DEPENDENCIES.md) |

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

La v1.2 anticipa l'editor rich text TXT (ADR 0004). Restano successive:
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

## Correzione connessione API dopo il login

Il proprietario riferisce login reale riuscito e Failed to fetch nelle
operazioni. Non è disponibile il log del suo Worker Windows; non viene
asserita una causa specifica della sua macchina. Corrette fragilità del
trasporto locale: proxy Vite /api per HTTP e WebSocket, IPv4/porta API fissi,
URL socket che conserva il prefisso, messaggi per API spenta/non raggiungibile,
controllo health opzionale `pnpm run doctor -- --api`, Riprova per le query.
I controlli CORS/Origin del Worker restano restrittivi.

Typecheck, lint, build e dry run passati; 10 test unit/PostgreSQL, 9
integrazione, 3 setup, 8 browser (30 in totale). I browser verificano GET e
POST tramite il proxy con JWT/corpo mantenuti, Monaco/WebSocket, fallimento
di rete e recupero del backend. Verifica aggiuntiva con server Vite reale
e upstream spento: HTTP 503 con JSON API_UNAVAILABLE. Le prove CRUD con JWT
e metadati fixture non certificano le migrazioni o la rete del PC Windows.

Avvio combinato reale `pnpm dev` verificato con configurazione del progetto:
health Worker diretto e attraverso Vite entrambi HTTP 200, configured true.
Bootstrap senza JWT attraverso il proxy HTTP 401, quindi il trasporto non
aggira l’autenticazione. Non è stata eseguita una mutazione sul database
remoto perché non è disponibile una sessione JWT del proprietario.

## Correzione 403 sulle mutazioni

Il log del proprietario mostra POST /v1/mutations 403 (9 ms), senza corpo
JSON: non identifica da solo ORIGIN o FORBIDDEN. Riprodotto il rifiuto
prima dell'autenticazione per APP_ORIGIN con slash finale o host loopback
diverso da quello della pagina. Normalizzata l'origine, applicata policy
comune HTTP/WS con alias esclusivamente locali sulla stessa porta.
Aggiunti messaggi distinti per ORIGIN e FORBIDDEN e origine attesa nella
risposta ORIGIN; nessuna rimozione di controlli JWT, ruoli o RLS.

Verificati localhost/IPv4/IPv6 locali, preflight, alias senza JWT (401),
WebSocket upgrade, slash finale, produzione esatta e rifiuto di dominio
esterno, porta/protocollo diversi e alias su un Worker pubblico. La verifica
sulla macchina Windows del proprietario resta da effettuare dopo aggiornamento.

Verifiche di questo aggiornamento: typecheck e lint passati, build frontend
e dry run Worker passati, 10 test unit/PostgreSQL, 14 integrazione, 3 setup
e 9 browser passati (36 totali). Il browser aggiuntivo verifica che ORIGIN
indichi l’indirizzo configurato; i test RLS/viewer restano attivi.

## V1.1 — home, file singoli, temporanei, temi e strumenti

Il proprietario ha confermato login reale, DB e funzioni base della v1 sul
suo PC. Implementata la richiesta v1.1 con branding UltraPad, home a piena
area con recenti/ultima modifica/team/temi, progetti e ricerca; file personali
nel DB senza provisioning manuale e temporanei nella scheda con promozione
al DB e copia di recupero conservata. Aspetto con superfici e bordi smussati,
bianco/nero, palette e colore principale; tema condiviso con Monaco.
Barre specifiche per tutti i 13 formati R1, fallback testo, undo/redo,
formatter incorporati e verifica JSON/XML. Nessun rich text/Office/runner.

Migrazione 004 additiva: flag personali, indice attività e temi; RPC atomica
per file singoli, blocco condivisione e progetti nel contenitore personale,
revoca della RPC interna, ruoli/RLS conservati. Aggiornamento indice dopo ACK
durevole best effort; non è una nuova autorità di contenuto né un audit log.
Vecchi eventi non ricostruiti. ADR 0003 e guida V1_1.md documentano scelte,
limiti (100 file home, 20 recenti, temporanei fino a chiusura scheda) e upgrade
con sola 004 su v1. Il service worker rinnova la cache della shell per v1.1.

Verifiche: typecheck, lint, build e dry run Worker passati; 13 unit/PostgreSQL,
14 integrazione workerd, 3 setup e 18 browser (48 totali). Browser verificano
la home, filtro team/tema, errore/retry API, temporanei senza mutation e dopo
reload, creazione singolo, promozione al DB con ACK e reload, recupero della
copia temporanea, temi pagina/Monaco con persistenza, undo collaborativo,
viewer read-only, JSON e mobile senza overflow. SQL verifica privacy,
provisioning atomico e rollback, temi, sequence/generation e blocco bypass
condivisione. Le fixture non certificano la migrazione nel progetto remoto:
il proprietario deve applicare 004 prima di usare questa release.

## v1.2 — Documenti visuali e navigazione

Richiesta successiva al riscontro dell'utente che v1 è operativa. Dialog modali
per file, etichette e conferme; home globale separata dai workspace con filtro
prima del limite. Palette pastello, gradient glass animato e astratto statico,
con reduced motion e migrazione delle preferenze locali.

TXT visuali con Quill/y-quill sullo stesso Y.Text/provider, toolbar Testo,
Paragrafo e Stili, pennello e undo. Font/dimensioni, enfasi, colori,
apice/pedice/maiuscole, allineamenti, liste multilivello, rientri/interlinea,
spaziatura/sfondo/bordi. Schema attributi whitelist: no embed o HTML arbitrario.
Preparazione newline server autorizzata una sola volta; cache rich offline.
Checkpoint/copia/restore mantengono stili; export HTML e documento nativo
reimportabile, sidecar ZIP v2 con hash e recupero locale formattato.

ADR 0004 aggiorna lo scope rich text; Office/runner/allegati ancora successivi.
Nessuna migrazione SQL dalla 1.1. Aggiornare frontend e Worker insieme e
conservare le variabili configurate: docs/V1_2.md. Nessun deploy remoto o
nuova verifica dell'OAuth reale effettuata dalla sessione v1.2.

Verifica locale v1.2: typecheck/lint, build frontend e Worker dry run,
16 unità/PGlite, 17 workerd, 25 browser e 3 setup: 61 test passati.
Browser include typography/pennello/lista/zero spacing, stili condivisi,
offline, viewer, import nativo/promozione, reload e vista sorgente.
Cache Vite separate tra app e harness evitano invalidazione incrociata dei
moduli lazy. Nessuna configurazione di test entra in produzione.
