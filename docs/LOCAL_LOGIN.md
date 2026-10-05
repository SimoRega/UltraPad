# Login locale con il progetto UltraPad

Progetto: `iqlxqzfivunyudfaxjlr`, regione Frankfurt.
URL base: `https://iqlxqzfivunyudfaxjlr.supabase.co`.
La Data API usa `/rest/v1/`, ma createClient deve ricevere l'URL base.
Il collegamento GitHub del repository non abilita il login GitHub degli utenti.
Al controllo dal progetto reale la Publishable key è stata accettata, ma
GitHub risultava disabilitato come provider Auth. Eseguire il punto 3.

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
`127.0.0.1:5173`; host e porta devono coincidere con i redirect autorizzati.
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
L'API deve restare in esecuzione su localhost:8787 per usare l'app.
Se 5173 è occupata Vite si ferma: non cambia porta silenziosamente.
Per fermare i servizi: Ctrl+C.

## Se non funziona

- `Unsupported provider`: abilitare GitHub in Supabase Auth, non nelle
  integrazioni del repository.
- `Invalid API key`: ricopiare Publishable key dal progetto corretto con
  `pnpm.cmd setup:local`.
- Ritorno a localhost:3000 o altrove: correggere URL Configuration.
- Callback mismatch GitHub: callback completo Supabase, non localhost.
- Login riuscito, errore nel caricamento workspace: controllare le migrazioni
  e che API e frontend usino lo stesso URL e la stessa chiave pubblica.
- Connessione API fallita: controllare il terminale dev:api e localhost:8787/health.
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
