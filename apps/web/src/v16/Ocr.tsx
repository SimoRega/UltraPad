import { useEffect, useRef, useState } from "react";
import type { Worker } from "tesseract.js";
export default function Ocr({
  image,
  accept,
}: {
  image: string;
  accept: (text: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const worker = useRef<Worker | undefined>(undefined);
  const serial = useRef(0);
  async function stop() {
    serial.current++;
    await worker.current?.terminate();
    worker.current = undefined;
    setBusy(false);
  }
  useEffect(
    () => () => {
      serial.current++;
      void worker.current?.terminate();
    },
    [],
  );
  async function start() {
    setBusy(true);
    setError("");
    setPreview("");
    const job = ++serial.current;
    let w: Worker | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const bitmap = await createImageBitmap(await (await fetch(image)).blob());
      const size = bitmap.width * bitmap.height;
      bitmap.close();
      if (size > 8000000) throw new Error("Immagine oltre 8 megapixel");
      const { createWorker } = await import("tesseract.js");
      timer = setTimeout(() => {
        void stop();
        setError(
          "OCR interrotto dopo 60 secondi. Puoi trascrivere il testo manualmente.",
        );
      }, 60000);
      w = await createWorker("ita+eng", 1, {
        workerPath: new URL("/ocr/worker.min.js", location.origin).href,
        corePath: new URL("/ocr", location.origin).href,
        langPath: new URL("/ocr", location.origin).href,
        workerBlobURL: false,
        cacheMethod: "none",
        logger: (m) => {
          if (job === serial.current) setProgress(Math.round(m.progress * 100));
        },
      });
      if (job !== serial.current) {
        await w.terminate();
        return;
      }
      worker.current = w;
      const result = await w.recognize(image);
      if (job === serial.current) setPreview(result.data.text.slice(0, 100000));
    } catch (e) {
      if (job === serial.current) setError((e as Error).message);
    } finally {
      clearTimeout(timer);
      await w?.terminate();
      if (job === serial.current) {
        worker.current = undefined;
        setBusy(false);
      }
    }
  }
  return (
    <section>
      <p>
        OCR locale italiano/inglese. Controlla la trascrizione prima di
        aggiungerla alla ricerca.
      </p>
      <button type="button" disabled={busy} onClick={() => void start()}>
        Estrai testo dall’immagine
      </button>
      {busy && (
        <>
          <span role="status">OCR {progress}%</span>
          <button type="button" onClick={() => void stop()}>
            Interrompi OCR
          </button>
        </>
      )}
      {preview && (
        <>
          <textarea
            aria-label="Trascrizione OCR da verificare"
            value={preview}
            onChange={(e) => setPreview(e.target.value)}
          />
          <button
            type="button"
            onClick={() => {
              accept(preview);
              setPreview("");
            }}
          >
            Aggiungi trascrizione alla nota
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
