import { useEffect, useState } from "react";
import { request } from "../api";
import type { FileRecord } from "../../../../packages/contracts/src/index";
import type { Role } from "../../../../packages/domain/src/index";
export type SelectionAnchor = {
  start: string;
  end: string;
  quote: string;
  generation: number;
};
type Thread = {
  id: string;
  generation: number;
  anchor: Partial<SelectionAnchor>;
  resolved: boolean;
  created_by: string;
};
type Comment = {
  id: string;
  thread_id: string;
  author_id: string;
  body: string;
  created_at: string;
};
export default function Discussion({
  file,
  role,
  userId,
  anchor,
  locate,
}: {
  file: FileRecord;
  userId: string;
  role: Role;
  anchor?: SelectionAnchor;
  locate: (anchor: SelectionAnchor) => void;
}) {
  const [data, setData] = useState<{ threads: Thread[]; comments: Comment[] }>({
    threads: [],
    comments: [],
  });
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState("");
  const [resolved, setResolved] = useState(false);
  const [mention, setMention] = useState("");
  const [members, setMembers] = useState<{ user_id: string; role: Role }[]>([]);
  async function load() {
    try {
      setData(await request(`/files/${file.id}/discussion`));
      setError("");
    } catch (e) {
      setData({ threads: [], comments: [] });
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 5000);
    void request<typeof members>(`/projects/${file.project_id}/members`)
      .then(setMembers)
      .catch(() => setMembers([]));
    return () => clearInterval(timer);
  }, [file.id]);
  async function send(op: string, args: Record<string, unknown>) {
    setBusy(true);
    try {
      await request("/collaborate", { op, args });
      setBody("");
      setReply("");
      setMention("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <aside className="collaboration-panel">
      <h2>Discussione</h2>
      <label>
        <input
          type="checkbox"
          checked={resolved}
          onChange={(e) => setResolved(e.target.checked)}
        />
        Mostra risolti
      </label>
      {error && <p role="alert">{error}</p>}
      {data.threads
        .filter((t) => resolved || !t.resolved)
        .map((t) => (
          <section key={t.id} className="comment-thread">
            <button
              disabled={!t.anchor.start || t.generation !== file.generation}
              onClick={() => locate(t.anchor as SelectionAnchor)}
            >
              {t.anchor.quote || "Commento sul documento"}
            </button>
            {t.generation !== file.generation && (
              <small>Riferimento a una versione precedente</small>
            )}
            {data.comments
              .filter((c) => c.thread_id === t.id)
              .map((c) => (
                <article key={c.id}>
                  <small>
                    {c.author_id.slice(0, 8)} ·{" "}
                    {new Date(c.created_at).toLocaleString()}
                  </small>
                  <p>{c.body}</p>
                </article>
              ))}
            {role !== "viewer" && (
              <button onClick={() => setReply(t.id)}>Rispondi</button>
            )}
            {(role === "owner" ||
              role === "admin" ||
              role === "editor" ||
              t.created_by === userId) && (
              <button
                disabled={busy}
                onClick={() =>
                  void send("resolve", {
                    thread_id: t.id,
                    resolved: !t.resolved,
                  })
                }
              >
                {t.resolved ? "Riapri" : "Risolvi"}
              </button>
            )}
          </section>
        ))}
      {role !== "viewer" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(reply ? "reply" : "thread", {
              file_id: file.id,
              generation: file.generation,
              anchor: reply ? undefined : (anchor ?? {}),
              thread_id: reply || undefined,
              body,
              mentions: mention ? [mention] : [],
            });
          }}
        >
          <h3>{reply ? "Risposta" : "Nuovo commento"}</h3>
          {!reply && (
            <p>
              {anchor?.quote
                ? "Selezione: " + anchor.quote
                : "Seleziona un passaggio nell’editor per ancorare il commento."}
            </p>
          )}
          <textarea
            aria-label="Testo commento"
            required
            maxLength={4000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <label>
            Menziona
            <select
              value={mention}
              onChange={(e) => setMention(e.target.value)}
            >
              <option value="">Nessuno</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.user_id.slice(0, 8)} · {m.role}
                </option>
              ))}
            </select>
          </label>
          <button disabled={busy}>Pubblica commento</button>
          {reply && (
            <button type="button" onClick={() => setReply("")}>
              Annulla risposta
            </button>
          )}
        </form>
      )}
    </aside>
  );
}
