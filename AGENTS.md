# UltraPad

Client desktop Electron autorizzato dal proprietario il 6 ottobre 2026,
ADR 0010 e docs/DESKTOP.md. Mantenere sandbox/isolation e main-frame IPC;
non aggiungere accesso Node ai renderer o allargare le origini del backend.

Leggi docs/SDD.md, docs/PROGRESS.md e gli ADR prima di modificare il progetto.
Scope corrente: v1.7 (calendari e fogli testuali, ADR 0009), oltre a v1.6 (issue #5–#22 e ADR 0008), oltre a v1.5 (Google OAuth e ospite locale, ADR 0007), oltre alla v1.3.1 (evolutive issue #1, ADR 0006), oltre alla v1.3 (chiusura tab, temporanei, anteprime, profilo e presenza)
autorizzato dal proprietario; ADR 0004 anticipa il rich text di M4.
Office, notebook JS/Python e PDF sono autorizzati nella v1.6; runtime isolato obbligatorio e gate operativi documentati in V1_6 restano aperti.
Nessuna persistenza o autorizzazione fittizia nel codice di produzione.
TestRoom e JWT sintetici esistono solo in tests/, mai nel bundle produttivo.
Non loggare JWT, ticket, sorgenti, email invito o credenziali.
Le modifiche a schema, protocollo, ACL, restore e backup richiedono test
appropriati e aggiornamento degli ADR. Eseguire lint/typecheck/unità,
integrazione e build; E2E quando si modificano browser o protocollo.
Non dichiarare OAuth, quote cloud, backup remoto o disaster recovery
verificati senza risultati ottenuti nell'ambiente di destinazione.
Nessun codice utente deve essere eseguito nel Worker API.
