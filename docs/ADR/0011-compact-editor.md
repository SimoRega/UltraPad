# ADR 0011 — Interfaccia compatta 1.8

Stato: accettato su richiesta del proprietario, 6 ottobre 2026.

Un componente SVG locale identifica file e cartelle dal nome/kind senza
aggiungere dipendenze o risorse esterne. FileTab è condiviso fra documenti
server, temporanei e ospite; il callback di chiusura server mantiene settled
ed il controllo di localSaveFailed. Nome ed identità sono invariati.

I comandi secondari si aprono in pannelli sovrapposti chiudibili all'esterno
ed Escape, con focus restituito al pulsante. Quill conserva relative positions
per applicare il formato dalla selezione. La barra primaria espone font,
dimensione, enfasi, undo/redo ed export; tutti gli altri formati restano nel
pannello Testo/Paragrafo/Stili. Monaco conserva le stesse azioni nel menu.
Le tab usano pulsanti nativi, aria-current e nomi accessibili per la X.

Nessun cambio di API, schema, autorizzazioni, persistenza o sandbox.
