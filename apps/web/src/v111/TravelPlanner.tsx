import { apiUrl } from "../api";
import { useEffect, useMemo, useState } from "react";
import {
  mapsQuery,
  photoUrl,
  travelLinks,
  webUrl,
  type TravelLink,
} from "../../../../packages/product/src/travel";
import { textPatch } from "../../../../packages/product/src/sheet";
const cache = new Map<string, { title: string; image?: string }>();
function LinkCard({
  link,
  readOnly,
  photo,
}: {
  link: TravelLink;
  readOnly: boolean;
  photo: (value: string) => void;
}) {
  const [meta, setMeta] = useState(cache.get(link.url)),
    [failed, setFailed] = useState(false),
    [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string>();
  const map = mapsQuery(expanded ?? link.url);
  useEffect(() => {
    if (!["maps.app.goo.gl", "goo.gl"].includes(new URL(link.url).hostname))
      return;
    const controller = new AbortController();
    void fetch(`${apiUrl}/maps-preview?url=${encodeURIComponent(link.url)}`, {
      credentials: "omit",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.ok) {
          const value = (await response.json()) as { url: string };
          if (mapsQuery(value.url)) setExpanded(value.url);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [link.url]);
  useEffect(() => {
    if (
      map ||
      ["maps.app.goo.gl", "goo.gl"].includes(new URL(link.url).hostname) ||
      cache.has(link.url)
    )
      return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    void (async () => {
      try {
        const response = await fetch(link.url, {
          signal: controller.signal,
          credentials: "omit",
          referrerPolicy: "no-referrer",
        });
        if (
          !response.ok ||
          !response.headers.get("content-type")?.includes("text/html")
        )
          return;
        const reader = response.body?.getReader();
        if (!reader) return;
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          while (size < 128000) {
            const part = await reader.read();
            if (part.done) break;
            chunks.push(part.value);
            size += part.value.length;
          }
        } finally {
          await reader.cancel();
        }
        const bytes = new Uint8Array(Math.min(size, 128000));
        let offset = 0;
        for (const chunk of chunks) {
          const sliced = chunk.subarray(0, bytes.length - offset);
          bytes.set(sliced, offset);
          offset += sliced.length;
          if (offset === bytes.length) break;
        }
        const document = new DOMParser().parseFromString(
          new TextDecoder().decode(bytes),
          "text/html",
        );
        const title =
          document
            .querySelector('meta[property="og:title"]')
            ?.getAttribute("content") ?? document.title;
        const raw = document
          .querySelector('meta[property="og:image"]')
          ?.getAttribute("content");
        const image = raw
          ? webUrl(new URL(raw, response.url || link.url).href)
          : undefined;
        const value = { title: title.slice(0, 160) || link.title, image };
        if (cache.size >= 100) cache.delete(cache.keys().next().value!);
        cache.set(link.url, value);
        if (!controller.signal.aborted) setMeta(value);
      } catch {
        /* Sites may deny CORS. The link and attached photo remain available. */
      }
    })();
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [link.url, map]);
  const image = link.image ?? meta?.image;
  return (
    <article className="travel-card">
      {map ? (
        <iframe
          title={`Mappa: ${link.title}`}
          sandbox="allow-scripts allow-same-origin"
          loading="lazy"
          referrerPolicy="no-referrer"
          src={`https://www.google.com/maps?q=${encodeURIComponent(map)}&output=embed`}
          allowFullScreen
        />
      ) : image && !failed ? (
        <img
          src={image}
          alt={`Foto di ${meta?.title ?? link.title}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="travel-placeholder" aria-hidden="true">
          ✈
        </div>
      )}
      {map && link.image && !failed && (
        <img
          src={link.image}
          alt={`Foto di ${link.title}`}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
      <div className="travel-card-body">
        <a href={link.url} target="_blank" rel="noopener noreferrer">
          {link.title === new URL(link.url).hostname
            ? (meta?.title ?? link.title)
            : link.title}
        </a>
        <small>{new URL(link.url).hostname}</small>
        {!map &&
          /(?:maps\.app\.goo\.gl|goo\.gl)/.test(new URL(link.url).hostname) && (
            <p>
              Per vedere il punto sulla mappa, incolla il link completo da
              Google Maps.
            </p>
          )}
        {!readOnly && (
          <label>
            Allega foto
            <input
              aria-label={`Allega foto a ${link.title}`}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  if (file.size > 5 * 1024 * 1024)
                    throw Error("Foto troppo grande: massimo 5 MiB.");
                  const bitmap = await createImageBitmap(file);
                  try {
                    const canvas = document.createElement("canvas"),
                      ratio = Math.min(
                        1,
                        640 / bitmap.width,
                        480 / bitmap.height,
                      );
                    canvas.width = Math.max(
                      1,
                      Math.round(bitmap.width * ratio),
                    );
                    canvas.height = Math.max(
                      1,
                      Math.round(bitmap.height * ratio),
                    );
                    canvas
                      .getContext("2d")!
                      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
                    const value = canvas.toDataURL("image/jpeg", 0.7);
                    if (!photoUrl(value))
                      throw Error(
                        "Foto troppo complessa. Scegli una foto più piccola.",
                      );
                    photo(value);
                    setFailed(false);
                    setError("");
                  } finally {
                    bitmap.close();
                  }
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
          </label>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
    </article>
  );
}
export default function TravelPlanner({
  text,
  readOnly,
  replace,
}: {
  text: string;
  readOnly: boolean;
  replace: (start: number, length: number, value: string) => void;
}) {
  const [draft, setDraft] = useState<string>();
  const value = draft ?? text;
  const [previewText, setPreviewText] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setPreviewText(value), 350);
    return () => clearTimeout(timer);
  }, [value]);
  const links = useMemo(() => travelLinks(previewText), [previewText]);
  const writingText = value
    .split("\n")
    .filter((line) => !/^!\[[^\]]*\]\(.+\)$/.test(line))
    .join("\n");
  function write(next: string) {
    const photos = new Map(
      travelLinks(value)
        .filter((link) => link.image)
        .map((link) => [link.url, link.image!]),
    );
    for (const link of travelLinks(next).reverse()) {
      const image = photos.get(link.url);
      if (image)
        next =
          next.slice(0, link.end) +
          `\n![Foto](${image})` +
          next.slice(link.end);
    }
    setDraft(next);
  }
  function commit(next: string) {
    if (readOnly) return;
    const patch = textPatch(text, next);
    if (patch.length || patch.text)
      replace(patch.start, patch.length, patch.text);
    setDraft(undefined);
  }
  return (
    <section className="travel-planner">
      <h2>Travel planner</h2>
      <p>
        Scrivi le tappe e incolla link HTTPS. Per un titolo usa [Nome](link). Le
        foto allegate restano nel documento.
      </p>
      <textarea
        aria-label="Itinerario e link"
        disabled={readOnly}
        value={writingText}
        onChange={(e) => write(e.target.value)}
        onBlur={() => {
          if (draft !== undefined) commit(draft);
        }}
      />
      <p className="muted">
        Le anteprime dipendono dai permessi del sito. Se la foto non è
        disponibile, puoi allegarne una. Le mappe usano i link completi di
        Google Maps, anche abbreviati quando risolvibili. Mostrate fino a 30
        tappe.
      </p>
      <div className="travel-grid">
        {links.map((link) => (
          <LinkCard
            key={link.url}
            link={link}
            readOnly={readOnly}
            photo={(image) => {
              const current = travelLinks(value).find(
                (item) => item.url === link.url,
              );
              if (!current) return;
              const tail = value.slice(current.end);
              const match = tail.match(/^\n!\[[^\]]*\]\(.+\)/);
              const next =
                value.slice(0, current.end) +
                `\n![Foto](${image})` +
                (match ? tail.slice(match[0].length) : tail);
              commit(next);
            }}
          />
        ))}
      </div>
    </section>
  );
}
