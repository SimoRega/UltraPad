# ADR 0008 — Evolutive 1.6, proiezioni e servizi isolati

Stato: accettato per il codice autorizzato dal proprietario (#5–#22), 2026-10-06. Validazione operativa dei servizi esterni pendente.

## Contesto

La v1.5 separa ospite locale e account, CRDT autoritativo nelle room, RLS in Postgres e backup opzionale. Le evolutive introducono metadati persistenti, collaborazione asincrona e tool che elaborano contenuti non fidati. Non è consentito eseguire codice utente nel Worker.

## Decisioni

1. Schema 005–009 incrementale: ricerca derivata per file/generazione/seq; soft-delete e job purge; commenti/mention/link; board indipendente; Calderone personale; preferenze e inviti. RPC di scrittura security-definer con `search_path=''`, controlli di ruolo e grants ristretti; letture RLS. I vecchi wrapper mutate sono revocati agli utenti.
2. La ricerca non modifica il CRDT. Solo documenti ready della generazione corrente entrano nei risultati; indice monotono, tentativi dopo commit e durante sessioni, reindex esplicito paginato dei documenti modificabili. Nessun embedding o invio AI. L’obiettivo 60 s richiede benchmark operativo.
3. Cestino recuperabile senza scadenza automatica (30 giorni resta proposta). Quote non liberate fino al purge. Purge riservato ad admin, manifesto DB congelato, restore bloccato, serializzazione con le operazioni room, cleanup storage ristretto al prefisso UUID, finalizzazione service-role idempotente e cascade quote. Non riguarda copie scaricate/offline o i vecchi delete project/workspace. Fallimento conserva il job per retry.
4. Copia ospite esplicita, per-account/source-id, seed durevole e idempotente; nessun overwrite quando cambia operation-id o esiste già contenuto. L’originale locale non viene rimosso.
5. Commenti/link usano relative positions Yjs e generazione; collasso/ripristino non viene spacciato per anchor valida. Mention solo di membri autorizzati. ACL reevaluate a ogni lettura. Board CAS per elemento, quota 200 e 20 snapshot; undo non supera un conflitto remoto. Polling è deliberato per l’MVP asincrono.
6. Segreti: AES-GCM256 browser con PBKDF2 e salt/IV casuali per copia; server conserva envelope. Titoli/immagini in chiaro, ricerca sui segreti solo dopo sblocco. OCR Tesseract locale, asset self-hosted/licenze upstream, nessun CDN runtime; CSP abilita solo WASM, non eval generico. Non promettiamo un password manager certificato.
7. Office nel Web Worker browser con limite tempo/file/decompressione. Mammoth seguito da sanitizzazione e validazione whitelist rich; RTF parser ristretto. Rapporto di perdite e conferma prima di creare copie; originali non allegati cloud.
8. Notebook/PDF elaborano snapshot server immutabili, restando modificabili senza runtime. Servizio Node separato con Docker **runsc obbligatorio**, immagini fissate per digest, utente non privilegiato, rete assente, filesystem read-only, quote tempo/RAM/CPU/PID/output. Nessun fallback a container standard, JS eval nel frontend o Worker. L’interfaccia indica indisponibilità se non configurato. Cancellazione per user/job, revisione e runtime nell’output. Dopo job si ricontrolla l’accesso alle revisioni prima di restituire risultati.
9. PDF usa manifest TEX/BIB fino a 30 file/1 MiB, pdflatex/BibTeX senza shell escape/rete; nomi semplici e senza asset remoti. Un manifest di revisioni non è un snapshot atomico di progetto. Preview HTML resta chiaramente distinta.

## Conseguenze e verifica

Migrazioni richieste prima del deploy coordinato. Unit SQL eseguono le migrazioni reali e verificano ACL, CAS null/missing, soft-delete/restore, index monotonic, guest mapping e purge retry/finalizzazione/quote. Workerd testa seed retry e purge room ripetibile. Browser testa mobile/templates/export/colori/Office oltre alle regressioni CRDT/OAuth. Test del contratto runner non equivalgono a validazione gVisor/TeX: l’attivazione richiede il gate elencato in services/runner/README.md. Audit utenti, screen reader/iOS, corpus Office/PDF, benchmark ricerca e fault injection Storage restano esplicitamente aperti.
