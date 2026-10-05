# ADR 0001 — R1, monolite edge e autorità CRDT

Decisione: SPA React/TypeScript/Vite, Monaco/y-monaco, Hono su Workers,
room Durable Object SQLite, metadati e OAuth in Supabase. Nessun runner
utente, conversione Office, board o AI nella prima implementazione.
L'SDD integrale è in `docs/SDD.md`. Il nome pubblico dell'app resta UltraPad.

Le transazioni normali Postgres usano JWT utente e RPC con controlli e
`search_path` fisso. La service role è riservata alla pubblicazione dei
checkpoint e relativa retention. La presenza non è contenuto persistente.

Le lease durano 45 secondi e vengono rinnovate con un nuovo ticket ogni
25 secondi. Ogni frame di scrittura riverifica anche il grant corrente.
Revoca push sui percorsi gestiti, scadenza fail closed anche sui reader.
Il token utente è conservato nell'attachment server per la riverifica RLS:
non è inviato nel WebSocket URL o nei messaggi di presenza. Questo è un
tradeoff rispetto a una sessione applicativa server dedicata.

Il gate di fattibilità remoto resta aperto: workerd locale non misura
CPU fatturata, disponibilità o latenze del piano Cloudflare scelto.

## Trasporto locale HTTP/WebSocket

In development gli URL loopback di VITE_API_URL diventano l'origine del
frontend più /api. Vite inoltra HTTP e WebSocket al Worker su IPv4; conserva
Origin e Authorization, rimuove solo il prefisso /api. Il Worker continua
a imporre l'origine configurata e i controlli ACL/RLS: niente wildcard CORS
o rewriteWsOrigin. La porta API è fissata a 8787. In produzione l'URL HTTPS
esplicito viene conservato, con eventuale prefisso del reverse proxy.

Gli errori di connessione sono TypeError applicativi, per mantenere il recupero
metadata offline. Il pulsante Riprova ricarica query; nessun retry automatico
di POST, perché una disconnessione può avvenire dopo un commit remoto.
Il timeout HTTP non garantisce che una mutazione non sia stata applicata.
Fonti: https://vite.dev/config/server-options e
https://developers.cloudflare.com/workers/wrangler/commands/workers/
