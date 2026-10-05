# UltraPad

Leggi docs/SDD.md, docs/PROGRESS.md e gli ADR prima di modificare il progetto.
Scope corrente: v1.1 (home, file personali/temporanei, temi e strumenti testuali)
e gate di release R1; M4–M8 restano separati.
Nessuna persistenza o autorizzazione fittizia nel codice di produzione.
TestRoom e JWT sintetici esistono solo in tests/, mai nel bundle produttivo.
Non loggare JWT, ticket, sorgenti, email invito o credenziali.
Le modifiche a schema, protocollo, ACL, restore e backup richiedono test
appropriati e aggiornamento degli ADR. Eseguire lint/typecheck/unità,
integrazione e build; E2E quando si modificano browser o protocollo.
Non dichiarare OAuth, quote cloud, backup remoto o disaster recovery
verificati senza risultati ottenuti nell'ambiente di destinazione.
Nessun codice utente deve essere eseguito nel Worker API.
