# Runner separato UltraPad

Servizio trusted distinto dal Worker API. Richiede un host dedicato con Docker e **gVisor runsc** configurato; non usare solo container standard per utenti non fidati. API HTTP locale `127.0.0.1:8090`, pubblicata dietro reverse proxy TLS autenticato tramite `RUNNER_TOKEN` (almeno 32 caratteri casuali). Il token è un secret Worker e dell’host, mai nel frontend.

Costruire le immagini da questa directory usando `Dockerfile.code` e `Dockerfile.latex`, pubblicarle nel registry autorizzato, poi impostare `CODE_IMAGE` e `LATEX_IMAGE` come riferimenti `registry/image@sha256:<64 hex>`. Il servizio rifiuta tag mutabili. Le immagini Dockerfile sono ricette; build, aggiornamenti di base e approvazione del digest competono all’operatore.

Avviare `node services/runner/server.mjs`. Configurare nel Worker `RUNNER_URL=https://runner.example` e il medesimo `RUNNER_TOKEN`. Il reverse proxy deve supportare richieste fino a 70 secondi, disabilitare il logging del body/Authorization e mantenere `/run` e `/cancel` protetti. L’account del servizio controlla Docker: non esporre socket/porta Docker e non condividere questo host con dati o credenziali di utenti.

Ogni richiesta ha user e job ID inoltrati dal Worker dopo verifica JWT/ACL. Massimo quattro job globali e uno/account. Codice 32 KiB, 10 s, output 64 KiB; LaTeX 30 file/1 MiB, 60 s, PDF 4 MiB; tutti 256 MiB RAM, 1 CPU, 32 PID, filesystem read-only, rete assente, nessuna capability, utente 65534. Sorgenti in bind read-only temporaneo, scratch tmpfs 64 MiB; cleanup/rimozione container anche su errore, timeout o cancel. Il servizio non passa env del processo host al container.

LaTeX usa pdflatex senza shell escape, openin/openout paranoid, file-line-error, BibTeX e tre passaggi; pacchetti solo quelli presenti nell’immagine. Le celle JS/Python non condividono filesystem/stato con altri job.

Gate obbligatori prima dell’attivazione: tentativi rete/DNS, lettura host/segreti, loop infinito, fork bomb, output bomb, filesystem pieno, TeX `write18`/input assoluto, revoca durante job, cancel e cleanup dopo crash. Verificare CPU/RAM tramite strumenti host, corpus JS/Python/TeX/BIB e PDF riapribile; fissare il digest approvato. `node --test services/runner/runner.test.mjs` verifica i contratti, **non dimostra l’isolamento reale**.

Riferimenti: https://gvisor.dev/docs/user_guide/quick_start/docker/ e documentazione TeX Live/pdflatex. Le configurazioni di runtime e kernel restano parte del confine di sicurezza.
