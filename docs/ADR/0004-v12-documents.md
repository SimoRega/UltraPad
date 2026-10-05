# ADR 0004 — Documenti visuali v1.2 nello stesso Y.Text

La richiesta v1.2 autorizza l'estensione rich text dei TXT, anticipando questa parte di M4. Office, allegati, lavagna e runner restano fuori scope.

Quill 2.0.3 e y-quill 1.0.0 collegano l'editor visuale allo stesso `Y.Text('content')` del provider esistente. Nessun secondo documento HTML o salvataggio parallelo: testo e attributi attraversano outbox IndexedDB, chunk, validazione, prenotazioni, commit SQLite e ACK. Il protocollo resta versione 1; lo schema ammette esclusivamente attributi tipografici enumerati e bounded. Embeds, link, attributi arbitrari e altri shared types restano rifiutati. Incolla è testo semplice, drop HTML/file disabilitato. Undo locale distingue modifiche dell'utente da quelle remote.

Un TXT preesistente viene preparato aggiungendo una sola newline finale, necessaria a Quill: il ticket rich richiede `document:true`, l'API controlla l'estensione e la room verifica ruolo di scrittura. La coda seriale prepara e committa prima di emettere ticket/sync; i viewer non modificano il documento. Prenotazione e limiti restano applicati; la modifica incrementa serverSeq ed è trasmessa alle sessioni esistenti. Import/promozione inizializzano il testo e la newline in una singola transazione locale e non richiedono preparazione nel ticket iniziale, evitando newline concorrenti duplicate. Prima conversione online; documenti preparati già in cache sono editabili offline. Nessuna migrazione SQL nuova.

Snapshot e preview includono delta; checkpoint e Storage conservano lo stato Yjs completo. Restore e copia applicano il delta nella nuova generazione. Export TXT contiene solo caratteri; export HTML escapa testo/titolo e genera CSS da attributi validati. `.txt.ultrapad.json` è il formato reimportabile con stili. Il ZIP include sidecar nativi/HTML con hash nel manifesto v2 e dichiara il taglio per file. Import valida nome, attributi e limiti testo/stato prima di scrivere.

Aggiornare Worker e frontend insieme (Worker per primo): il backend v1.1 rifiuta attributi. Ricaricare i vecchi client; la vista sorgente preserva attributi esistenti ma non li visualizza. I font dipendono dall'installazione locale e hanno fallback.

Dialog HTML modali sostituiscono prompt/confirm, con titolo accessibile, Escape e controlli annulla. `/workspaces/:id` separa panoramica scoped da home globale; API filtra prima del limite. Preferenze locali migrano palette esistenti ai pastelli, preservano colori personalizzati, aggiungono glass/astratto e rispettano reduced motion.

Verifica: unità per schema/convergenza/HTML, workerd per checkpoint/restore/stili e preparazione autorizzata, browser per Quill reale, reload, viste, dialog e navigazione; regressioni Monaco e provider precedenti.

Riferimenti: https://github.com/yjs/y-quill — https://quilljs.com/docs/formats — https://quilljs.com/docs/api — https://quilljs.com/docs/modules/history
