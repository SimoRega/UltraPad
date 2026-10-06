import { useEffect, useState } from "react";
import { request } from "../api";
export default function InvitePreview({
  token,
  accept,
}: {
  token: string;
  accept: () => void;
}) {
  const [value, setValue] = useState<{
    project: string;
    workspace: string;
    role: string;
    expires_at: string;
  }>();
  const [error, setError] = useState("");
  useEffect(() => {
    void request<typeof value>("/invitations/preview", { token })
      .then(setValue)
      .catch((e) => setError(e.message));
  }, [token]);
  return (
    <div className="notice">
      {error ? (
        <span role="alert">{error}</span>
      ) : value ? (
        <>
          <p>
            Invito a {value.workspace} / {value.project}. Ruolo: {value.role}.
            Scadenza: {new Date(value.expires_at).toLocaleString()}.
          </p>
          <button className="primary" onClick={accept}>
            Accetta invito
          </button>
        </>
      ) : (
        <p>Verifica dell’invito…</p>
      )}
    </div>
  );
}
