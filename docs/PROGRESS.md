# Aggiornamento 1.10 — 6 ottobre 2026

Sidebar espansa con Collassa, logo UltraPad, emoji/nome workspace, Cestino, Tema e profilo. Drag nativo file testuali verso cartelle dello stesso progetto con RPC move_file e metadata_version, conferma server ed errori visibili. Tab riordinabili senza navigazione; X SVG centrata e marcata, bordi da 2 px. Versioni web/desktop 1.10.0 e cache v1.10. ADR 0013 e V1_10.md. Nessuna nuova migrazione o deploy remoto.

Verificati typecheck/lint, 34 unità/PGlite, 21 integrazione workerd, build frontend/Worker dry-run e 5 E2E mirati 1.10/1.8. Le tre nuove prove coprono etichette sidebar, X/bordo, drag con conflitto e successiva conferma/reload, riordino senza cambiare file attivo, chiusura e viewer. Auth e metadati browser sono fixture; nessun OAuth/cloud/installer 1.10 certificato. Le prime prove drag usavano coordinate su righe fuori dalla porzione visibile dell'albero: le verifiche finali usano viewport esplicita e scroll per la visibilità dei bersagli.

# Aggiornamento 1.9 — 6 ottobre 2026

Trascinamento di schede/tratti con mouse, pennello colore/spessore, undo, anteprime dei collegamenti, coordinate corrette con zoom/scroll e recupero esplicito di salvataggi falliti. ADR 0012 e V1_9.md. Migrazione 010 obbligatoria prima del frontend, nessuna migrazione/deploy remoto eseguito. Versione web/desktop 1.9.0 e cache v1.9. Corretto anche il checkpoint SQL (alias b ambiguo).

Verifica locale: typecheck/lint, 34 unità/PGlite (migrazioni reali con tratti/ACL/CAS/checkpoint), 21 integrazione workerd, 3 setup, 2 contratto runner, 6 sicurezza desktop e build web/Worker passati. Cinque nuovi E2E lavagna passati. Nella prima suite browser 52/57 passati: tre regressioni hanno superato timeout/carico e sono passate in verifica mirata; il test drag ora attende il completamento dell'undo prima di trascinare di nuovo. Foglio collaborativo passato dopo allineamento delle tre attese di sync a 20 secondi (come ACK esistente). Tutti i 58 casi attuali risultano verificati complessivamente fra suite e riesami; non dichiarato un singolo run completo senza retry. Auth/metadati browser fixture, nessun cloud/OAuth/installer 1.9 certificato.

Integrazione con main/PR #29: preservate icone/tab/editor 1.8 e lavagne 1.9; versione/cache 1.9, ADR lavagna rinumerato 0012. Sul risultato integrato passati typecheck/lint, 34 unità, 21 workerd, build frontend/Worker e 7 E2E 1.8/1.9.

# Aggiornamento 1.8 — 6 ottobre 2026

Implementate le modifiche UI approvate dal proprietario: icone SVG per
formato/cartella condivise, tab stile Chrome, intestazione workspace allineata,
barre editor compatte con menu sovrapposti Testo/Paragrafo/Stili, strumenti
sorgente ed opzioni. Versione web/desktop 1.8.0 e cache shell aggiornata.
Guida V1_8.md e ADR 0011. Nessuna migrazione o modifica API/CRDT/ACL/sandbox.

Verificati typecheck/lint, 31 unità/PGlite, 21 integrazione workerd, 3 setup,
2 contratto runner, 6 sicurezza desktop, build web/Worker dry-run. 55 E2E web
verificati: 52 nella suite isolata completa e i 3 restanti al riesame mirato;
anche le due nuove prove 1.8 sono state ripetute dopo la rifinitura mobile.
I nuovi test controllano selezione/menu/Escape, ingombro delle barre,
esportazione visibile a 360px, icone per formato e strumenti sorgente.
Le attese di caricamento dell'editor sono portate a 20 s nei test interessati.

L'ambiente aveva un'altra istanza sulle porte standard: le prove finali
usano porte locali 5273/5274/8888 isolate, senza committare quel cambio.
Il riesame mirato supera il timeout della preview ospite e della vista viewer
foglio; gli screenshot desktop/mobile sono stati ispezionati. Nessun deploy
remoto, OAuth reale o nuovo installer dichiarato verificato dalla sessione.

# Client desktop Electron — 6 ottobre 2026

Su richiesta del proprietario, aggiunto apps/desktop con frontend 1.7 incluso,
Electron 44.5.1 e Forge 8.0.1, sandbox/isolation, origine HTTPS canonica,
menu/dialog nativi, protocollo OAuth con nonce/PKCE, installer Windows e ZIP.
Nessuna migrazione DB o deploy Worker/Pages. Guida: DESKTOP.md; ADR 0010.

Verificati typecheck/lint, 31 unità/PGlite, 21 workerd, 6 unità desktop,
3 setup, 2 contratto runner, build frontend/Worker e packaging Linux.
Quattro E2E con Electron reale passati: ospite offline/reload e isolamento,
OAuth PKCE/callback falsi/replay, annullamento, import Markdown e download locale. Nel container gestito la
prova Electron richiede Xvfb locale e un launcher temporaneo che evita
requestSingleInstanceLock (socket AF_UNIX non consentiti); il workaround
non entra nel repository o nella distribuzione. La CI Windows esegue la
suite sul vero eseguibile pacchettizzato senza quel workaround.

CI finale sul commit d7a746d: installer Windows generato, quattro test sul
vero eseguibile pacchettizzato e 53 E2E web passati. Artifact separati per
installer e ZIP, workflow Windows 37470957519 e verifica 37470957482.
Nel container due test web intermittenti (JSON/foglio condiviso) sono passati
al riesame mirato; entrambe le CI complete sono riuscite. Consenso
OAuth reale, allowlist Supabase, callback OS dopo installazione pulita,
firma e auto-update restano gate distinti: non dichiarati verificati.

# Aggiornamento 1.7 — 6 ottobre 2026

Richiesta del proprietario: navigazione/ricerca/dialog, emoji workspace Android, planner calendario su Markdown e fogli testuali con toolbar e formule. ADR 0009 e V1_7.md descrivono formato, limiti, compatibilità e salvataggio. Nessuna nuova migrazione SQL/protocollo o deploy remoto dichiarato.

Verifiche locali 1.7: typecheck/lint, 31 unità/PGlite, 21 workerd, 3 setup, 2 contratto runner, 48 E2E regressioni e 5 nuovi E2E (planner, foglio/CSV, backdrop, workspace/ricerca, room condivisa/viewer). Build frontend e dry-run Worker passati. I due nuovi flussi con Auth fixture sono stati rieseguiti dopo aver corretto attese/cleanup del test; nessun OAuth o deploy remoto certificato.

# Aggiornamento 1.6 — 6 ottobre 2026

Implementazione delle issue #5–#22: toolbar/Focus/mobile/template, palette/preferiti/ricerca, centro recupero, guest transfer, export/diff/cestino/purge, inviti/commenti/link/board, Calderone/OCR/segreti, notebook e tesi PDF con runner separato, Office DOCX/RTF. Vedere V1_6.md e ADR 0008 per limiti e gate non verificati. Nessuna distribuzione/migrazione cloud o isolamento runtime è dichiarato verificato dai test locali.

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

## v1.3 — Chiusura, temporanei, anteprime, profili e presenza

Implementati X sulle tab e sul temporaneo, selezione della tab rimasta,
spazio /temporary, sidebar workspace espandibile, anteprima testo per file
server e temporanei senza aprire una room. Chiusura attende la coda locale;
IndexedDB mantiene gli update offline per replay; errore di persistenza
locale blocca la X e mantiene il testo esportabile. Temporanei conservati
fino alla chiusura della scheda, con X distinta da eliminazione.

Nome/cognome suggeriti dalla mail, modificabili nell'account; avatar raster
compatto nell'account Supabase Auth, con crop/compressione e fallback iniziali.
GET presence autorizzato ricava i profili dalle sessioni room verificate,
non dai dati awareness; gestisce socket chiusi/scaduti/revocati e hibernation.
Polling home/editor ogni 10 secondi solo in viewport, dedup per file/account;
lookup esterni fuori dalla coda di commit. ADR 0005 descrive limiti, JWT,
CSP e costi. Nessuna migrazione SQL o modifica del protocollo CRDT.

Verifiche locali: typecheck/lint, 19 unità/PGlite, 20 integrazione workerd,
33 browser Chromium e 3 setup (75 test), build frontend e Worker dry run,
tutti passati. Nuovi browser verificano chiusura attiva/inattiva/ultima tab,
conservazione temporanei, offline/replay, errore IndexedDB, espansione/mobile,
anteprima, upload reale raster e richiesta Auth con nome/cognome/avatar,
presenza in home/editor e scomparsa dopo chiusura. Come già in v1.2, lo shim
locale per enumerazione interfacce Node è usato solo nel container e non
committato. Le fixture Auth/ACL non certificano il profilo su Supabase remoto:
nessun deploy o test OAuth reale aggiuntivo eseguito. Gate R1 invariati.
Aggiornare frontend e Worker insieme e mantenere gli header CSP (V1_3.md).

## Evolutive 1.3.1

Issue #1: intestazione compatta, layout elenco/griglia/raggruppati, temporanei
aperti immediatamente e preview affiancate HTML/Markdown/LaTeX con snapshot
in nuova pagina. Scelte e limiti in ADR 0006 e docs/V1_3.md.

## v1.5 — Google e ospite

OAuth Google tramite Supabase/PKCE e spazio ospite locale separato, senza
richieste API/DB/room o promozione automatica dei documenti. Nessuna migrazione
SQL nuova; provider Google da attivare nel progetto remoto (docs/V1_5.md).
ADR 0007 descrive limiti sessionStorage e isolamento dagli account.
