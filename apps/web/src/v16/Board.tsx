import { useEffect, useRef, useState, type PointerEvent } from "react";
import { request } from "../api";
import { download } from "../files";
import type { FileRecord } from "../../../../packages/contracts/src/index";
import {
  appendPoint,
  coordinate,
  drawingPath,
  finishDrawing,
  readDrawing,
  type Point,
} from "./boardDrawing";
type Item = {
  id: string;
  project_id: string;
  kind: "note" | "file" | "group" | "edge" | "stroke";
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
  const [tool, setTool] = useState<"select" | "brush">("select");
  const [brushColor, setBrushColor] = useState("#5269dc");
  const [brushWidth, setBrushWidth] = useState(4);
  type Gesture = {
    pointer: number;
    start: Point;
    before?: Item;
    points: Point[];
  };
  const gesture = useRef<Gesture | null>(null);
  const [preview, setPreview] = useState<Item>();
  const [pending, setPending] = useState<Item>();
  const canvas = useRef<HTMLDivElement>(null);
  const project = useRef(projectId);
  const loadSequence = useRef(0);
  const blocked = useRef(false);
  project.current = projectId;
  blocked.current = busy || !!edit || !!pending;
  const undo = useRef<{ before: Item | null; after: Item }[]>([]);
  async function load() {
    const sequence = ++loadSequence.current;
    try {
      const result = await request<Item[]>(`/projects/${projectId}/board`);
      if (
        project.current !== projectId ||
        sequence !== loadSequence.current ||
        gesture.current
      )
        return;
      setItems(result);
      setError("");
    } catch (e) {
      if (project.current !== projectId || sequence !== loadSequence.current)
        return;
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    setItems([]);
    setPreview(undefined);
    setPending(undefined);
    setEdit(undefined);
    gesture.current = null;
    undo.current = [];
    void load();
    const timer = setInterval(() => {
      if (!document.hidden && !blocked.current && !gesture.current) void load();
    }, 2500);
    return () => {
      clearInterval(timer);
      ++loadSequence.current;
    };
  }, [projectId]);
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
    if (!editable || (blocked.current && busy)) return;
    blocked.current = true;
    ++loadSequence.current;
    setBusy(true);
    try {
      const before = items.find((i) => i.id === next.id) ?? null;
      const result = await request<Item>("/collaborate", {
        op: "board_put",
        args: next,
      });
      if (project.current !== projectId) return;
      if (record) undo.current.push({ before, after: result });
      setEdit(undefined);
      setPending(undefined);
      setPreview(undefined);
      setItems((old) => [...old.filter((i) => i.id !== result.id), result]);
      await load();
      return result;
    } catch (e) {
      if (project.current !== projectId) return;
      setError(
        "Salvataggio non riuscito. Se un altro utente ha modificato la scheda, ricarica e riprova. " +
          (e as Error).message,
      );
      return undefined;
    } finally {
      if (project.current === projectId) setBusy(false);
    }
  }
  function point(e: PointerEvent): Point {
    const rect = canvas.current!.getBoundingClientRect();
    return [
      coordinate((e.clientX - rect.left) / zoom),
      coordinate((e.clientY - rect.top) / zoom),
    ];
  }
  function begin(e: PointerEvent, item?: Item) {
    if (
      !editable ||
      list ||
      blocked.current ||
      gesture.current ||
      e.button !== 0 ||
      !e.isPrimary
    )
      return;
    if (tool === "select" && (!item || item.kind === "edge")) return;
    if ((e.target as Element).closest("button,input,select,textarea,a")) return;
    e.preventDefault();
    e.stopPropagation();
    const start = point(e);
    gesture.current = {
      pointer: e.pointerId,
      start,
      before: tool === "select" ? item : undefined,
      points: [start],
    };
    ++loadSequence.current;
    canvas.current!.focus({ preventScroll: true });
    canvas.current!.setPointerCapture(e.pointerId);
    setPreview(
      tool === "select"
        ? item
        : {
            ...fresh("stroke"),
            ...finishDrawing([start], brushWidth),
            color: brushColor,
          },
    );
  }
  function move(e: PointerEvent) {
    const g = gesture.current;
    if (!g || g.pointer !== e.pointerId) return;
    const next = point(e);
    if (g.before) {
      setPreview({
        ...g.before,
        x: coordinate(g.before.x + next[0] - g.start[0]),
        y: coordinate(g.before.y + next[1] - g.start[1]),
      });
    } else {
      g.points = appendPoint(g.points, next);
      setPreview(
        (old) => old && { ...old, ...finishDrawing(g.points, brushWidth) },
      );
    }
  }
  function cancel() {
    if (!gesture.current) return;
    gesture.current = null;
    setPreview(undefined);
  }
  function end(e: PointerEvent) {
    const g = gesture.current;
    if (!g || g.pointer !== e.pointerId) return;
    const nextPoint = point(e);
    const next = g.before
      ? {
          ...g.before,
          x: coordinate(g.before.x + nextPoint[0] - g.start[0]),
          y: coordinate(g.before.y + nextPoint[1] - g.start[1]),
        }
      : preview && {
          ...preview,
          ...finishDrawing(appendPoint(g.points, nextPoint, true), brushWidth),
        };
    gesture.current = null;
    if (canvas.current?.hasPointerCapture(e.pointerId))
      canvas.current.releasePointerCapture(e.pointerId);
    if (!next || (g.before && next.x === g.before.x && next.y === g.before.y)) {
      setPreview(undefined);
      return;
    }
    setPending(next);
    setPreview(next);
    void put(next);
  }
  const visible = preview
    ? [...items.filter((i) => i.id !== preview.id), preview]
    : items;
  const extent = (item: Item, axis: 0 | 1) => {
    const drawing = item.kind === "stroke" && readDrawing(item.body);
    return (
      (axis === 0 ? item.x : item.y) +
      (drawing
        ? Math.max(...drawing.points.map((p) => p[axis])) + drawing.width
        : axis === 0
          ? 260
          : 200)
    );
  };
  return (
    <section className="board">
      <header>
        <h2>Lavagna del progetto</h2>
        <button
          disabled={busy || !!pending}
          aria-pressed={list}
          onClick={() => setList((v) => !v)}
        >
          {list ? "Vista lavagna" : "Vista elenco"}
        </button>
        {editable && !list && (
          <>
            <button
              disabled={busy || !!pending}
              aria-pressed={tool === "select"}
              onClick={() => setTool("select")}
            >
              Seleziona / sposta
            </button>
            <button
              disabled={busy || !!pending}
              aria-pressed={tool === "brush"}
              onClick={() => setTool("brush")}
            >
              Pennello
            </button>
            <label>
              Colore pennello
              <input
                type="color"
                value={brushColor}
                disabled={busy || !!pending}
                onChange={(e) => setBrushColor(e.target.value)}
              />
            </label>
            <label>
              Spessore pennello
              <input
                type="range"
                min="1"
                max="32"
                value={brushWidth}
                disabled={busy || !!pending}
                onChange={(e) => setBrushWidth(Number(e.target.value))}
              />
              {brushWidth} px
            </label>
          </>
        )}
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
              disabled={busy || !!pending}
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
            <button
              disabled={busy || !!pending}
              onClick={() => setEdit(fresh("note"))}
            >
              + Nota
            </button>
            <button
              disabled={busy || !!pending}
              onClick={() => setEdit(fresh("file"))}
            >
              + Documento
            </button>
            <button
              disabled={busy || !!pending}
              onClick={() => setEdit(fresh("group"))}
            >
              + Gruppo
            </button>
            <button
              disabled={busy || !!pending || !undo.current.length}
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
                  setBusy(true);
                  try {
                    await request("/collaborate", {
                      op: "board_delete",
                      args: last.after,
                    });
                    await load();
                  } catch (e) {
                    setError((e as Error).message);
                    return;
                  } finally {
                    setBusy(false);
                  }
                }
                undo.current.pop();
                setItems((old) => [...old]);
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
                    {(i.kind === "stroke" ? "Disegno" : i.body) ||
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
                    {(i.kind === "stroke" ? "Disegno" : i.body) ||
                      files.find((f) => f.id === i.file_id)?.name ||
                      "Gruppo"}
                  </option>
                ))}
            </select>
          </label>
          <button disabled={busy || !!pending}>Collega</button>
        </form>
      )}
      {pending && (
        <p role="status">
          Modifica non ancora confermata dal server.
          <button disabled={busy} onClick={() => void put(pending)}>
            Riprova salvataggio
          </button>
          <button
            disabled={busy}
            onClick={() => {
              setPending(undefined);
              setPreview(undefined);
              void load();
            }}
          >
            Scarta modifica locale
          </button>
        </p>
      )}
      {!list && (
        <p className="muted">
          {!editable
            ? "Lavagna in sola lettura."
            : tool === "brush"
              ? "Trascina per disegnare. Escape annulla il tratto in corso."
              : "Trascina le schede o i tratti per spostarli. Usa Modifica per le coordinate."}
        </p>
      )}
      <div className={list ? "board-list" : "board-viewport"}>
        <div
          ref={canvas}
          className={
            list
              ? ""
              : `board-canvas board-tool-${editable ? tool : "readonly"}`
          }
          tabIndex={list ? undefined : 0}
          aria-label="Area lavagna"
          onPointerDown={(e) => begin(e)}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={cancel}
          onLostPointerCapture={() => {
            if (gesture.current) cancel();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") cancel();
          }}
          style={
            list
              ? {}
              : {
                  width:
                    Math.max(1200, ...visible.map((i) => extent(i, 0))) * zoom,
                  height:
                    Math.max(800, ...visible.map((i) => extent(i, 1))) * zoom,
                }
          }
        >
          {!list && (
            <svg className="board-lines" width="100%" height="100%">
              {visible
                .filter((i) => i.kind === "edge")
                .map((i) => {
                  const s = visible.find((n) => n.id === i.source),
                    t = visible.find((n) => n.id === i.target);
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
          {!list && (
            <svg className="board-strokes" width="100%" height="100%">
              {visible
                .filter((i) => i.kind === "stroke")
                .map((i) => {
                  const d = readDrawing(i.body);
                  return d ? (
                    <path
                      key={i.id}
                      data-stroke-id={i.id}
                      d={drawingPath(d.points)}
                      transform={`translate(${i.x * zoom} ${i.y * zoom}) scale(${zoom})`}
                      fill="none"
                      stroke={i.color}
                      strokeWidth={d.width}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      onPointerDown={(e) => begin(e, i)}
                    />
                  ) : null;
                })}
            </svg>
          )}
          {visible
            .filter((i) => list || (i.kind !== "edge" && i.kind !== "stroke"))
            .map((i) => (
              <article
                key={i.id}
                className="board-card"
                data-item-id={i.id}
                onPointerDown={(e) => begin(e, i)}
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
                  {i.kind === "stroke"
                    ? "Disegno a mano libera"
                    : i.kind === "group"
                      ? "Gruppo"
                      : i.kind === "edge"
                        ? "Collegamento"
                        : i.kind === "file"
                          ? "Documento"
                          : "Nota"}
                </small>
                {i.kind === "stroke" ? (
                  <svg
                    width="200"
                    height="100"
                    viewBox={`0 0 ${Math.max(1, extent(i, 0) - i.x)} ${Math.max(1, extent(i, 1) - i.y)}`}
                    aria-label="Anteprima disegno"
                  >
                    {(() => {
                      const d = readDrawing(i.body);
                      return d ? (
                        <path
                          d={drawingPath(d.points)}
                          fill="none"
                          stroke={i.color}
                          strokeWidth={d.width}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      ) : null;
                    })()}
                  </svg>
                ) : (
                  <p>{i.body}</p>
                )}
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
                  <button
                    disabled={busy || !!pending}
                    onClick={() => setEdit(i)}
                  >
                    Modifica
                  </button>
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
          {edit.kind !== "stroke" && (
            <label>
              Testo
              <textarea
                maxLength={4000}
                value={edit.body}
                onChange={(e) => setEdit({ ...edit, body: e.target.value })}
              />
            </label>
          )}
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
          <button disabled={busy || !!pending}>Salva</button>
          <button type="button" onClick={() => setEdit(undefined)}>
            Annulla
          </button>
        </form>
      )}
    </section>
  );
}
