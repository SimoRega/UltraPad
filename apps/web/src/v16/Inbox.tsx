import { useEffect, useState } from "react";
import { request } from "../api";
import { Modal } from "../Dialogs";
type Mention = {
  comment_id: string;
  read_at: string | null;
  comments: {
    body: string;
    comment_threads: { file_id: string; anchor: unknown };
  };
};
export default function Inbox({
  close,
  open,
}: {
  close: () => void;
  open: (id: string) => void;
}) {
  const [rows, setRows] = useState<Mention[]>([]);
  const [error, setError] = useState("");
  async function load() {
    try {
      setRows(await request("/inbox"));
    } catch (e) {
      setRows([]);
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <Modal title="Menzioni" close={close}>
      {error && <p role="alert">{error}</p>}
      {rows.map((r) => (
        <article key={r.comment_id}>
          <p>{r.comments.body}</p>
          <button
            onClick={() => {
              open(r.comments.comment_threads.file_id);
              close();
            }}
          >
            Apri documento
          </button>
          <button
            disabled={Boolean(r.read_at)}
            onClick={async () => {
              try {
                await request("/inbox/read", { id: r.comment_id });
                await load();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {r.read_at ? "Letto" : "Segna letto"}
          </button>
        </article>
      ))}
      {!rows.length && !error && <p>Nessuna menzione disponibile.</p>}
    </Modal>
  );
}
