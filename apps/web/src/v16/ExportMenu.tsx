import { useState } from "react";
import { Modal } from "../Dialogs";
export default function ExportMenu({
  disabled,
  run,
}: {
  disabled: boolean;
  run: (kind: "text" | "html" | "native") => void;
}) {
  const [open, setOpen] = useState(false);
  function exportAndClose(kind: "text" | "html" | "native") {
    run(kind);
    setOpen(false);
  }
  return (
    <>
      <button disabled={disabled} onClick={() => setOpen(true)}>
        Esporta…
      </button>
      {open && (
        <Modal title="Esporta documento" close={() => setOpen(false)}>
          <p>
            Il documento aperto resta invariato. Scegli cosa conservare nella
            copia.
          </p>
          <div className="export-options">
            <section>
              <h3>Testo semplice · TXT</h3>
              <p>
                Solo caratteri, UTF-8 e righe LF. Colori, font, elenchi e stili
                non sono conservati.
              </p>
              <button onClick={() => exportAndClose("text")}>
                Scarica testo
              </button>
            </section>
            <section>
              <h3>Pagina HTML</h3>
              <p>
                Testo e stili leggibili nel browser. Non comprende cronologia o
                permessi.
              </p>
              <button onClick={() => exportAndClose("html")}>
                Esporta HTML
              </button>
            </section>
            <section>
              <h3>Documento UltraPad</h3>
              <p>
                Testo e formattazione reimportabili in UltraPad tramite Importa
                file.
              </p>
              <button
                className="primary"
                onClick={() => exportAndClose("native")}
              >
                Scarica documento
              </button>
            </section>
          </div>
        </Modal>
      )}
    </>
  );
}
