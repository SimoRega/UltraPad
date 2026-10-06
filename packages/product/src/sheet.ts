export type Cell = {
  value: string;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  background?: string;
  format?: "number" | "currency" | "percent";
  align?: "left" | "center" | "right";
};
export type SheetTable = { id: string; name: string; range: string };
export type SheetChart = {
  id: string;
  title: string;
  range: string;
  type: "bar" | "line" | "pie";
};
export type Sheet = {
  format: "ultrapad-sheet";
  version: 1;
  rows: number;
  columns: number;
  cells: Record<string, Cell>;
  tables?: SheetTable[];
  charts?: SheetChart[];
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
  for (const collection of [s.tables, s.charts]) {
    if (
      collection !== undefined &&
      (!Array.isArray(collection) || collection.length > 20)
    )
      throw Error("Troppe tabelle o grafici.");
    const ids = new Set<string>();
    for (const item of collection ?? []) {
      if (
        !item ||
        typeof item.id !== "string" ||
        !item.id ||
        item.id.length > 80 ||
        ids.has(item.id)
      )
        throw Error("Identità tabella/grafico non valida.");
      ids.add(item.id);
      rangeCells(s, item.range);
      const title = item.name ?? item.title;
      if (typeof title !== "string" || !title.trim() || title.length > 120)
        throw Error("Titolo non valido.");
    }
  }
  if (
    s.charts?.some((c: SheetChart) => !["bar", "line", "pie"].includes(c.type))
  )
    throw Error("Tipo grafico non valido.");
  return s;
}
export function cellValue(
  sheet: Sheet,
  key: string,
  seen = new Set<string>(),
  budget = { left: 10000 },
  cache?: Map<string, string | number>,
): string | number {
  if (seen.has(key) || seen.size > 100) return "#CYCLE!";
  if (--budget.left < 0) return "#LIMIT!";
  if (cache?.has(key)) return cache.get(key)!;
  const result = (value: string | number) => {
    cache?.set(key, value);
    return value;
  };
  const value = sheet.cells[key]?.value ?? "";
  if (!value.startsWith("="))
    return result(
      value !== "" && Number.isFinite(Number(value)) ? Number(value) : value,
    );
  const path = new Set(seen).add(key);
  const ref = (k: string): number => {
    if (
      k.charCodeAt(0) - 65 >= sheet.columns ||
      Number(k.slice(1)) < 1 ||
      Number(k.slice(1)) > sheet.rows
    )
      throw Error("#REF!");
    const v = cellValue(sheet, k, path, budget, cache);
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
        /(SUM|SOMMA|AVERAGE|MEDIA|MIN|MAX|COUNT|COUNTA)\(([A-Z])(\d+):([A-Z])(\d+)\)/g,
        (_m, fn, a, r, b, t) => {
          const start = +r,
            end = +t;
          if (start < 1 || end > sheet.rows || a > b || start > end)
            throw Error("#REF!");
          if (b.charCodeAt(0) - 65 >= sheet.columns) throw Error("#REF!");
          const values: (string | number)[] = [];
          for (let col = a.charCodeAt(0); col <= b.charCodeAt(0); col++)
            for (let row = start; row <= end; row++) {
              const v = cellValue(
                sheet,
                String.fromCharCode(col) + row,
                path,
                budget,
                cache,
              );
              if (typeof v === "string" && v.startsWith("#")) throw Error(v);
              values.push(v);
            }
          const numbers = values.filter(
            (v): v is number => typeof v === "number",
          );
          if ((fn === "AVERAGE" || fn === "MEDIA") && !numbers.length)
            throw Error("#DIV/0!");
          return String(
            fn === "COUNTA"
              ? values.filter((v) => v !== "").length
              : fn === "COUNT"
                ? numbers.length
                : fn === "MIN"
                  ? numbers.length
                    ? Math.min(...numbers)
                    : 0
                  : fn === "MAX"
                    ? numbers.length
                      ? Math.max(...numbers)
                      : 0
                    : numbers.reduce((a, b) => a + b, 0) /
                      (fn === "AVERAGE" || fn === "MEDIA" ? numbers.length : 1),
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
    return result(n);
  } catch (e) {
    return result(e instanceof Error ? e.message : "#ERROR!");
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

export function rangeCells(
  sheet: Pick<Sheet, "rows" | "columns">,
  range: string,
) {
  const match =
    typeof range === "string" &&
    range.toUpperCase().match(/^([A-Z])([1-9]\d{0,2}):([A-Z])([1-9]\d{0,2})$/);
  if (!match) throw Error("Intervallo non valido: usa A1:B10.");
  const left = match[1].charCodeAt(0) - 65,
    top = Number(match[2]) - 1,
    right = match[3].charCodeAt(0) - 65,
    bottom = Number(match[4]) - 1;
  if (
    left > right ||
    top > bottom ||
    right >= sheet.columns ||
    bottom >= sheet.rows
  )
    throw Error("Intervallo fuori dal foglio.");
  return { left, top, right, bottom };
}
export function sheetEvaluator(sheet: Sheet) {
  const cache = new Map<string, string | number>(),
    budget = { left: 250000 };
  return (id: string) =>
    cache.has(id)
      ? cache.get(id)!
      : cellValue(sheet, id, new Set(), budget, cache);
}
export function pasteCells(sheet: Sheet, start: string, text: string): Sheet {
  const anchor = rangeCells(sheet, `${start}:${start}`),
    values = text
      .replace(/\r\n?/g, "\n")
      .replace(/\n$/, "")
      .split("\n")
      .map((row) => row.split("\t"));
  if (
    values.length + anchor.top > sheet.rows ||
    values.some((row) => row.length + anchor.left > sheet.columns)
  )
    throw Error("Dati incollati fuori dal foglio: aggiungi righe o colonne.");
  const cells = { ...sheet.cells };
  values.forEach((row, r) =>
    row.forEach((value, c) => {
      if (value.length > 10000) throw Error("Cella troppo lunga.");
      const id = columnName(anchor.left + c) + (anchor.top + r + 1);
      cells[id] = { ...cells[id], value };
    }),
  );
  return { ...sheet, cells };
}
export function sortTable(
  sheet: Sheet,
  table: SheetTable,
  column: number,
  descending = false,
): Sheet {
  const area = rangeCells(sheet, table.range),
    value = sheetEvaluator(sheet);
  if (column < area.left || column > area.right)
    throw Error("Seleziona una colonna della tabella.");
  const order = Array.from(
    { length: area.bottom - area.top },
    (_, i) => area.top + i + 1,
  ).sort((a, b) => {
    const x = value(columnName(column) + (a + 1)),
      y = value(columnName(column) + (b + 1));
    return (
      (typeof x === "number" && typeof y === "number"
        ? x - y
        : String(x).localeCompare(String(y), "it", { numeric: true })) *
      (descending ? -1 : 1)
    );
  });
  const cells = { ...sheet.cells };
  order.forEach((source, i) => {
    for (let c = area.left; c <= area.right; c++) {
      const to = columnName(c) + (area.top + i + 2),
        from = columnName(c) + (source + 1);
      cells[to] = { ...(sheet.cells[from] ?? { value: "" }) };
    }
  });
  return { ...sheet, cells };
}
