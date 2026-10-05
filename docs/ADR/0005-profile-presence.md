# ADR 0005 — Profilo e presenza v1.3

Nome, cognome e avatar sono metadati Supabase Auth dell'utente, aggiornati
con updateUser dalla sua sessione. Nessuna nuova tabella o service role.
Prima compilazione suggerita dal local part della mail, separata su punti,
trattini e underscore; si preservano i valori editati, incluso cognome vuoto.
Non è una verifica dell'identità: il profilo è autodichiarato e non concede
permessi. Non si espongono email o token nei payload di presenza.

Upload JPEG/PNG/WebP fino a 5 MiB, crop centrale a 64×64 (fino a 32×32 per immagini complesse), encoding JPEG,
limite 1.800 caratteri; salvato nell'account per evitare un bucket pubblico
aggiuntivo. Solo raster data URL bounded o URL HTTPS senza credenziali
passano la whitelist condivisa. CSP img-src consente HTTPS per avatar OAuth,
referrerPolicy no-referrer; nessuna estensione a script/frame/object.
Il limite compatto evita di gonfiare i JWT che includono user_metadata: un
avatar aggiunge al massimo circa 2,4 KiB al token. Questa release supporta
miniature di profilo; foto ad alta risoluzione richiederanno Storage dedicato.
L'account può rimuovere l'avatar e usare le iniziali.

GET /v1/files/:id/presence richiede identity e access/RLS del richiedente.
La room ricava gli utenti dagli attachment WebSocket autenticati con lease
non scaduta, deduplica per userId e riverifica accesso e profilo con getUser
usando la sessione dell'interessato. Non accetta nomi/ID dal canale awareness.
Dopo i lookup riverifica che il socket sia ancora presente e non scaduto.
Connessioni non autenticate, revocate, scadute o non verificabili non appaiono.
Viewer con file aperto sono inclusi; una tab non selezionata non mantiene
una room attiva. La presenza è effimera, non un audit delle modifiche.

Lookup in parallelo e fuori dalla coda di commit della room, senza scritture
SQLite per polling. Frontend ogni 10 secondi solo per componenti in viewport,
con dedup React Query per file e polling sospeso in background. Nessuna
promessa di aggiornamento istantaneo: chiusura normale visibile al prossimo
poll, connessioni interrotte al più dopo scadenza lease di 45 secondi più poll.
Guasti del provider possono omettere un profilo; errori della richiesta
rimuovono le icone memorizzate e mostrano presenza non disponibile. Costi
remoti di auth/RLS/polling da misurare prima di ampliare il gruppo beta.

Anteprima usa snapshot server già autorizzata, senza ticket, socket, Quill,
Monaco o scritture. Render testo escapato React e taglio visivo 12.000
caratteri: stili e codice non vengono eseguiti. Trasporto snapshot R1 resta
completo (fino ai limiti di stato), quindi il taglio non riduce i byte scaricati.

La X attende la coda locale prima di navigare. Pending outbox rimane in
IndexedDB per replay alla riapertura; non si dichiara confermato dal server.
Se persistenceFailed è attivo la chiusura resta bloccata e invita all'export.
Chiudere un temporaneo torna allo spazio /temporary, senza eliminarlo:
sessionStorage per account, durata della scheda invariata. Nessun workspace
DB fittizio per gli appunti temporanei.

Nessuna modifica ai frame/protocollo, schema CRDT, ACL o generazioni.
Aggiornare Worker e frontend; nessuna migrazione SQL aggiuntiva alla 004.
