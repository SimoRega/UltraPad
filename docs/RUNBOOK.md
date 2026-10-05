# Operazioni e recupero

## Salvataggio

`salvato sul server` indica tutti gli update locali confermati dal commit
SQLite. `offline` e `locale` si riferiscono al dispositivo. `accesso cambiato`
blocca sincronizzazione ma permette download della copia locale. Non
cancellare IndexedDB quando ci sono modifiche non confermate.

In caso di errore quota, file ripristinato o revoca: scaricare la copia locale,
verificare l'accesso, riaprire il file e importare la copia come nuova risorsa
solo se il ruolo lo consente. Non applicare bytes di una generazione vecchia
alla nuova room.

## Restore interrotto

Un restore conserva `restore_id`, `restore_checkpoint` e `pending_generation`
nei metadati. Ripetere POST `/v1/files/:id/restore` con gli stessi UUID e JWT
admin/owner. Non modificare manualmente `generation` o togliere il lock senza
verificare safety checkpoint e seed. Un nuovo `operation_id` non sostituisce
un'operazione pendente. Il puntatore viene pubblicato dopo il seed durevole.

## Checkpoint e quote

Il segreto CHECKPOINT_SERVICE_ROLE abilita pubblicazione privata e copia
periodica. Controllare backup-health: `seq`, `last_time`, `error`.
Un errore backup non cancella il documento né il checkpoint SQLite. Le
versioni automatiche esterne conservano le ultime 20; le versioni manuali
locali hanno limite 40/room. Non cancellare puntatori e oggetti a mano in
produzione senza piano di retention. Le prenotazioni di quota sono
conservative: riconciliare room, snapshot, generazioni e Storage prima di
liberare prenotazioni rimaste dopo errori.

## Backup indipendente

Predisporre un ambiente fidato con Node 24 e pg_dump compatibile col server.
Usare un token **owner** aggiornato che veda tutti i workspace da copiare.
Il job fallisce se una lettura non riesce; non inventa un backup parziale.

Variabili server richieste:
- DATABASE_URL: connessione Postgres per pg_dump.
- BACKUP_API_URL: origine API di staging/produzione.
- BACKUP_USER_TOKEN: JWT owner, rinnovato da un processo fidato prima del job.
- BACKUP_KEY_HEX: chiave casuale di 32 bytes in formato hex, custodita separata.

```sh
node scripts/backup.mjs
# Copiare il .upbk in storage esterno al provider operativo.
# Verificare periodicamente la decifratura in ambiente isolato:
node scripts/backup.mjs decrypt backups/example.upbk backups/restored
```

Archivio cifrato: dump Postgres, metadati/file, stato Yjs corrente e bytes dei
checkpoint locali correnti/pubblicati. Il taglio contenuti è per file, non
una transazione globale con il dump. Il backup non include utenti Auth
riutilizzabili in un altro progetto, configurazione OAuth, segreti, bucket
configurazioni o room storiche mai pubblicate. Registrare questi elementi
nel piano di recupero, fuori dal repository e dal dump.

Il job **non è schedulato** e il rinnovo del JWT non è automatizzato qui.
Prima della beta: scheduler fidato, backup giornaliero metadati e copia
contenuti almeno ogni 15 minuti, trasferimento cifrato indipendente,
retention e alert su errore. Misurare RPO/RTO con un drill, non dedurli dalla
presenza del file script.

## Disaster recovery (gate aperto)

1. Fermare accessi/mutazioni nel vecchio ambiente.
2. Ripristinare e verificare il dump in un ambiente isolato compatibile.
3. Riconciliare identità Auth, configurazione OAuth, ACL, bucket e chiavi.
4. Recuperare i documenti dai bytes Yjs/documenti cifrati; nuove room devono
   avere nuove generazioni. Ripristinare i bytes Storage prima dei puntatori.
5. Verificare tutti gli hash, autorizzazioni, file e un export leggibile.
6. Ripetere test tre browser/revoca/restore prima di riaprire il servizio.

La ricostruzione massiva delle room da backup e il drill provider-to-provider
richiedono ancora un workflow operativo dedicato: non sono dichiarati
completati. Finché non sono verificati, conservare anche export dei sorgenti
importanti fuori dal servizio e usare staging per la validazione.
