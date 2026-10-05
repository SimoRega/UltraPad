# ADR 0002 — Snapshot completa per ogni commit, receipts e generazioni

Questa prima implementazione scrive lo stato Yjs completo in una
transazione SQLite insieme a sequenza e receipt, poi attende `storage.sync`
prima dell'ACK e del broadcast. Un documento candidato protegge schema e
quote. Non esiste una colonna Postgres modificabile con il testo corrente.

Si sceglie una snapshot per ogni update invece del log/compaction ogni 200
update proposto dall'SDD: recovery più semplice e meno finestre di errore,
a costo di write amplification. Non è una decisione finale per il piano
Free: benchmark su Cloudflare necessario prima della beta; passare al log
incrementale se costi o CPU sono eccessivi, conservando ACK e receipts.

Receipts conservate per 30 giorni. ID e bytes diversi o attore diverso
producono errore. Yjs tollera retry fuori dalla finestra; la sequenza può
crescere senza cambiare testo. I frame sono binari, non array JSON.
Header JSON UTF-8 preceduto da lunghezza uint32 big endian, poi bytes.
Frame max 64 KiB, payload chunk 48 KiB, assemblaggio max 8 MiB/30 secondi,
max 171 chunk. Gli assemblaggi server sono in SQLite e sopravvivono a
hibernation. Il candidato ammette solo `Y.Text('content')`, senza embed o
attributi. Awareness è un canale distinto, senza capacità di scrittura.

Restore: lock persistito in Postgres, checkpoint di sicurezza, seed di una
nuova room con nuova generazione, pubblicazione del puntatore. Il token
operazione permette retry. Un fallimento non sblocca silenziosamente il
file: riprendere la stessa operazione. Il client vecchio conserva la copia
locale e non può inviare update alla nuova room.

Le prenotazioni della quota workspace sono conservative e monotone per
generazione. Una prenotazione antecedente a un commit fallito può restare
occupata: riconciliare manualmente prima di liberarla. Questo evita che un
fallimento autorizzi più storage di quello disponibile.
