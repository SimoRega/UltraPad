# ADR 0009 — v1.7, viste calendario e fogli testuali

Stato: accettato, richiesta del proprietario del 6 ottobre 2026.

Planner e fogli sono proiezioni del solo Y.Text autoritativo. Riutilizzano MonacoBinding, CollaborationClient, outbox, ACK e controllo ruoli esistenti: nessun secondo canale di persistenza, nessuna nuova RPC o migrazione, nessuna esecuzione utente. Le modifiche visuali diventano edit Monaco con undo, poi normali update Yjs. Il modello Monaco resta montato durante il cambio visuale/sorgente. Ospite usa esclusivamente il callback locale già previsto.

Planner `planner-{giornaliero,settimanale,mensile,annuale}.md`: le sezioni `##` sono celle del calendario; Obiettivi/Bilancio restano separati. `Data: YYYY-MM-DD` nel sorgente conserva la data di riferimento; settimana con date lun–dom, mese con colonne lun–dom e numero giorni reale. Giorni fuori mese restano nel testo e riappaiono cambiando mese. Nessuna integrazione con provider calendario o reminder.

Foglio `*.sheet.json`: JSON versionato con dimensioni e celle indirizzate, valore testuale, formati e colori validati. Template prealloca celle per ridurre inserimenti concorrenti sullo stesso punto del JSON. Patch del segmento minimo; limiti 200 righe, 26 colonne, 10.000 caratteri/cella, quota documento invariata 1 MiB. Formule aritmetiche e range SUM/SOMMA, AVERAGE/MEDIA, MIN/MAX tramite parser ristretto, budget e rilevamento cicli; mai eval/Function. Non è compatibilità completa XLSX/Excel. CSV esporta valori calcolati, escaping e protezione delle celle testuali contro formula injection.

Il protocollo CRDT rimane testuale: edit concorrenti sulla stessa struttura JSON possono produrre JSON non valido. La vista mostra errore e mantiene sorgente/export/undo per recuperare; non resetta contenuti malformati. Non promette transazioni atomiche multi-cella o semantica CRDT per cella. Il salvataggio visuale avviene al blur/Invio, non per ogni battuta.

Workspace: RPC rename_workspace esistente, owner nella UI, ACL DB invariata. Picker Unicode con subset Noto Color Emoji self-hosted (SIL OFL) mostra lo stile Android; rail collassata mostra solo emoji se presente. Modal chiude solo click oltre il rettangolo del dialog; click interni e margini interni restano aperti, Escape invariato. Calderone primario con ampolla, ricerca persistente nel topbar, cestino nella rail.

Verifica: test parser/limiti/CSV/patch, E2E ospite e metadati fixture, room durevole reale per celle condivise e viewer, suite regressioni esistente. Queste prove non certificano DB/OAuth/deploy sul progetto remoto.
