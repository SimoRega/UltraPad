# ADR 0007 — OAuth Google e modalità ospite v1.5

Stato: accettato su richiesta del proprietario.

Google usa Supabase Auth signInWithOAuth(provider: google), nello stesso
flusso PKCE di GitHub. Il redirect è la radice dell’origine corrente;
Supabase JS gestisce lo scambio del codice e la sessione. Errori callback
sono comuni ai provider. Client ID/Secret Google vengono configurati nel
provider Supabase, mai nei VITE_* o nel repository. JWT, RLS, ruoli e
identità account del backend rimangono invariati.

«Continua senza account» monta un componente distinto dall’app autenticata.
Non chiama signInAnonymously, non crea utenti/workspace/file nel DB, non
carica bootstrap/dashboard/copie IndexedDB di account e non apre room.
Il primo accesso ha un elenco vuoto. I soli file visibili sono quelli creati
oppure importati dall’ospite in quella scheda. Gli editor ricevono localChanged
ed escludono quindi CollaborationClient. Il ruolo owner locale è una capacità
di editing del documento in memoria, non una credenziale per le API.

File e delta rich text sono mantenuti in sessionStorage con chiave distinta
`ultrapad-drafts:guest-v1.5`; il flag modalità è `ultrapad-guest-mode`.
Il ricaricamento della stessa scheda conserva le copie, la chiusura della
scheda ne termina la conservazione. Limiti: 20 file, 1 MiB testo/file e
quote browser. Il valore vivo rimane in memoria quando una scrittura fallisce;
chiusura/navigazione/create/import sono bloccati e il download resta disponibile.
Non si promette recupero dopo crash o persistenza equivalente al database.

Il ritorno al login conserva le copie nella scheda. Non c’è promozione
silenziosa al DB quando l’utente accede: deve esportare/importare per trasferire
il lavoro. Google e ospite non modificano le ACL dei link condivisi.
Un link privato in modalità ospite mostra esclusivamente lo spazio locale.

Test browser: PKCE Google e scambio codice con fixture, errori/retry,
isolamento dalle copie account/link privati e assenza richieste API/DB/socket,
rich text/reload/download, import/preview/rename/delete, errore storage,
login di account Google senza promozione. Login Google remoto richiede
configurazione del proprietario; fixture non certificano consenso OAuth reale.
