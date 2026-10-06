import { useEffect, useState, useRef } from "react";
import type { FileRecord } from "../../../../packages/contracts/src/index";
import { request } from "../api";
import { codeCells } from "../../../api/src/execution";
type Result = {
  stdout: string;
  stderr?: string;
  error?: string;
  exitCode: number;
  runtime?: string;
  pdf?: string;
  revisions: {
    id: string;
    name: string;
    generation: number;
    serverSeq: number;
  }[];
};
export default function Execution({
  id,
  name,
  text,
  files,
  open,
}: {
  id: string;
  name: string;
  text: string;
  files: FileRecord[];
  open?: (file: FileRecord, line: number) => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>();
  const [error, setError] = useState("");
  const [pdf, setPdf] = useState("");
  const [stale, setStale] = useState(false);
  const job = useRef<string | undefined>(undefined);
  const run = useRef(0);
  const latex = /\.tex$/i.test(name);
  const cells = codeCells(text);
  useEffect(() => {
    void request<{ enabled: boolean }>("/execution/capabilities")
      .then((r) => setEnabled(r.enabled))
      .catch(() => setEnabled(false));
  }, []);
  useEffect(() => {
    if (result) setStale(true);
  }, [text]);
  useEffect(() => {
    if (!result?.pdf) {
      setPdf("");
      return;
    }
    const bytes = Uint8Array.from(atob(result.pdf), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(
      new Blob([bytes], { type: "application/pdf" }),
    );
    setPdf(url);
    return () => URL.revokeObjectURL(url);
  }, [result]);
  async function start(cell?: number) {
    const serial = ++run.current;
    job.current = crypto.randomUUID();
    setBusy(true);
    setError("");
    setResult(undefined);
    try {
      const value = await request<Result>(`/files/${id}/execute`, {
        kind: latex ? "latex" : "code",
        cell,
        jobId: job.current,
      });
      if (run.current === serial) {
        setResult(value);
        setStale(false);
      }
    } catch (e) {
      if (run.current === serial) setError((e as Error).message);
    } finally {
      if (run.current === serial) setBusy(false);
    }
  }
  if (!latex && !cells.length) return null;
  return (
    <aside className="execution-panel">
      <h3>{latex ? "Compilazione PDF" : "Notebook · celle di codice"}</h3>
      <p>
        Limiti: codice 10 s / 32 KiB; LaTeX 60 s / 30 file / 1 MiB; memoria 256
        MiB; output testo 64 KiB, PDF 4 MiB. Elaborazione di una copia salvata
        sul server. Salva e attendi la sincronizzazione prima di avviare.
      </p>
      {!enabled ? (
        <p>
          Il servizio isolato non è configurato. Puoi modificare ed esportare il
          sorgente.
        </p>
      ) : latex ? (
        <button disabled={busy} onClick={() => void start()}>
          Compila PDF con bibliografia
        </button>
      ) : (
        cells.map((cell, i) => (
          <section key={i}>
            <pre>{cell.code}</pre>
            <button disabled={busy} onClick={() => void start(i)}>
              Esegui cella {i + 1} · {cell.language}
            </button>
          </section>
        ))
      )}
      {busy && (
        <p role="status">
          Elaborazione…{" "}
          <button
            onClick={() => {
              run.current++;
              setBusy(false);
              void request("/execution/cancel", { jobId: job.current })
                .then(() =>
                  setError("Interruzione richiesta al servizio isolato."),
                )
                .catch(() =>
                  setError(
                    "Servizio non raggiungibile: il limite di tempo interromperà il processo.",
                  ),
                );
            }}
          >
            Annulla attesa
          </button>
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {result && (
        <>
          <p>
            {stale ? "Il documento è cambiato dopo l’avvio. " : ""}Revisioni:{" "}
            {result.revisions
              .map((r) => `${r.name} · ${r.generation}:${r.serverSeq}`)
              .join(", ")}
          </p>
          {result.error && <p role="alert">{result.error}</p>}
          {latex &&
            [
              ...result.stdout.matchAll(
                /(?:^|\n)([a-zA-Z0-9_-]+\.tex):(\d+):([^\n]*)/g,
              ),
            ].map((m, i) => (
              <button
                key={i}
                onClick={() => {
                  const file = files.find((f) => f.name === m[1]);
                  if (file) open?.(file, Number(m[2]));
                }}
              >
                {m[1]}:{m[2]} · {m[3]}
              </button>
            ))}
          <pre>
            {result.stdout}
            {result.stderr}
          </pre>
          <p>Runtime: {result.runtime ?? "servizio isolato"}</p>
          <p>Codice di uscita: {result.exitCode}</p>
          {pdf && (
            <>
              <a href={pdf} download={name.replace(/\.tex$/i, ".pdf")}>
                Scarica PDF
              </a>
              <iframe title="PDF compilato" src={pdf} />
            </>
          )}
        </>
      )}
    </aside>
  );
}
