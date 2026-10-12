# ADR 0015 — UltraPad 1.12: navigazione, editor affiancati e documenti

Accettato su richiesta del proprietario il 12 ottobre 2026. Perimetro: le dieci priorità della valutazione 1.11, implementate nella 1.12. Il merge su main è autorizzato dopo le verifiche. Non viene aggiunta l'immagine di sfondo esclusa nella 1.11.

## Shell

Componenti separati per breadcrumb, ridimensionamento, menu contestuali e palette. Preferenze della larghezza per account/browser; trascinamento Pointer Events con capture e tastiera frecce/Home/End. Cartelle collassabili. Menu unico per explorer, tab e click destro sui documenti della home, con permessi derivati dal progetto di destinazione. La ricerca resta Ctrl/⌘ K; la palette separata Ctrl/⌘ Shift P filtra le azioni disponibili, con frecce/Invio/Escape.

Sessione per account/progetto: fino a 50 ID di tab, file attivo e file affiancato. È una preferenza di navigazione, non contenuto né autorizzazione. Gli ID sono incrociati con i metadati autorizzati; i file eliminati o revocati non vengono aperti. I tab riappaiono al reload; «Riprendi sessione» apre il file attivo nel progetto. Ripristino non automatico sulla home globale. Il secondo editor apre un file diverso dello stesso progetto, con provider e strumenti separati. Sotto 1000 px i pannelli sono verticali. Chiusura/logout attendono le code locali; gli errori di persistenza bloccano la navigazione e restano esportabili.

## Importazione

Selezione multipla e drop esterno in explorer/ospite. Una cartella bersaglio riceve i file; non si importano ricorsivamente directory. Massimo 50 file per operazione account e 20 file totali ospite. Office resta una conversione con anteprima, da importare singolarmente.

`POST /v1/files/:id/initialize` autentica, controlla ACL, ruolo, generazione, delta, coerenza testo, quota UTF-8/stato e prenotazione DB prima del seed serializzato. Il seed non sovrascrive una room attiva o un documento già scritto; il medesimo operation ID è idempotente. Una nuova operazione non riutilizza un file parzialmente importato: l'errore nomina il sorgente e l'originale locale resta disponibile. Le metadata create prima di un errore possono rimanere vuote e sono gestibili/cestinabili. Non si ritentano POST automaticamente. Ogni contenuto è confermato prima di importare il successivo: nessun contenuto attende soltanto nell'elenco `initials` React. Il drop di file interni e il riordino tab mantengono i controlli CAS già esistenti.

## Documenti

Stesso `Y.Text('content')` e stessa catena outbox/quote/commit/ACK/checkpoint/restore. Nuove capacità:

- `link`: URL http/https/mailto bounded, senza credenziali; nessuno schema eseguibile.
- `image`: embed con un solo campo, data URL PNG/JPEG/WebP fino a 180.000 caratteri. Compressione locale di input fino a 5 MiB, dimensione massima 1280 px. Niente SVG/HTML, upload pubblico o richiesta a server di immagini esterni.
- `table`: ID di riga bounded del modulo Table integrato in Quill. Nuove tabelle fino a 20×10; attributi e contenuti convergono via Yjs.
- Indice navigabile ricavato dalle intestazioni del documento vivo.

Il TXT e la ricerca mantengono solo il testo; formato UltraPad, HTML, checkpoint e recupero locale conservano immagini/tabelle. ZIP include documenti nativi anche quando l'unica differenza è un embed. HTML genera celle/raggruppamenti per ID di riga ed escapa testo, titolo e link.

`documentSchema: 2` nel ticket/lease identifica editor compatibili. I client precedenti possono continuare su documenti testuali; su documenti strutturati vengono bloccati prima della sync. Quando un embed/tabella viene aggiunto, i socket precedenti vengono chiusi con CLIENT_UPDATE_REQUIRED dopo il commit durevole. I nuovi client disabilitano Monaco sui documenti con immagini/tabelle e impediscono il passaggio dalla vista visuale a sorgente: gli indici testuali di Monaco non rappresentano gli embed Y.Text. I link restano rappresentabili nella vista sorgente. Aggiornare prima Worker e poi frontend, quindi ricaricare i client. Non cambia il framing binario, la generazione o l'autorità dei dati. Nessuna migrazione SQL.

## Affidabilità e operatività

Limite presenza separato: 20 messaggi/s/socket, payload massimo 4096 byte e budget globale esistente 220 frame/s. È protezione locale della room, non rate limit HTTP globale per IP/account. Cleanup dei provider idempotente; niente log di documenti/credenziali aggiunti.

I test locali verificano SQLite/workerd, outbox, ACK, checkpoint e restore con il vero CRDT; Auth/metadati sono fixture. Le job CI aggiuntive verificano la 1.12 su Firefox e WebKit. Safari su dispositivi reali, screen reader, OAuth remoto, backup esterno/disaster recovery, isolamento infrastrutturale del runner, cleanup orfani e benchmark cloud richiedono ancora l'ambiente di destinazione. Non sono dichiarati risolti da modifiche UI o test sintetici.
