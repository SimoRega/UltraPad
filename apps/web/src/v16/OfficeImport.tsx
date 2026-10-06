import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import Worker from "./office.worker?worker";
import { Modal } from "../Dialogs";
import { download } from "../files";
import {
  validateRichDelta,
  richHtml,
  type RichOp,
} from "../../../../packages/rich-text/src/index";
export function isOffice(name: string) {
  return /\.(docx|rtf)$/i.test(name);
}
export default function OfficeImport({
  source,
  close,
  accept,
}: {
  source: File;
  close: () => void;
  accept: (file: {
    name: string;
    text: string;
    delta: RichOp[];
  }) => Promise<void>;
}) {
  const [result, setResult] = useState<{
    delta: RichOp[];
    warnings: string[];
  }>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const worker = new Worker();
    let active = true;
    const timer = setTimeout(() => {
      worker.terminate();
      if (active)
        setError(
          "Conversione interrotta dopo 10 secondi. Il file originale resta invariato.",
        );
    }, 10000);
    worker.onmessage = (e) => {
      clearTimeout(timer);
      worker.terminate();
      if (!active) return;
      if (e.data.error) {
        setError(e.data.error);
        return;
      }
      try {
        let delta: RichOp[] = e.data.delta;
        if (!delta) {
          const clean = DOMPurify.sanitize(e.data.html, {
            FORBID_TAGS: [
              "script",
              "iframe",
              "object",
              "embed",
              "img",
              "style",
              "link",
            ],
            FORBID_ATTR: ["src", "href", "style"],
          });
          const doc = new DOMParser().parseFromString(clean, "text/html");
          delta = [];
          function walk(
            node: Node,
            attrs: Record<string, string | number | boolean> = {},
          ) {
            if (node.nodeType === 3) {
              if (node.textContent)
                delta.push({ insert: node.textContent, attributes: attrs });
              return;
            }
            if (!(node instanceof Element)) return;
            const a = { ...attrs };
            if (["STRONG", "B"].includes(node.tagName)) a.bold = true;
            if (["EM", "I"].includes(node.tagName)) a.italic = true;
            if (node.tagName === "U") a.underline = true;
            for (const child of node.childNodes) walk(child, a);
            if (/^(P|DIV|LI|TR|H[1-4])$/.test(node.tagName))
              delta.push({
                insert: "\n",
                attributes: /^H[1-4]$/.test(node.tagName)
                  ? { header: Number(node.tagName[1]) }
                  : node.tagName === "LI"
                    ? {
                        list:
                          node.parentElement?.tagName === "OL"
                            ? "ordered"
                            : "bullet",
                      }
                    : undefined,
              });
          }
          for (const n of doc.body.childNodes) walk(n);
          if (
            !delta
              .map((r) => r.insert)
              .join("")
              .endsWith("\n")
          )
            delta.push({ insert: "\n" });
        }
        setResult({
          delta: validateRichDelta(delta),
          warnings: e.data.warnings,
        });
      } catch (e) {
        setError((e as Error).message);
      }
    };
    void source
      .arrayBuffer()
      .then((buffer) => {
        if (active) worker.postMessage({ name: source.name, buffer }, [buffer]);
      })
      .catch(() => setError("File non leggibile"));
    return () => {
      active = false;
      clearTimeout(timer);
      worker.terminate();
    };
  }, [source]);
  return (
    <Modal
      title="Import Office · verifica conversione"
      close={() => {
        if (!busy) close();
      }}
    >
      <p>{source.name} → documento visuale UltraPad</p>
      {error && <p role="alert">{error}</p>}
      {!result && !error && <p role="status">Conversione locale…</p>}
      {result && (
        <>
          <ul>
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          <iframe
            className="office-preview"
            title="Anteprima conversione Office"
            sandbox=""
            srcDoc={richHtml(result.delta, source.name)}
          />
          <button
            onClick={() =>
              void source
                .arrayBuffer()
                .then((b) => download(source.name, b, source.type))
            }
          >
            Scarica originale
          </button>
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await accept({
                  name: source.name.replace(/\.(docx|rtf)$/i, ".txt"),
                  text: result.delta.map((r) => r.insert).join(""),
                  delta: result.delta,
                });
                close();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Conferma conversione e crea copia
          </button>
        </>
      )}
    </Modal>
  );
}
