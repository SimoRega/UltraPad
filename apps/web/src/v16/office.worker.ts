import * as mammoth from "mammoth/mammoth.browser";
import JSZip from "jszip";
import { parseRtf } from "../../../../packages/product/src/rtf";
async function bounded(entry: JSZip.JSZipObject, limit: number) {
  return new Promise<Uint8Array>((resolve, reject) => {
    let count = 0;
    const chunks: Uint8Array[] = [];
    const stream = (
      entry as unknown as {
        internalStream: (type: string) => JSZip.JSZipStreamHelper<Uint8Array>;
      }
    ).internalStream("uint8array");
    stream
      .on("data", (chunk: Uint8Array) => {
        count += chunk.length;
        if (count > limit) {
          stream.pause();
          reject(new Error("Parte Office troppo grande"));
          return;
        }
        chunks.push(chunk);
      })
      .on("error", reject)
      .on("end", () => {
        const out = new Uint8Array(count);
        let at = 0;
        for (const c of chunks) {
          out.set(c, at);
          at += c.length;
        }
        resolve(out);
      })
      .resume();
  });
}
self.onmessage = async (
  e: MessageEvent<{ name: string; buffer: ArrayBuffer }>,
) => {
  try {
    const { name, buffer } = e.data;
    if (buffer.byteLength > 2 * 1024 * 1024)
      throw new Error("Office fino a 2 MiB");
    if (/\.rtf$/i.test(name)) {
      self.postMessage({
        delta: parseRtf(new TextDecoder("windows-1252").decode(buffer)),
        warnings: [
          "Conservati testo, grassetto, corsivo, sottolineato e barrato. Tabelle, immagini, font, colori, note e impaginazione non sono convertiti.",
        ],
      });
      return;
    }
    const zip = await JSZip.loadAsync(buffer);
    const entries = Object.values(zip.files);
    if (entries.length > 200) throw new Error("Troppe parti Office");
    let total = 0;
    for (const entry of entries) {
      if (entry.dir) continue;
      const bytes = await bounded(entry, 2 * 1024 * 1024);
      total += bytes.length;
      if (total > 8 * 1024 * 1024)
        throw new Error("Office decompresso oltre 8 MiB");
    }
    if (
      !zip.file("word/document.xml") ||
      entries.some((v) => /vbaProject|\.bin$/i.test(v.name))
    )
      throw new Error("Formato Office non valido o con contenuto attivo");
    const result = await mammoth.convertToHtml(
      { arrayBuffer: buffer },
      {
        convertImage: mammoth.images.imgElement(() =>
          Promise.resolve({ src: "" }),
        ),
      },
    );
    self.postMessage({
      html: result.value,
      warnings: [
        "Conversione semantica: font, colori, impaginazione, immagini, note e tabelle complesse possono essere persi. Nessuna risorsa esterna viene caricata.",
        ...result.messages.map((m) => m.message),
      ],
    });
  } catch (e) {
    self.postMessage({ error: (e as Error).message });
  }
};
