import { useEffect, useState } from "react";
import * as Y from "yjs";
import { request } from "../api";
import { Modal } from "../Dialogs";
import { encodeAnchor } from "./anchors";
import type { FileRecord } from "../../../../packages/contracts/src/index";
import type { SelectionAnchor } from "./Discussion";
type Link = {
  id: string;
  source_id: string;
  target_id: string;
  label: string;
  anchor?: SelectionAnchor;
  target_anchor?: SelectionAnchor;
  source: Pick<FileRecord, "id" | "name" | "project_id">;
  target: Pick<FileRecord, "id" | "name" | "project_id">;
};
export default function Links({
  file,
  files,
  editable,
  close,
  open,
  anchor,
}: {
  file: FileRecord;
  files: FileRecord[];
  editable: boolean;
  close: () => void;
  open: (
    file: Pick<FileRecord, "id" | "project_id">,
    anchor?: SelectionAnchor,
  ) => void;
  anchor?: SelectionAnchor;
}) {
  const [rows, setRows] = useState<Link[]>([]);
  const [target, setTarget] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sections, setSections] = useState<
    { label: string; anchor: SelectionAnchor }[]
  >([]);
  const [section, setSection] = useState("");
  const [filter, setFilter] = useState("");
  async function load() {
    try {
      setRows(await request(`/files/${file.id}/links`));
    } catch (e) {
      setRows([]);
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, [file.id]);
  useEffect(() => {
    let active = true;
    setSections([]);
    setSection("");
    if (target)
      void request<{ text: string; payload: number[]; generation: number }>(
        `/files/${target}/snapshot`,
      )
        .then((s) => {
          const d = new Y.Doc();
          try {
            Y.applyUpdate(d, new Uint8Array(s.payload));
            const headings = [
              ...s.text.matchAll(
                /^(?:#{1,6}\s+(.+)|\\(?:chapter|section|subsection)\{([^}]+)\})/gm,
              ),
            ].map((m) => ({
              label: m[1] || m[2],
              anchor: encodeAnchor(
                d,
                m.index!,
                m.index! + m[0].length,
                s.generation,
              ),
            }));
            let at = 0;
            for (const op of d.getText("content").toDelta()) {
              if (op.attributes?.header) {
                const from = s.text.lastIndexOf("\n", Math.max(0, at - 1)) + 1;
                headings.push({
                  label: s.text.slice(from, at),
                  anchor: encodeAnchor(d, from, at, s.generation),
                });
              }
              at += typeof op.insert === "string" ? op.insert.length : 1;
            }
            if (active) setSections(headings);
          } finally {
            d.destroy();
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [target]);
  return (
    <Modal title="Collegamenti e citazioni" close={close}>
      <h3>Collega a</h3>
      {rows
        .filter((l) => l.source_id === file.id)
        .map((l) => (
          <button
            key={l.id}
            onClick={() => {
              close();
              open(
                l.target,
                l.target_anchor?.start ? l.target_anchor : undefined,
              );
            }}
          >
            {l.label} · {l.target.name}
          </button>
        ))}
      <h3>Citato da</h3>
      {rows
        .filter((l) => l.target_id === file.id)
        .map((l) => (
          <button
            key={l.id}
            onClick={() => {
              close();
              open(l.source, l.anchor?.start ? l.anchor : undefined);
            }}
          >
            {l.source.name}
          </button>
        ))}
      {editable && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            void request("/collaborate", {
              op: "link",
              args: {
                file_id: file.id,
                target_id: target,
                label: label || files.find((f) => f.id === target)?.name,
                anchor,
                target_anchor: section ? sections[Number(section)]?.anchor : {},
              },
            })
              .then(() => load())
              .catch((e) => setError(e.message))
              .finally(() => setBusy(false));
          }}
        >
          <label>
            Cerca documento
            <input value={filter} onChange={(e) => setFilter(e.target.value)} />
          </label>
          <label>
            Documento
            <select
              required
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="">Scegli…</option>
              {files
                .filter(
                  (f) =>
                    f.kind === "text" &&
                    f.id !== file.id &&
                    f.name.toLowerCase().includes(filter.toLowerCase()),
                )
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Sezione
            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
            >
              <option value="">Intero documento</option>
              {sections.map((s, i) => (
                <option key={i} value={i}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Etichetta
            <input
              maxLength={120}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <p>
            Riferimenti tramite ID e ancore CRDT. Una sezione eliminata o
            ripristinata è segnalata come non disponibile.
          </p>
          <button disabled={busy}>Aggiungi collegamento</button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </Modal>
  );
}
