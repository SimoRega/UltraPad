import * as Y from "yjs";
import type { SelectionAnchor } from "./Discussion";
export function encodeAnchor(
  doc: Y.Doc,
  start: number,
  end: number,
  generation: number,
): SelectionAnchor {
  const text = doc.getText("content");
  const encode = (at: number) =>
    btoa(
      String.fromCharCode(
        ...Y.encodeRelativePosition(
          Y.createRelativePositionFromTypeIndex(text, at),
        ),
      ),
    );
  return {
    start: encode(start),
    end: encode(end),
    quote: text.toString().slice(start, end).slice(0, 240),
    generation,
  };
}
export function decodeAnchor(
  doc: Y.Doc,
  anchor: SelectionAnchor,
  generation: number,
) {
  if (anchor.generation !== generation) return null;
  try {
    const decode = (value: string) =>
      Y.createAbsolutePositionFromRelativePosition(
        Y.decodeRelativePosition(
          Uint8Array.from(atob(value), (c) => c.charCodeAt(0)),
        ),
        doc,
      );
    const start = decode(anchor.start),
      end = decode(anchor.end);
    return start && end && (!anchor.quote || end.index > start.index)
      ? { start: start.index, end: end.index }
      : null;
  } catch {
    return null;
  }
}
