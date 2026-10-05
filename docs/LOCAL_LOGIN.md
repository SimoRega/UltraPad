# Login locale con il progetto UltraPad

Progetto: `iqlxqzfivunyudfaxjlr`, regione Frankfurt.
URL base: `https://iqlxqzfivunyudfaxjlr.supabase.co`.
La Data API usa `/rest/v1/`, ma createClient deve ricevere l'URL base.
Il collegamento GitHub del repository non abilita il login GitHub degli utenti.
Al controllo iniziale la Publishable key era accettata, ma GitHub era
disabilitato; il proprietario ha poi confermato un login riuscito.
Se il login funziona già, non occorre riconfigurare OAuth.

## 1. Configurare i file sul PC

Da Supabase → Project Settings → API Keys copiare **Publishable key**
(`sb_publishable_...`), oppure la chiave legacy `anon`. Non copiare una
Secret key (`sb_secret_...`), service_role o la password del database.

Nella cartella UltraPad, PowerShell:

```powershell
# Solo se il terminale trova ancora i comandi della vecchia installazione NVM:
$env:Path = "C:\Program Files\nodejs;$env:APPDATA\npm;$env:Path"
pnpm.cmd install --frozen-lockfile
pnpm.cmd setup:local
```

La Publishable key fornita dal proprietario è già negli example: premere Invio
per usarla, oppure incollare una nuova chiave dopo una rotazione. La procedura configura `.env`
e `apps/api/.dev.vars` sullo stesso progetto e mantiene le altre impostazioni.
Questi file sono esclusi da Git. Eseguire da capo dopo aver scaricato una nuova
copia ZIP; non sovrascrivere vecchi file configurati con gli example.
Se esistono `.env.local` o `.env.development*`, verificarli: prevalgono su `.env`.

## 2. Applicare il database

Il collegamento del repo non garantisce l'esecuzione delle migrazioni.
Nel SQL Editor Supabase eseguire, in ordine, i tre file:

1. `supabase/migrations/202610050001_core.sql`
2. `supabase/migrations/202610050002_checkpoints.sql`
3. `supabase/migrations/202610050003_quotas.sql`

Se già applicati, non rieseguirli alla cieca: controllare lo storico migrazioni
e le tabelle. Dopo il primo login l'app mostra un workspace vuoto da creare;
non inserisce dati demo. Senza migrazioni il login può riuscire, ma workspace
e progetti restano indisponibili.

## 3. Configurare GitHub OAuth

Aprire https://github.com/settings/developers → OAuth Apps → New OAuth App:

| Campo | Valore |
|---|---|
| Application name | UltraPad Local |
| Homepage URL | `http://localhost:5173/` |
| Authorization callback URL | `https://iqlxqzfivunyudfaxjlr.supabase.co/auth/v1/callback` |

Generare Client Secret e copiare Client ID e Client Secret **solo** in Supabase
→ Authentication → Sign In / Providers → GitHub. Abilitare GitHub e salvare.
Il callback è ospitato da Supabase anche se il frontend gira in localhost.

In Authentication → URL Configuration:

| Campo | Valore |
|---|---|
| Site URL (development) | `http://localhost:5173/` |
| Redirect URLs | `http://localhost:5173/` |

L'app torna alla root con slash terminale. Usare `localhost:5173`, non
`127.0.0.1:5173`; host e porta devono coincidere con i redirect autorizzati. Per le API e i
WebSocket locali gli alias loopback sulla stessa porta sono accettati; questa
compatibilità non aggiunge automaticamente redirect OAuth a Supabase.
Quando si pubblica, aggiornare Site URL e aggiungere gli URL HTTPS previsti.

## 4. Verificare e avviare

```powershell
pnpm.cmd run doctor
pnpm.cmd dev
```

Doctor verifica i file, la coerenza del progetto/chiave e l'endpoint Auth,
inclusa l'abilitazione del provider GitHub. Non certifica i redirect, le
migrazioni o un login interattivo. Gli errori HTTP non stampano credenziali.

Aprire http://localhost:5173/ → Accedi con GitHub → autorizzare l'OAuth App.
Al ritorno l'interfaccia permette di creare workspace, progetto e file.
L'API deve restare in esecuzione su 127.0.0.1:8787 per usare l'app.
Se 5173 è occupata Vite si ferma: non cambia porta silenziosamente.
Per fermare i servizi: Ctrl+C.

## Se non funziona

- `403: ORIGIN` / origine della pagina non consentita: il backend ha rifiutato
  l'host della pagina prima dei permessi. Per development impostare
  `APP_ORIGIN=http://localhost:5173` in `apps/api/.dev.vars`, riavviare i servizi
  e aprire http://localhost:5173/. Il nuovo codice tollera lo slash finale e
  gli alias loopback locali sulla stessa porta. Domini esterni e porte diverse
  restano rifiutati. La risposta ORIGIN indica l'origine attesa.
- `403: FORBIDDEN` / operazione non consentita al ruolo: è un controllo ACL
  distinto da Origin. Usare il workspace corretto e un account con ruolo
  editor/admin richiesto. Non usare chiavi privilegiate per aggirare i ruoli.


- `Unsupported provider`: abilitare GitHub in Supabase Auth, non nelle
  integrazioni del repository.
- `Invalid API key`: ricopiare Publishable key dal progetto corretto con
  `pnpm.cmd setup:local`.
- Ritorno a localhost:3000 o altrove: correggere URL Configuration.
- Callback mismatch GitHub: callback completo Supabase, non localhost.
- Login riuscito, errore nel caricamento workspace: controllare le migrazioni
  e che API e frontend usino lo stesso URL e la stessa chiave pubblica.
- Connessione API fallita: il login usa Supabase, mentre workspace/progetti/file
  richiedono il Worker locale. Avviare `pnpm.cmd dev`, non solo `dev:web`.
  In un secondo terminale: `pnpm.cmd run doctor -- --api`.
  Verificare http://127.0.0.1:8787/health e http://localhost:5173/api/health.
  Entrambi devono restituire `service: ultrapad` e `configured: true`.
  Se il primo fallisce, controllare l'errore nel terminale `[0]` API;
  se solo il secondo fallisce, riavviare Vite con il nuovo codice/configurazione.
  Durante development richieste HTTP e WebSocket passano da `/api` sul server
  Vite, che inoltra verso IPv4. In produzione serve l'URL HTTPS del Worker.
  I vecchi URL locali in `.env` sono gestiti dal proxy, senza cambiare Supabase.
  Dopo il riavvio premere Riprova o ricaricare la pagina. Le mutazioni fallite
  non vengono ripetute automaticamente, per evitare duplicazioni.
- Errore PKCE: avviare il login e completarlo nello stesso browser/profilo
  e sulla stessa origine; riprovare un nuovo login senza riutilizzare callback.

Non è stato effettuato un login sul progetto remoto durante questo aggiornamento:
le impostazioni OAuth e le credenziali di un utente non erano disponibili.
La verifica Auth non equivale a una sessione OAuth interattiva. I test browser
usano fixture isolate, mai autenticazione fittizia nel prodotto.

Fonti ufficiali:
https://supabase.com/docs/guides/auth/social-login/auth-github
https://supabase.com/docs/guides/auth/redirect-urls
https://supabase.com/docs/guides/getting-started/api-keys
