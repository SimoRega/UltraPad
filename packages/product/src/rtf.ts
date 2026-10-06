import type { RichOp, Attributes } from "../../rich-text/src/index";
type State = { skip: boolean; attrs: Attributes; uc: number };
export function parseRtf(source: string): RichOp[] {
  if (source.length > 2 * 1024 * 1024 || !source.startsWith("{\\rtf"))
    throw new Error("RTF non valido o troppo grande");
  const rows: RichOp[] = [];
  let state: State = { skip: false, attrs: {}, uc: 1 };
  const stack: State[] = [];
  let fallback = 0;
  const add = (s: string) => {
    if (state.skip) return;
    if (fallback) {
      fallback--;
      return;
    }
    const last = rows.at(-1);
    if (last && JSON.stringify(last.attributes) === JSON.stringify(state.attrs))
      last.insert += s;
    else rows.push({ insert: s, attributes: { ...state.attrs } });
  };
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === "{") {
      if (stack.length >= 256) throw new Error("RTF troppo annidato");
      stack.push({ skip: state.skip, attrs: { ...state.attrs }, uc: state.uc });
    } else if (c === "}") {
      if (!stack.length) throw new Error("RTF non bilanciato");
      state = stack.pop()!;
    } else if (c === "\\") {
      const next = source[++i];
      if (next === "\\" || next === "{" || next === "}") add(next);
      else if (next === "*") state.skip = true;
      else if (next === "'") {
        const hex = source.slice(i + 1, i + 3);
        if (!/^[0-9a-f]{2}$/i.test(hex))
          throw new Error("Escape RTF non valido");
        add(
          new TextDecoder("windows-1252").decode(
            Uint8Array.of(parseInt(hex, 16)),
          ),
        );
        i += 2;
      } else {
        const match = /^([a-z]+)(-?\d+)? ?/i.exec(source.slice(i));
        if (!match) {
          if (next === "~") add("\u00a0");
          continue;
        }
        i += match[0].length - 1;
        const cmd = match[1],
          n = match[2] ? Number(match[2]) : 1;
        if (
          [
            "fonttbl",
            "colortbl",
            "stylesheet",
            "info",
            "pict",
            "object",
            "header",
            "footer",
            "field",
            "filetbl",
            "datastore",
            "xmlopen",
            "xmlattrname",
            "xmlattrvalue",
          ].includes(cmd)
        )
          state.skip = true;
        else if (cmd === "bin")
          throw new Error("RTF con dati binari non supportato");
        else if (
          cmd === "b" ||
          cmd === "i" ||
          cmd === "ul" ||
          cmd === "strike"
        ) {
          const key =
            cmd === "b"
              ? "bold"
              : cmd === "i"
                ? "italic"
                : cmd === "ul"
                  ? "underline"
                  : "strike";
          if (n === 0) delete state.attrs[key];
          else state.attrs[key] = true;
        } else if (cmd === "ulnone") delete state.attrs.underline;
        else if (cmd === "plain") state.attrs = {};
        else if (cmd === "par" || cmd === "line") add("\n");
        else if (cmd === "tab") add("\t");
        else if (cmd === "uc") state.uc = Math.min(10, Math.max(0, n));
        else if (cmd === "u") {
          if (!state.skip) {
            fallback = 0;
            add(String.fromCharCode(n < 0 ? n + 65536 : n));
            fallback = state.uc;
          }
        }
      }
    } else if (c !== "\n" && c !== "\r") add(c);
  }
  if (stack.length) throw new Error("RTF non bilanciato");
  if (
    !rows
      .map((r) => r.insert)
      .join("")
      .endsWith("\n")
  )
    rows.push({ insert: "\n" });
  return rows;
}
