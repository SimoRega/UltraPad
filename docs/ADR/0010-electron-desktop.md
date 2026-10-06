# ADR 0010 — Electron desktop con frontend incluso

Stato: accettato per la richiesta del proprietario del 6 ottobre 2026.

Electron 44.5.1 e Forge 8.0.1 aggiungono un client desktop al monorepo,
senza sostituire la web app. Package `apps/desktop` senza dipendenze runtime
Node: usa Electron/builtin e il frontend Vite già compilato. Forge include
esclusivamente src/assets/renderer/config/package, in ASAR; nessun test,
secret, sorgente server o node_modules nel pacchetto. pnpm usa nodeLinker
hoisted per compatibilità Forge. Electron 44 richiede `install-electron`
esplicito per il runtime di sviluppo/test, non un postinstall implicito.

Il protocol handler della sessione desktop serve asset locali alla stessa
origine HTTPS canonica configurata nel Worker. Le altre richieste HTTPS
usano `session.fetch` con bypassCustomProtocolHandlers. Nessun server locale,
riscrittura di Origin, proxy API privilegiato, wildcard CORS o modifica ACL.
Questa scelta mantiene i controlli Origin anche sui WebSocket e supporta
BrowserRouter, secure context e worker/font/OCR della build esistente.
L'origine canonica è un parametro fidato di build; non viene accettata da IPC.
Un cambio di dominio richiede esportazione delle copie locali e rebuild.
La sessione persistente separata non condivide dati con Chrome o Edge.

Node integration disabilitata, context isolation/sandbox/webSecurity attivi,
webview disabilitate. CSP come quella Pages, no service worker per evitare
shell obsolete dopo upgrade. Il protocollo non serve directory esterne e
non ripiega sul sito remoto per asset mancanti. Link esterni ammessi solo
HTTP/HTTPS/mailto senza credenziali, nel browser di sistema. Snapshot blob
esistenti mantengono sandbox; l'IPC accetta solo il main frame della finestra
primaria sull'origine canonica. Il preload espone solo preparazione/apertura/
annullamento OAuth e risultati: nessun accesso generico a filesystem o shell.

OAuth resta Supabase PKCE per Google/GitHub: challenge/verifier generati e
scambiati dal renderer. Il main prepara un nonce casuale a 256 bit, valida
Supabase/provider/path/redirect/challenge prima di aprire il browser, accetta
solo `ultrapad://auth/callback?state=...` pendente, scadenza cinque minuti e
consumo una volta. Callback, codice, JWT e dati provider non vengono loggati.
La registrazione OS e la allowlist Supabase sono prerequisiti operativi,
documentati separatamente. Nessun mock Auth nel bundle produttivo.

Installer Windows Squirrel, shortcut e protocol client, menu nativi e
dialog download; ZIP per piattaforma. L'unica istanza gestisce second-instance
e open-url. Firma e auto-update restano successivi e non vengono simulati.
Ospite/sessionStorage e outbox/ACK/IndexedDB degli account mantengono la loro
semantica; chiudere la finestra non promette persistenza dei temporanei.

Unità verificano boundary file, URI/provider/challenge/nonce/scadenza/errori;
suite Electron con frontend reale e fixture OAuth solo nei test; regressioni
web e CI backend restano richieste. Installer pulito/OS callback/consenso
provider reale e piattaforme diverse da Windows richiedono validazione dedicata.

Riferimenti: docs/DESKTOP.md, Electron protocol/net/security/deep links,
Electron Forge packaging/makers, Supabase redirect URLs.
