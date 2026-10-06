import { request } from "../api";
import { useEffect, useState } from "react";
import { Modal } from "../Dialogs";
import { exportLocal } from "../files";
import {
  localCopies,
  type CollaborationClient,
  type SaveStatus,
} from "../../../../packages/collaboration-client/src/index";
export default function SaveCenter({
  status,
  pending,
  local,
  error,
  userId,
  client,
  download,
  fileId,
}: {
  fileId: string;
  status: SaveStatus;
  pending: number;
  local: boolean;
  error: string;
  userId: string;
  client?: CollaborationClient;
  download: () => void;
}) {
  const [backup, setBackup] = useState<{
    configured: boolean;
    state: { seq: number; last_time: number; error: string | null };
  }>();
  const [copies, setCopies] = useState<
    {
      fileId: string;
      generation: number;
      state: Uint8Array;
      pending: unknown[];
    }[]
  >([]);
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState<string>();
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (open && !local) {
      void request<{
        configured: boolean;
        state: { seq: number; last_time: number; error: string | null };
      }>(`/files/${fileId}/backup-health`)
        .then(setBackup)
        .catch(() => setBackup(undefined));
      void localCopies(userId)
        .then((v) => setCopies(v))
        .catch(() =>
          setNotice("Copie locali non leggibili: scarica il file aperto."),
        );
    }
  }, [open, local, fileId, userId]);
  useEffect(() => {
    if (status === "salvato sul server" && !pending)
      setLast(new Date().toLocaleTimeString());
  }, [status, pending]);
  return (
    <>
      <button
        className="save-center"
        onClick={() => setOpen(true)}
        aria-label="Stato salvataggio e recupero"
      >
        Recupero
      </button>
      {open && (
        <Modal title="Salvataggio e recupero" close={() => setOpen(false)}>
          <p>
            {local
              ? "Questo file resta in questa scheda: chiuderla termina la conservazione. Scarica una copia per conservarlo."
              : pending
                ? "Il server non ha ancora confermato tutte le modifiche. La copia locale resta disponibile sul dispositivo."
                : status === "salvato sul server"
                  ? "Il server ha confermato le modifiche."
                  : "Il file non è al momento sincronizzato. Conserva una copia prima di lasciare il dispositivo."}
          </p>
          {last && !local && <p>Ultima conferma osservata: {last}</p>}
          {error && <p role="alert">{error}</p>}
          {!local && (
            <>
              <p>
                {backup?.configured
                  ? backup.state.error
                    ? "L’ultimo checkpoint remoto non è riuscito. La copia sul server resta distinta dal backup."
                    : backup.state.last_time
                      ? "Ultimo checkpoint remoto osservato: " +
                        new Date(backup.state.last_time).toLocaleString() +
                        " · revisione " +
                        backup.state.seq
                      : "Checkpoint remoto configurato; nessun backup ancora osservato per questo file."
                  : "La conferma di salvataggio non certifica un backup remoto. Verifica la configurazione dei checkpoint."}
              </p>
              <details>
                <summary>
                  Copie locali di questo account ({copies.length})
                </summary>
                {copies.map((c) => (
                  <p key={c.fileId + ":" + c.generation}>
                    {c.fileId.slice(0, 8)} · generazione {c.generation} ·{" "}
                    {c.state.length} byte di stato · {c.pending.length}{" "}
                    modifiche in attesa
                  </p>
                ))}
              </details>
            </>
          )}
          <button onClick={download}>Scarica copia del file</button>
          {!local && (
            <>
              <button
                disabled={status === "accesso cambiato"}
                onClick={() => client?.retryConnection()}
              >
                Riprova connessione
              </button>
              <button
                onClick={async () => {
                  try {
                    await exportLocal(await localCopies(userId));
                    setNotice("Copie locali esportate.");
                  } catch {
                    setNotice("Export non riuscito. Scarica il file aperto.");
                  }
                }}
              >
                Esporta recupero di questo account
              </button>
            </>
          )}
          {notice && <p role="status">{notice}</p>}
        </Modal>
      )}
    </>
  );
}
