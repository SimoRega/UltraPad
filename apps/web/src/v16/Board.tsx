import { useEffect, useRef, useState } from "react";
import { request } from "../api";
import { download } from "../files";
import type { FileRecord } from "../../../../packages/contracts/src/index";
type Item = {
  id: string;
  project_id: string;
  kind: "note" | "file" | "group" | "edge";
  body: string;
  file_id: string | null;
  x: number;
  y: number;
  color: string;
  source: string | null;
  target: string | null;
  version: number;
  group_id?: string | null;
};
export default function Board({
  projectId,
  files,
  editable,
  open,
}: {
  projectId: string;
  files: FileRecord[];
  editable: boolean;
  open: (id: string) => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [list, setList] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState("");
  const [edit, setEdit] = useState<Item>();
  const [busy, setBusy] = useState(false);
  const [edge, setEdge] = useState({ source: "", target: "" });
  const undo = useRef<{ before: Item | null; after: Item }[]>([]);
  async function load() {
    try {
      setItems(await request(`/projects/${projectId}/board`));
      setError("");
    } catch (e) {
      setItems([]);
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (!document.hidden && !edit && !busy) void load();
    }, 2500);
    return () => clearInterval(timer);
  }, [projectId, edit, busy]);
  function fresh(kind: Item["kind"]): Item {
    return {
      id: crypto.randomUUID(),
      project_id: projectId,
      kind,
      body: "",
      file_id: null,
      x: 40 + (items.length % 5) * 220,
      y: 40 + Math.floor(items.length / 5) * 160,
      color: "#fff2b3",
      source: null,
      target: null,
      version: 0,
    };
  }
  async function put(next: Item, record = true) {
    setBusy(true);
    try {
      const before = items.find((i) => i.id === next.id) ?? null;
      const result = await request<Item>("/collaborate", {
        op: "board_put",
        args: next,
      });
      if (record) undo.current.push({ before, after: result });
      setEdit(undefined);
      await load();
      return result;
    } catch (e) {
      setError(
        "Salvataggio non riuscito. Se un altro utente ha modificato la scheda, ricarica e riprova. " +
          (e as Error).message,
      );
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="board">
      <header>
        <h2>Lavagna del progetto</h2>
        <button aria-pressed={list} onClick={() => setList((v) => !v)}>
          {list ? "Vista lavagna" : "Vista elenco"}
        </button>
        <label>
          Zoom
          <input
            type="range"
            min="0.5"
            max="1.5"
            step="0.1"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>
        <button
          onClick={async () => {
            try {
              const versions = await request<unknown[]>(
                `/projects/${projectId}/board/checkpoints`,
              );
              download(
                "versioni-lavagna.json",
                JSON.stringify(versions, null, 2),
              );
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Esporta versioni
        </button>
        <button
          onClick={() =>
            download(
              "lavagna.json",
              JSON.stringify(
                { format: "ultrapad-board", version: 1, items },
                null,
                2,
              ),
            )
          }
        >
          Esporta lavagna
        </button>
        {editable && (
          <>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await request("/collaborate", {
                    op: "board_checkpoint",
                    args: {
                      project_id: projectId,
                      label: "Versione " + new Date().toLocaleString(),
                    },
                  });
                  setError("Versione della lavagna salvata.");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Salva versione lavagna
            </button>
            <button onClick={() => setEdit(fresh("note"))}>+ Nota</button>
            <button onClick={() => setEdit(fresh("file"))}>+ Documento</button>
            <button onClick={() => setEdit(fresh("group"))}>+ Gruppo</button>
            <button
              disabled={busy || !undo.current.length}
              onClick={async () => {
                const last = undo.current.at(-1);
                if (!last) return;
                if (last.before) {
                  const restored = await put(
                    { ...last.before, version: last.after.version },
                    false,
                  );
                  if (!restored) return;
                  const previous = undo.current
                    .slice(0, -1)
                    .reverse()
                    .find((entry) => entry.after.id === last.after.id);
                  if (previous)
                    previous.after = {
                      ...previous.after,
                      version: restored.version,
                    };
                } else {
                  try {
                    await request("/collaborate", {
                      op: "board_delete",
                      args: last.after,
                    });
                    await load();
                  } catch (e) {
                    setError((e as Error).message);
                    return;
                  }
                }
                undo.current.pop();
              }}
            >
              Annulla mia modifica
            </button>
          </>
        )}
      </header>
      {error && (
        <p role="alert">
          {error}
          <button onClick={() => void load()}>Ricarica</button>
        </p>
      )}
      {editable && (
        <form
          className="board-connect"
          onSubmit={(e) => {
            e.preventDefault();
            void put({ ...fresh("edge"), ...edge });
          }}
        >
          <label>
            Da
            <select
              required
              value={edge.source}
              onChange={(e) => setEdge({ ...edge, source: e.target.value })}
            >
              <option value="">Scheda…</option>
              {items
                .filter((i) => i.kind !== "edge")
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.body ||
                      files.find((f) => f.id === i.file_id)?.name ||
                      "Gruppo"}
                  </option>
                ))}
            </select>
          </label>
          <label>
            A
            <select
              required
              value={edge.target}
              onChange={(e) => setEdge({ ...edge, target: e.target.value })}
            >
              <option value="">Scheda…</option>
              {items
                .filter((i) => i.kind !== "edge")
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.body ||
                      files.find((f) => f.id === i.file_id)?.name ||
                      "Gruppo"}
                  </option>
                ))}
            </select>
          </label>
          <button disabled={busy}>Collega</button>
        </form>
      )}
      <div className={list ? "board-list" : "board-viewport"}>
        <div
          className={list ? "" : "board-canvas"}
          style={
            list
              ? {}
              : {
                  width: Math.max(1200, ...items.map((i) => i.x + 260)) * zoom,
                  height: Math.max(800, ...items.map((i) => i.y + 200)) * zoom,
                }
          }
        >
          {!list && (
            <svg className="board-lines" width="100%" height="100%">
              {items
                .filter((i) => i.kind === "edge")
                .map((i) => {
                  const s = items.find((n) => n.id === i.source),
                    t = items.find((n) => n.id === i.target);
                  return s && t ? (
                    <line
                      key={i.id}
                      x1={(s.x + 100) * zoom}
                      y1={(s.y + 50) * zoom}
                      x2={(t.x + 100) * zoom}
                      y2={(t.y + 50) * zoom}
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  ) : null;
                })}
            </svg>
          )}
          {items
            .filter((i) => i.kind !== "edge" || list)
            .map((i) => (
              <article
                key={i.id}
                className="board-card"
                style={
                  list
                    ? {}
                    : {
                        position: "absolute",
                        left: i.x * zoom,
                        top: i.y * zoom,
                        width: 200 * zoom,
                        background: i.color,
                        color: "#202430",
                      }
                }
              >
                <small>
                  {i.kind === "group"
                    ? "Gruppo"
                    : i.kind === "edge"
                      ? "Collegamento"
                      : i.kind === "file"
                        ? "Documento"
                        : "Nota"}
                </small>
                <p>{i.body}</p>
                {i.group_id && (
                  <small>
                    Gruppo: {items.find((g) => g.id === i.group_id)?.body}
                  </small>
                )}
                {i.file_id && (
                  <button onClick={() => open(i.file_id!)}>
                    {files.find((f) => f.id === i.file_id)?.name ??
                      "Documento non disponibile"}
                  </button>
                )}
                {i.kind === "edge" && (
                  <p>
                    {items.find((n) => n.id === i.source)?.body} →{" "}
                    {items.find((n) => n.id === i.target)?.body}
                  </p>
                )}
                {editable && (
                  <button onClick={() => setEdit(i)}>Modifica</button>
                )}
              </article>
            ))}
        </div>
      </div>
      {edit && (
        <form
          className="board-edit"
          onSubmit={(e) => {
            e.preventDefault();
            void put(edit);
          }}
        >
          <h3>Modifica scheda</h3>
          <label>
            Testo
            <textarea
              maxLength={4000}
              value={edit.body}
              onChange={(e) => setEdit({ ...edit, body: e.target.value })}
            />
          </label>
          {edit.kind === "file" && (
            <label>
              File
              <select
                required
                value={edit.file_id ?? ""}
                onChange={(e) => setEdit({ ...edit, file_id: e.target.value })}
              >
                <option value="">Scegli…</option>
                {files
                  .filter((f) => f.kind === "text")
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label>
            Gruppo
            <select
              value={edit.group_id ?? ""}
              onChange={(e) =>
                setEdit({ ...edit, group_id: e.target.value || null })
              }
            >
              <option value="">Nessuno</option>
              {items
                .filter((i) => i.kind === "group" && i.id !== edit.id)
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.body || "Gruppo"}
                  </option>
                ))}
            </select>
          </label>
          <label>
            X
            <input
              type="number"
              min="0"
              max="100000"
              value={edit.x}
              onChange={(e) => setEdit({ ...edit, x: Number(e.target.value) })}
            />
          </label>
          <label>
            Y
            <input
              type="number"
              min="0"
              max="100000"
              value={edit.y}
              onChange={(e) => setEdit({ ...edit, y: Number(e.target.value) })}
            />
          </label>
          <label>
            Colore
            <input
              type="color"
              value={edit.color}
              onChange={(e) => setEdit({ ...edit, color: e.target.value })}
            />
          </label>
          <button disabled={busy}>Salva</button>
          <button type="button" onClick={() => setEdit(undefined)}>
            Annulla
          </button>
        </form>
      )}
    </section>
  );
}
