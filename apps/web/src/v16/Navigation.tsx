import FileIcon from '../FileIcon';
import { useEffect, useState } from "react";
import { request } from "../api";
import type { FileRecord } from "../../../../packages/contracts/src/index";
type Preference = { favorite: boolean; opened_at: string; file: FileRecord };
export default function Navigation({
  current,
  open,
}: {
  current?: FileRecord;
  open: (f: FileRecord) => void;
}) {
  const [rows, setRows] = useState<Preference[]>([]);
  const [error, setError] = useState("");
  async function load() {
    try {
      setRows(await request("/navigation"));
      setError("");
    } catch (e) {
      setRows([]);
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void (async () => {
      if (current)
        try {
          await request("/navigation", { file_id: current.id });
        } catch {}
      await load();
    })();
  }, [current?.id, current?.generation]);
  const favorite = rows.some((r) => r.file.id === current?.id && r.favorite);
  return (
    <section className="personal-navigation" aria-label="Navigazione personale">
      {current && (
        <button
          aria-pressed={favorite}
          onClick={async () => {
            try {
              await request("/navigation", {
                file_id: current.id,
                favorite: !favorite,
              });
              await load();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          {favorite ? "★ Rimuovi preferito" : "☆ Preferito"}
        </button>
      )}
      <details>
        <summary>Preferiti e recenti</summary>
        {rows
          .sort((a, b) => Number(b.favorite) - Number(a.favorite))
          .map((r) => (
            <button
              key={r.file.id}
              title={r.file.project_id}
              onClick={() => open(r.file)}
            >
              {r.favorite ? "★ " : "◷ "}
              <FileIcon name={r.file.name} kind={r.file.kind}/>{r.file.name}
            </button>
          ))}
        {!rows.length && <p>Nessun file visitato.</p>}
      </details>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
