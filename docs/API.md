# API R1 e protocollo 1

Tutte le operazioni `/v1/*` richiedono `Authorization: Bearer <JWT Supabase>`.
Issuer/audience/expiry verificati da `getClaims` e confronto esplicito; RLS
nelle letture e RPC. Errori JSON `{error: CODE}`; nessun token in URL.
L'origine browser deve coincidere con `APP_ORIGIN`. Metadati offline sono
una cache; il server ricontrolla sempre i permessi.

| Metodo e percorso | Effetto |
|---|---|
| GET /health | diagnostica configurazione, nessun segreto |
| GET /v1/dashboard | fino a 100 file testuali autorizzati, ultima modifica decrescente |
| GET /v1/bootstrap | workspace e progetti autorizzati con ruolo |
| GET /v1/projects/:id/files | albero metadati autorizzato |
| GET /v1/projects/:id/members | grant di progetto |
| POST /v1/mutations | RPC atomica `{op,args}` |
| POST /v1/projects/:id/invitations | `{email,role}`, link bound e monouso |
| POST /v1/invitations/accept | `{token}`, consumo atomico |
| POST /v1/files/:id/collaboration-ticket | ticket di 30 s per file/generazione |
| GET /ws/:fileId/:generation | upgrade, nessun contenuto prima di hello valido |
| GET /v1/files/:id/snapshot | stato/revisione server, usato dall'export |
| GET /v1/files/:id/checkpoints | versioni locali e pubblicate |
| POST /v1/files/:id/checkpoints | `{label}`, checkpoint immutabile |
| GET /v1/files/:id/checkpoints/:checkpoint | preview testo con checksum remoto |
| GET /v1/files/:id/checkpoints/:checkpoint/raw | bytes Yjs per backup |
| POST /v1/files/:id/restore | `{checkpoint_id,operation_id}`, admin/owner |
| GET /v1/files/:id/backup-health | configurazione e ultimo stato della copia |

Operazioni: create/delete_workspace, create/delete_project, create_file,
rename_file, move_file, delete_file, set_member, create_standalone, set_theme.
create_standalone richiede `{name}` e restituisce FileRecord con project_id;
set_theme richiede `{kind: "file" | "project", id, theme}` (max 60 caratteri),
con almeno ruolo editor. Il testo temporaneo resta solo nel browser.
Rename/move richiedono
`metadata_version`, nel file, per evitare overwrite di metadati obsoleti.

WebSocket usa frame binari con header JSON UTF-8, lunghezza uint32 big endian
nei primi quattro bytes, e payload raw. Campi/header e quote in
`packages/contracts/src/index.ts` e ADR 0002. hello trasporta ticket, non JWT.
refresh-auth richiede nuovo ticket; sync-request non accetta payload Yjs.
L'unico percorso di modifica è update, incluso l'assemblaggio dei chunk.

Outbox persistita prima dell'invio, eliminata solo dopo ACK di ID/generazione.
A parità di ID l'attore e l'hash dei bytes devono coincidere. L'ACK indica
commit SQLite, non completamento della copia Storage o backup indipendente.
