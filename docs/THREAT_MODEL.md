# Confini e rischi da verificare

Browser, inviti, frame WebSocket, file importati e testo sono non fidati.
Cloudflare Workers/DO e Supabase Auth/Postgres/Storage sono provider fidati;
nessuna E2EE è dichiarata. Il backend può leggere il contenuto.

- API valida identità, origine, UUID/contratti principali; le RPC controllano
  ruoli, tenancy, parent, cicli, quote e versione metadati. Nessun DML diretto
  concesso agli utenti. Funzioni security definer con search_path fisso.
- JWT in attachment server e tabella ticket per revalidare i grant. Ticket
  monouso, 30 s; attachment lease max 45 s. Nessun JWT nel WebSocket URL.
- Outbound fanout esclude sessioni scadute, alarm chiude reader inattivi.
  Update ricontrolla RLS prima di persistere. Failure auth → fail closed.
- Frame binari limitati, assemblaggi aggregati/temporanei limitati, schema
  candidato solo Y.Text content. Viewer non può inviare sync che scrive.
- L'identità della presenza viene sovrascritta con quella autorizzata dal
  server; awareness non è fonte di ruoli, permessi o salvataggio.
- IndexedDB separata per user/file/generation. Logout permette export del
  lavoro pendente e cancella la cache. Una revoca non cancella copie offline.
- HTML è solo sorgente nell'editor. Non ci sono runner, eval, preview HTML
  eseguibile, compilatori o conversioni Office nel processo API.
- Checkpoint Storage privati; chiave privilegiata solo publisher/retention.
  Scaricare un checkpoint verifica hash prima di applicare Yjs.
- Backup cifrato AES-256-GCM; chiave indipendente. pg_dump e credenziali non
  vengono stampati. Proteggere anche il database di destinazione del restore.

Gate aperti: stress/costi CPU Cloudflare, rate limiting account/IP HTTP,
limite e conteggio awareness separati dagli update, audit degli input Yjs
con corpus/fuzzing esteso, observability redatta/alert, cleanup completo di
room/oggetti orfani e key rotation del publisher. Il rate limite room è
220 frame/s per sessione per permettere trasferimenti a chunk; non è una
protezione anti-abuso sufficiente per un servizio pubblico.

Non abilitare utenti sconosciuti prima dei gate operativi e di sicurezza.
