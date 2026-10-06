import { useEffect, useState } from "react";
import { request, mutate } from "../api";
import { Modal, useConfirmation } from "../Dialogs";
import type { FileRecord } from "../../../../packages/contracts/src/index";
export default function Trash({
  close,
  changed,
}: {
  close: () => void;
  changed: () => void;
}) {
  const { confirm, confirmation } = useConfirmation();
  const [canPurge, setCanPurge] = useState(false);
  const [rows, setRows] = useState<
    (FileRecord & { deleted_root: string; deleted_at: string })[]
  >([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      setRows(await request("/trash"));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
    void request<{ purge: boolean }>("/trash/capabilities")
      .then((v) => setCanPurge(v.purge))
      .catch(() => setCanPurge(false));
  }, []);
  return (
    <Modal title="Cestino" close={close}>
      <p>
        File e cartelle restano recuperabili e continuano a occupare spazio.
        Conservazione fino al purge esplicito, senza scadenza automatica. Il
        purge rimuove contenuto, versioni server e prenotazioni cloud; le copie
        già scaricate o nei dispositivi restano indipendenti.
      </p>
      {error && <p role="alert">{error}</p>}
      {rows
        .filter((f) => f.id === f.deleted_root)
        .map((f) => (
          <section className="trash-row" key={f.id}>
            <strong>{f.name}</strong>
            <small>{new Date(f.deleted_at).toLocaleString()}</small>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await mutate("restore_deleted", { id: f.id });
                  setError("");
                  await load();
                  changed();
                } catch (e) {
                  setError(
                    "Ripristino non riuscito: verifica permessi e nomi duplicati. " +
                      (e as Error).message,
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Ripristina
            </button>
            <button
              className="danger"
              disabled={busy || !canPurge}
              onClick={async () => {
                if (
                  !(await confirm(
                    `Eliminare definitivamente ${f.name}, i discendenti e tutte le versioni server? Non sarà possibile ripristinarli.`,
                  ))
                )
                  return;
                setBusy(true);
                try {
                  await request(`/trash/${f.id}/purge`, {});
                  await load();
                  changed();
                } catch (e) {
                  setError(
                    "Purge incompleto: riprova la stessa operazione. " +
                      (e as Error).message,
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Elimina definitivamente
            </button>
          </section>
        ))}
      {!rows.length && !error && <p>Il cestino è vuoto.</p>}
      {!canPurge && (
        <p>
          Eliminazione definitiva disponibile dopo configurazione del servizio
          storage.
        </p>
      )}
      {confirmation}
    </Modal>
  );
}
