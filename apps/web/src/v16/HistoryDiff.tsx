import { useEffect, useState } from "react";
import { request } from "../api";
import {
  richHtml,
  type RichOp,
} from "../../../../packages/rich-text/src/index";
type Snapshot = { text: string; delta?: RichOp[] };
export default function HistoryDiff({
  fileId,
  checkpoints,
  selected,
}: {
  fileId: string;
  checkpoints: { id: string; label: string }[];
  selected: Snapshot;
}) {
  const [against, setAgainst] = useState("current");
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [error, setError] = useState("");
  const [rich, setRich] = useState(false);
  useEffect(() => {
    let active = true;
    setSnapshot(undefined);
    void request<Snapshot>(
      against === "current"
        ? `/files/${fileId}/snapshot`
        : `/files/${fileId}/checkpoints/${against}`,
    )
      .then((v) => {
        if (active) {
          setSnapshot(v);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [fileId, against, selected.text]);
  const left = selected.text.split("\n"),
    right = snapshot?.text.split("\n") ?? [];
  return (
    <section className="history-diff">
      <label>
        Confronta con
        <select value={against} onChange={(e) => setAgainst(e.target.value)}>
          <option value="current">
            Revisione corrente fissata all’apertura
          </option>
          {checkpoints.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={rich}
          onChange={(e) => setRich(e.target.checked)}
        />
        Anteprima formattata
      </label>
      {error && <p role="alert">{error}</p>}
      {snapshot &&
        (rich ? (
          <div className="diff-columns">
            <iframe
              title="Versione selezionata con stili"
              sandbox=""
              srcDoc={richHtml(selected.delta ?? [{ insert: selected.text }])}
            />
            <iframe
              title="Versione di confronto con stili"
              sandbox=""
              srcDoc={richHtml(snapshot.delta ?? [{ insert: snapshot.text }])}
            />
          </div>
        ) : (
          <div className="diff-columns">
            <pre>
              {left.map((line, i) => (
                <div
                  key={i}
                  className={line === right[i] ? "" : "diff-removed"}
                >
                  {line || " "}
                </div>
              ))}
            </pre>
            <pre>
              {right.map((line, i) => (
                <div key={i} className={line === left[i] ? "" : "diff-added"}>
                  {line || " "}
                </div>
              ))}
            </pre>
          </div>
        ))}
      <small>
        Confronto per righe; gli spostamenti possono apparire come rimozioni e
        aggiunte. Le due copie restano fissate durante il confronto.
      </small>
    </section>
  );
}
