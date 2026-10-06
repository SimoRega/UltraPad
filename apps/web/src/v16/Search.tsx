import { useEffect, useState } from "react";
import { request } from "../api";
import { Modal } from "../Dialogs";
import type { FileRecord } from "../../../../packages/contracts/src/index";
export default function Search({
  close,
  open,
  projects,
  workspaces,
  commands,
}: {
  close: () => void;
  open: (f: FileRecord, query: string) => void;
  projects: { id: string; name: string; workspace_id: string }[];
  workspaces: { id: string; name: string }[];
  commands: { label: string; run: () => void }[];
}) {
  const [topic, setTopic] = useState("");
  const [author, setAuthor] = useState("");
  const [since, setSince] = useState("");
  const [reindex, setReindex] = useState(false);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<
    (FileRecord & { excerpt?: string; indexed_at?: string })[]
  >([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [workspace, setWorkspace] = useState("");
  const [format, setFormat] = useState("");
  useEffect(() => {
    let active = true;
    setRows([]);
    setLoading(true);
    const timer = setTimeout(() => {
      void request<typeof rows>(
        `/search?q=${encodeURIComponent(q)}&offset=${offset}&format=${encodeURIComponent(format)}${workspace ? "&workspace=" + workspace : ""}&topic=${encodeURIComponent(topic)}${author ? "&author=" + encodeURIComponent(author) : ""}${since ? "&since=" + encodeURIComponent(new Date(since).toISOString()) : ""}`,
      )
        .then((r) => {
          if (active) {
            setRows(r);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [q, offset, workspace, format, topic, author, since, reindex]);
  return (
    <Modal title="Cerca e vai · Ctrl/⌘ K" close={close}>
      <input
        autoFocus
        aria-label="Ricerca globale"
        placeholder="Nome, frase o azione…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOffset(0);
        }}
      />
      <div className="search-filters">
        <label>
          Workspace
          <select
            value={workspace}
            onChange={(e) => {
              setWorkspace(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">Tutti</option>
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Formato
          <input
            value={format}
            placeholder="md, txt…"
            onChange={(e) => {
              setFormat(e.target.value);
              setOffset(0);
            }}
          />
        </label>
        <label>
          Tema
          <input
            value={topic}
            onChange={(e) => {
              setTopic(e.target.value);
              setOffset(0);
            }}
          />
        </label>
        <label>
          Autore (ID)
          <input
            value={author}
            onChange={(e) => {
              setAuthor(e.target.value);
              setOffset(0);
            }}
          />
        </label>
        <label>
          Modificato da
          <input
            type="date"
            value={since}
            onChange={(e) => {
              setSince(e.target.value);
              setOffset(0);
            }}
          />
        </label>
      </div>
      <button
        disabled={reindex}
        onClick={async () => {
          setReindex(true);
          try {
            let offset: number | null = 0;
            do {
              const r: { next: number | null } = await request(
                "/search/reindex",
                { offset },
              );
              offset = r.next;
            } while (offset !== null);
            setError("");
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setReindex(false);
          }
        }}
      >
        {reindex
          ? "Ricostruzione indice…"
          : "Indicizza copie server modificabili"}
      </button>
      <p className="muted">
        I contenuti sono indicizzati dopo il salvataggio; gli estratti possono
        essere in ritardo.
      </p>
      <nav aria-label="Azioni rapide">
        {commands
          .filter((c) => c.label.toLowerCase().includes(q.toLowerCase()))
          .map((c) => (
            <button
              key={c.label}
              onClick={() => {
                close();
                c.run();
              }}
            >
              {c.label}
            </button>
          ))}
      </nav>
      {loading && <p role="status">Ricerca…</p>}
      {error && <p role="alert">{error}</p>}
      <div className="search-results">
        {rows.map((f) => {
          const p = projects.find((p) => p.id === f.project_id);
          return (
            <button
              key={f.id}
              onClick={() => {
                close();
                open(f, q);
              }}
            >
              <strong>{f.name}</strong>
              <small>
                {workspaces.find((w) => w.id === p?.workspace_id)?.name} /{" "}
                {p?.name}
              </small>
              {f.excerpt && (
                <p>
                  {q && f.excerpt.toLowerCase().includes(q.toLowerCase())
                    ? (() => {
                        const i = f
                          .excerpt!.toLowerCase()
                          .indexOf(q.toLowerCase());
                        return (
                          <>
                            {f.excerpt!.slice(0, i)}
                            <mark>{f.excerpt!.slice(i, i + q.length)}</mark>
                            {f.excerpt!.slice(i + q.length)}
                          </>
                        );
                      })()
                    : f.excerpt}
                </p>
              )}
            </button>
          );
        })}
      </div>
      {!loading && !error && !rows.length && <p>Nessun file trovato.</p>}
      <div className="dialog-actions">
        <button
          disabled={!offset}
          onClick={() => setOffset((v) => Math.max(0, v - 50))}
        >
          Precedenti
        </button>
        <button
          disabled={rows.length < 50}
          onClick={() => setOffset((v) => v + 50)}
        >
          Successivi
        </button>
      </div>
    </Modal>
  );
}
