export type Cell = {
  value: string;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  background?: string;
  format?: "number" | "currency" | "percent";
  align?: "left" | "center" | "right";
};
export type Sheet = {
  format: "ultrapad-sheet";
  version: 1;
  rows: number;
  columns: number;
  cells: Record<string, Cell>;
};
export const columnName = (n: number): string => {
  let s = "";
  for (n++; n > 0; n = Math.floor((n - 1) / 26))
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};
export function emptySheet(): Sheet {
  return {
    format: "ultrapad-sheet",
    version: 1,
    rows: 30,
    columns: 10,
    cells: Object.fromEntries(
      Array.from({ length: 30 }, (_, r) =>
        Array.from({ length: 10 }, (_, c) => [
          columnName(c) + (r + 1),
          { value: "" },
        ]),
      ).flat(),
    ),
  };
}
export function parseSheet(text: string): Sheet {
  const s = JSON.parse(text);
  if (
    s?.format !== "ultrapad-sheet" ||
    s.version !== 1 ||
    !Number.isInteger(s.rows) ||
    s.rows < 1 ||
    s.rows > 200 ||
    !Number.isInteger(s.columns) ||
    s.columns < 1 ||
    s.columns > 26 ||
    !s.cells ||
    Array.isArray(s.cells) ||
    typeof s.cells !== "object"
  )
    throw Error("Foglio non valido: apri il sorgente per correggerlo.");
  if (Object.keys(s.cells).length > 5200) throw Error("Troppe celle.");
  for (const [key, c] of Object.entries(s.cells) as [string, Cell][]) {
    if (
      !/^[A-Z](?:[1-9]\d{0,2})$/.test(key) ||
      key.charCodeAt(0) - 65 >= s.columns ||
      Number(key.slice(1)) > s.rows ||
      !c ||
      typeof c.value !== "string" ||
      c.value.length > 10000
    )
      throw Error("Cella non valida.");
    if (
      [c.color, c.background].some(
        (v) => v !== undefined && !/^#[\da-f]{6}$/i.test(v),
      )
    )
      throw Error("Colore non valido.");
    if (
      (c.align !== undefined &&
        !["left", "center", "right"].includes(c.align)) ||
      (c.format !== undefined &&
        !["number", "currency", "percent"].includes(c.format))
    )
      throw Error("Formato non valido.");
  }
  return s;
}
export function cellValue(
  sheet: Sheet,
  key: string,
  seen = new Set<string>(),
  budget = { left: 10000 },
): string | number {
  if (--budget.left < 0) return "#LIMIT!";
  if (seen.has(key) || seen.size > 100) return "#CYCLE!";
  const value = sheet.cells[key]?.value ?? "";
  if (!value.startsWith("="))
    return value !== "" && Number.isFinite(Number(value))
      ? Number(value)
      : value;
  const path = new Set(seen).add(key);
  const ref = (k: string): number => {
    if (
      k.charCodeAt(0) - 65 >= sheet.columns ||
      Number(k.slice(1)) > sheet.rows
    )
      throw Error("#REF!");
    const v = cellValue(sheet, k, path, budget);
    if (typeof v === "string" && v.startsWith("#")) throw Error(v);
    if (v === "") return 0;
    if (typeof v !== "number") throw Error("#VALUE!");
    return v;
  };
  try {
    let input = value
      .slice(1)
      .toUpperCase()
      .replace(/\s+/g, "")
      .replace(
        /(SUM|SOMMA|AVERAGE|MEDIA|MIN|MAX)\(([A-Z])(\d+):([A-Z])(\d+)\)/g,
        (_m, fn, a, r, b, t) => {
          const start = +r,
            end = +t;
          if (start < 1 || end > sheet.rows || a > b || start > end)
            throw Error("#REF!");
          const values: number[] = [];
          for (let col = a.charCodeAt(0); col <= b.charCodeAt(0); col++)
            for (let row = start; row <= end; row++)
              values.push(ref(String.fromCharCode(col) + row));
          return String(
            fn === "MIN"
              ? Math.min(...values)
              : fn === "MAX"
                ? Math.max(...values)
                : values.reduce((a, b) => a + b, 0) /
                  (fn === "AVERAGE" || fn === "MEDIA" ? values.length : 1),
          );
        },
      );
    input = input.replace(/[A-Z]\d+/g, (k) => `(${ref(k)})`);
    let i = 0;
    function atom(): number {
      if (input[i] === "+") {
        i++;
        return atom();
      }
      if (input[i] === "-") {
        i++;
        return -atom();
      }
      if (input[i] === "(") {
        i++;
        const n = expr();
        if (input[i++] !== ")") throw Error("#ERROR!");
        return n;
      }
      const m = input.slice(i).match(/^\d*\.?\d+(?:E[+-]?\d+)?/);
      if (!m) throw Error("#ERROR!");
      i += m[0].length;
      return Number(m[0]);
    }
    function term(): number {
      let n = atom();
      while (input[i] === "*" || input[i] === "/") {
        const op = input[i++],
          v = atom();
        if (op === "/" && v === 0) throw Error("#DIV/0!");
        n = op === "*" ? n * v : n / v;
      }
      return n;
    }
    function expr(): number {
      let n = term();
      while (input[i] === "+" || input[i] === "-") {
        const op = input[i++],
          v = term();
        n = op === "+" ? n + v : n - v;
      }
      return n;
    }
    const n = expr();
    if (i !== input.length || !Number.isFinite(n)) throw Error("#ERROR!");
    return n;
  } catch (e) {
    return e instanceof Error ? e.message : "#ERROR!";
  }
}
function csvValue(v: string | number): string {
  const s = String(v);
  return typeof v === "string" && /^[\s]*[=+@-]/.test(s) ? "'" + s : s;
}
export function sheetCsv(sheet: Sheet): string {
  return Array.from({ length: sheet.rows }, (_, r) =>
    Array.from(
      { length: sheet.columns },
      (_, c) =>
        '"' +
        csvValue(cellValue(sheet, columnName(c) + (r + 1))).replace(
          /"/g,
          '""',
        ) +
        '"',
    ).join(","),
  ).join("\n");
}
// Smallest contiguous edit: preserve unaffected CRDT characters.
export function textPatch(before: string, after: string) {
  let start = 0;
  while (
    start < before.length &&
    start < after.length &&
    before[start] === after[start]
  )
    start++;
  let a = before.length,
    b = after.length;
  while (a > start && b > start && before[a - 1] === after[b - 1]) {
    a--;
    b--;
  }
  return { start, length: a - start, text: after.slice(start, b) };
}
