# UltraPad Desktop — Electron

Prima versione desktop basata sul frontend 1.7, distribuzione Windows x64.
Stesso codice React e stessi servizi Supabase/Worker/room della web app.
Il frontend, gli editor e gli asset OCR/font sono inclusi nel pacchetto:
non occorre tenere il sito aperto o avviare un backend sul PC dell'utente.

## Avvio da sorgenti (Windows)

Prerequisiti: Git, Node.js 24 e pnpm 11.25.0. Dalla radice del repository:

```powershell
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
pnpm desktop:start
```

Se Node non include Corepack: `npm install -g pnpm@11.25.0`.
`desktop:start` compila il frontend di produzione, prepara gli asset,
scarica Electron con il comando ufficiale `install-electron` e avvia l'app.
Non usa il server Vite o Wrangler locale. La prima compilazione richiede rete.
Per iterare sul frontend, ricompilare/riavviare; non è previsto hot reload.

## Installer e ZIP

```powershell
pnpm desktop:make
```

Su Windows produce `apps/desktop/out/make/squirrel.windows/x64/UltraPad-Setup.exe`
e lo ZIP in `apps/desktop/out/make/zip/win32/x64/`.
L'installer crea i collegamenti del menu Start e registra il protocollo
`ultrapad://`. Per utilizzare la login nella distribuzione Windows,
installare con Setup: lo ZIP da solo non registra automaticamente il protocollo.

GitHub Actions → **Build UltraPad Desktop** → esecuzione riuscita →
**UltraPad-Windows-x64** contiene installer, ZIP e file Squirrel.
Non è una release pubblicata automaticamente: i file sono artifact della CI.
Gli installer sono al momento **non firmati**; Windows può mostrare un avviso
sull'editore. Firma e distribuzione commerciale richiedono credenziali dedicate.

`pnpm desktop:package` crea soltanto il pacchetto della piattaforma corrente.
La CI e l'installer sono inizialmente Windows; packaging ZIP macOS/Linux
è predisposto ma richiede verifica sui rispettivi sistemi.

## Login Google/GitHub — configurazione necessaria

Nel progetto Supabase già usato da UltraPad, aprire **Authentication → URL
Configuration → Redirect URLs** e aggiungere:

```text
ultrapad://auth/callback**
```

Il suffisso ammette il parametro `state` casuale per ogni tentativo. Non
modificare i redirect web già presenti. Client secret Google/GitHub rimangono
esclusivamente nel provider Supabase. Nei provider OAuth il callback resta
`https://<progetto>.supabase.co/auth/v1/callback`, come per la web app.

L'app genera PKCE nel renderer e apre Supabase/provider nel browser di sistema.
Il browser ritorna all'app tramite il protocollo registrato; il main process
verifica callback e nonce del tentativo corrente, con scadenza di cinque minuti.
Il renderer scambia il codice con Supabase e conserva la sessione nel profilo
desktop. Un secondo callback dello stesso tentativo è scartato.
Il pulsante **Annulla accesso** permette di riprovare se il browser è chiuso.

In sviluppo Windows/Linux, `desktop:start` tenta di registrare il protocollo
con il percorso di Electron e dell'app. Su macOS testare il ritorno OAuth
con il bundle `.app`, non tramite il comando dev.
Il consenso OAuth reale e il ritorno dal browser dipendono dal provider e
dalla registrazione OS: i test fixture non ne certificano la configurazione.

## Configurazione e dati

La build usa `.env.production` e gli override Vite usuali. Contiene soltanto
URL e chiave pubblica. `VITE_API_URL` e `VITE_SUPABASE_URL` devono essere HTTPS.
La chiave privilegiata Supabase non deve mai essere inserita nella build.

Il frontend viene servito da Electron all'origine HTTPS canonica del sito,
ricavata da `APP_ORIGIN` in `apps/api/wrangler.jsonc`. È possibile impostare
`VITE_DESKTOP_APP_ORIGIN` in `.env.production.local` per una distribuzione
con altro dominio, che deve coincidere con l'origine autorizzata dal backend.
Non occorre allargare CORS, aggiungere origini loopback o modificare il Worker.
Cambiare origine crea uno storage locale diverso: esportare prima le copie
locali. I dati del browser e quelli dell'app desktop sono separati.

I dati cloud seguono le ACL e il protocollo durevole già esistenti.
IndexedDB mantiene le copie locali degli account, secondo i limiti della web
app. Ospite e temporanei usano sessionStorage: chiudere la finestra può
terminarne la conservazione, quindi esportarli per mantenerli.
L'interfaccia ospite si avvia offline; login e collaborazione richiedono rete.
Non è introdotta sincronizzazione bidirezionale automatica con cartelle locali.
Import usa il selettore file; download/export usa il dialog nativo di salvataggio.

## Aggiornamenti

Questa prima versione si aggiorna installando un nuovo Setup. Il frontend
incluso resta quello della build: un deploy del sito non aggiorna il desktop.
Gli aggiornamenti automatici non sono ancora attivi. Una release successiva
potrà aggiungere feed firmato, autoUpdater e controllo compatibilità backend.

## Verifiche

```powershell
pnpm test:desktop
pnpm desktop:build
pnpm test:desktop:e2e
```

La suite Electron avvia il vero main/preload/frontend e verifica isolamento,
guest offline/reload, richiesta OAuth esterna, nonce, scambio PKCE e annullamento.
La pipeline Windows esegue packaging e suite Electron. Restano da provare
manualmente l'installazione su un PC Windows pulito e il consenso OAuth reale.

Fonti: [Electron](https://www.electronjs.org/docs/latest/),
[Forge](https://www.electronforge.io/),
[protocol handler](https://www.electronjs.org/docs/latest/api/protocol),
[deep link](https://www.electronjs.org/docs/latest/tutorial/launch-app-from-url-in-another-app),
[Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
