# ADR 0006 — Home e anteprime renderizzate della 1.3

Stato: accettato, su richiesta dell’issue #1 «Evolutive della 1.3».

La home offre griglia, elenco e card raggruppate per tema, estensione,
workspace o giorno di modifica. La disposizione è una preferenza opzionale
per utente/browser. Ricerca e ACL del dashboard restano invariati.
L’intestazione è compatta, con azioni orizzontali.

Un temporaneo apre subito un TXT locale con nome disponibile automatico.
«Nome e formato» consente di rinominarlo senza crearne un altro. Il file
singolo conserva il dialogo e la persistenza server. Le scritture temporanee
restano in sessionStorage, con limiti ed errori che impediscono perdita dati.

La preview usa il modello Monaco corrente, incluse modifiche remote Yjs e
offline, senza aprire un secondo client. Markdown-it disabilita HTML raw.
LaTeX.js rende TeX in HTML con formule: non compila PDF, non supporta tutti
pacchetti e comandi né riproduce l’impaginazione del compilatore TeX.
Comandi incompatibili producono un errore visibile. Limite: 50.000 caratteri;
debounce: 300 ms. Il sorgente rimane intatto, modificabile e scaricabile.

DOMPurify filtra il risultato; iframe sandbox senza permessi e CSP interna
bloccano script, rete, form e base URL. I font sono caricati esclusivamente
dall’origine dell’app e incorporati come data. Pages permette solo frame
self/blob. La nuova pagina è uno snapshot con lo stesso sandbox e senza
opener. Nessun sorgente viene eseguito o compilato nel Worker API.

HTML dinamico e risorse esterne sono disabilitati. Il parser LaTeX gira sul
thread browser con limite dimensionale; la compilazione completa resta
fuori scope. Test E2E verificano rendering, isolamento, snapshot, modifiche
non salvate, errori e preferenze di layout.
