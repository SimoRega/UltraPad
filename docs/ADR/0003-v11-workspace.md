# ADR 0003 — Home, file singoli, temporanei e strumenti v1.1

I file singoli conservano il modello FK/ACL R1: un workspace e un progetto
personali per proprietario, identificati da flag e indici unici. Una RPC
transazionale con advisory lock provisiona il contenitore e crea il file.
Non si rende nullable project_id e non si introduce una persistenza parallela.
Il wrapper mutate impedisce condivisione del contenitore personale; mutate_v1
è revocata agli utenti diretti per evitare bypass. Migrazione 004 additiva.

updated_at/last_modified_by/theme indicizzano la home, selezionata con RLS.
L'attività di contenuto viene indicizzata dopo commit e ACK Durable Object,
con una chiamata RPC best effort in waitUntil: un guasto del DB non rende
negativo un ACK di contenuto già durevole. L'indice può restare indietro fino
al prossimo aggiornamento riuscito. Non è un audit log né una certificazione
di salvataggio. Sequenze monotone per generazione impediscono che richieste
ritardate sostituiscano l'ultimo autore; ACL e generazione sono riverificate.
I metadati cambiano tramite trigger; restore resetta activity_seq. Nessuna
credenziale privilegiata è necessaria. La home non scarica contenuti Yjs.

Temporanei in sessionStorage per account, senza room o richiesta mutation;
un errore di storage è mostrato e il testo rimane scaricabile da Monaco.
Promozione tramite create_standalone e inizializzazione Yjs, tenendo la copia
temporanea finché l'utente la elimina. Non si promette durata dopo chiusura.
Storia recenti in localStorage contiene solo ID e viene incrociata con RLS.

I temi sono preferenze locali validate e applicate via variabili CSS e
Monaco. Gli strumenti per formato agiscono con executeEdits, con undo stop:
y-monaco conserva il singolo percorso collaborativo. Nessun HTML eseguito,
nessun runner o formattatore remoto. TEX/BIB restano testo, fuori da M4–M8.
Il manifesto ZIP pubblico si chiama ultrapad-project; nessun import di vecchi
manifesti è disponibile in R1, quindi non si cambia un parser esistente.
