# Dipendenze fissate e riferimenti

Versioni effettive in package.json e pnpm-lock.yaml. Installazione congelata in CI.

| Pacchetto | Versione |
|---|---|
| @supabase/supabase-js | 2.117.2 |
| @tanstack/react-query | 5.104.1 |
| hono | 4.13.13 |
| idb | 8.0.3 |
| jszip | 3.10.2 |
| monaco-editor | 0.57.0 |
| quill | 2.0.3 |
| y-quill | 1.0.0 |
| quill-cursors | 4.0.4 |
| react | 19.3.0 |
| react-dom | 19.3.0 |
| react-router-dom | 7.18.4 |
| y-monaco | 0.1.6 |
| y-protocols | 1.0.7 |
| yjs | 13.6.33 |
| zod | 4.6.5 |

Tooling: Vitest 4.1.11 con pool Cloudflare 0.22.0 (compatibilità Vitest 4), Vite 8, Node 24, pnpm 11.25.0. Monaco 0.57 usa exports pubblici; y-monaco 0.1.6 importa un path legacy e viene risolto tramite alias Vite. Monaco viene montato direttamente tramite la sua API per evitare il race del prebundling del wrapper React in development. Questo adapter è coperto da build ed E2E.

Override transitive fissati: shell-quote 1.9.0, undici 7.29.1, sharp 0.35.4, DOMPurify 3.4.16, per risolvere gli advisory disponibili al controllo. Rieseguire audit prima di nuove release.

## Licenze principali

React, Vite, Hono, Supabase JS, TanStack Query, Monaco, y-monaco, Yjs/y-protocols, idb, JSZip e Zod: MIT. Verificare licenze complete delle dipendenze transitive nel lock e nei package installati prima della distribuzione. Nessun tldraw, runner o SDK commerciale è introdotto.

## Documentazione ufficiale consultata

- https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/
- https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- https://developers.cloudflare.com/workers/testing/vitest-integration/configuration/
- https://supabase.com/docs/reference/javascript/auth-getclaims
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://microsoft.github.io/monaco-editor/
- https://github.com/yjs/y-monaco

Queste fonti sono state verificate durante implementazione. Le versioni sono state poi validate con installazione, typecheck, build e test reali locali; nessuna quota remota è stata certificata.

Editor visuale: Quill (BSD-3-Clause), y-quill e quill-cursors (MIT). Versione cursori 4.0.4 compatibile con il peer di y-quill. Riferimenti: https://quilljs.com/docs/api e https://github.com/yjs/y-quill.

## Audit produzione v1.2

`pnpm audit --prod` rileva 1 advisory low su Quill 2.0.3: GHSA-v3m3-f69x-jf25 / CVE-2025-15056, export HTML, nessuna versione corretta indicata dall’advisory al controllo. UltraPad non chiama `getSemanticHTML()` e non usa l’export HTML di Quill: `richHtml()` valida il delta, limita gli attributi ed escapa titolo/testo. Test di regressione includono payload HTML/eseguibili. Non ignorare globalmente l’advisory; monitorare aggiornamenti. Riferimento: https://github.com/advisories/GHSA-v3m3-f69x-jf25.
# Dipendenze desktop

Electron 44.5.1, Electron Forge CLI/maker-squirrel/maker-zip 8.0.1, MIT,
versioni fissate nel workspace e lockfile. Verificate con registry ufficiale
durante questa implementazione. Electron include Chromium/Node, con licenze
distribuite dal pacchetto; gli asset frontend mantengono le licenze esistenti.
Forge e dipendenze build non vengono inclusi nel pacchetto applicativo.
Riferimenti ufficiali in docs/DESKTOP.md; comandi runtime/build in package.json.
