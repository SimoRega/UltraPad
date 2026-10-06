# ADR 0013 — Sidebar e trascinamento 1.10

Il drag HTML nativo usa riferimenti locali distinti per file e tab: payload esterni o tab non diventano operazioni sui metadati. Solo file testuali del progetto corrente sono trascinabili; le cartelle sono destinazioni. I permessi effettivi, le verifiche della RPC move_file e il controllo metadata_version restano autoritativi. Nessun aggiornamento ottimistico: invalidazione query dopo conferma server, errore visibile in caso di conflitto.

L'ordine dei tab è stato UI, non metadato collaborativo. Spostare un tab non naviga, non rimonta l'editor e non cambia il documento attivo. Il menu esistente conserva l'alternativa tastiera per spostare file. Nessuna nuova dipendenza, migrazione o modifica Electron.
