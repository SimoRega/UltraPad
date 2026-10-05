# UltraPad

Leggi docs/SDD.md, docs/PROGRESS.md e gli ADR prima di modificare il progetto.
Scope corrente: v1.3.1 (evolutive issue #1, ADR 0006), oltre alla v1.3 (chiusura tab, temporanei, anteprime, profilo e presenza)
autorizzato dal proprietario; ADR 0004 anticipa il rich text di M4.
Office e le altre funzionalità M4–M8 restano separate; gate R1 aperti.
Nessuna persistenza o autorizzazione fittizia nel codice di produzione.
TestRoom e JWT sintetici esistono solo in tests/, mai nel bundle produttivo.
Non loggare JWT, ticket, sorgenti, email invito o credenziali.
Le modifiche a schema, protocollo, ACL, restore e backup richiedono test
appropriati e aggiornamento degli ADR. Eseguire lint/typecheck/unità,
integrazione e build; E2E quando si modificano browser o protocollo.
Non dichiarare OAuth, quote cloud, backup remoto o disaster recovery
verificati senza risultati ottenuti nell'ambiente di destinazione.
Nessun codice utente deve essere eseguito nel Worker API.
