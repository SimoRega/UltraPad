import { useEffect, useState } from "react";
import { request, mutate } from "../api";
type Invite = {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  used_at: string | null;
};
export default function Invitations({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<Invite[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      setRows(await request(`/projects/${projectId}/invitations`));
      setError("");
    } catch (e) {
      setRows([]);
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, [projectId]);
  return (
    <section>
      <h3>Inviti del progetto</h3>
      <p>
        Gli accessi riguardano tutti i file del progetto. Il proprietario e gli
        amministratori del workspace mantengono accesso ereditato.
      </p>
      {rows.map((i) => (
        <article key={i.id}>
          <strong>{i.email}</strong> · {i.role} ·{" "}
          {i.used_at
            ? "Accettato"
            : Date.parse(i.expires_at) <= Date.now()
              ? "Scaduto o revocato"
              : "In attesa"}
          {!i.used_at && Date.parse(i.expires_at) > Date.now() && (
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await mutate("revoke_invite", { id: i.id });
                  await load();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Revoca invito
            </button>
          )}
        </article>
      ))}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
