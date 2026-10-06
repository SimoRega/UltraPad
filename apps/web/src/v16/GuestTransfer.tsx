import { useState } from "react";
import { readDrafts } from "../drafts";
import { request } from "../api";
import { Modal } from "../Dialogs";
const intent = "ultrapad-transfer-intent";
export function requestGuestTransfer() {
  sessionStorage.setItem(intent, "true");
}
export default function GuestTransfer({
  userId,
  email,
  changed,
}: {
  userId: string;
  email?: string;
  changed: () => void;
}) {
  const [open, setOpen] = useState(() =>
    (() => {
      try {
        return sessionStorage.getItem(intent) === "true";
      } catch {
        return false;
      }
    })(),
  );
  const [rows] = useState(() => readDrafts("guest-v1.5"));
  const [chosen, setChosen] = useState<string[]>([]);
  const [done, setDone] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  function close() {
    try {
      sessionStorage.removeItem(intent);
    } catch {
      /* Closing must remain available. */
    }
    setOpen(false);
  }
  return open && rows.length ? (
    <Modal
      title="Conserva gli appunti ospite"
      close={() => {
        if (!busy) close();
      }}
    >
      <p>
        Account di destinazione: <strong>{email ?? userId}</strong>. Le copie
        saranno private. Gli originali restano nella scheda.
      </p>
      {rows.map((d) => (
        <label key={d.id}>
          <input
            type="checkbox"
            disabled={busy || done.includes(d.id)}
            checked={chosen.includes(d.id)}
            onChange={(e) =>
              setChosen((v) =>
                e.target.checked ? [...v, d.id] : v.filter((id) => id !== d.id),
              )
            }
          />
          {d.name}
          {done.includes(d.id) ? " · copiato" : ""}
        </label>
      ))}
      {message && <p role="status">{message}</p>}
      <button
        disabled={busy || !chosen.some((id) => !done.includes(id))}
        onClick={async () => {
          setBusy(true);
          try {
            for (const d of rows.filter(
              (d) => chosen.includes(d.id) && !done.includes(d.id),
            )) {
              await request("/guest-transfer", {
                source: d.id,
                name: d.name,
                text: d.text,
                delta: d.delta,
              });
              setDone((v) => [...v, d.id]);
            }
            setMessage(
              "Copie confermate dal server. Puoi continuare nei file personali.",
            );
            changed();
          } catch (e) {
            setMessage(
              "Le copie locali restano disponibili. " + (e as Error).message,
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        Conferma copia in questo account
      </button>
      <button disabled={busy} onClick={close}>
        Continua senza copiare
      </button>
    </Modal>
  ) : null;
}
