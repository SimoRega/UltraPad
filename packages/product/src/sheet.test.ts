import { describe, it, expect } from "vitest";
import {
  cellValue,
  sheetEvaluator,
  pasteCells,
  sortTable,
  emptySheet,
  parseSheet,
  sheetCsv,
  textPatch,
} from "./sheet";
describe("spreadsheet source", () => {
  it("calculates references, ranges, precedence and errors without executing source", () => {
    const s = emptySheet();
    s.cells = {
      A1: { value: "10" },
      A2: { value: "20" },
      B1: { value: "=SUM(A1:A2)*2+1" },
      B2: { value: "=AVERAGE(A1:A2)" },
      C1: { value: "=C2" },
      C2: { value: "=C1" },
      D1: { value: "=1/0" },
      E1: { value: "=alert(1)" },
      F1: { value: "=Z999" },
    };
    expect(cellValue(s, "B1")).toBe(61);
    expect(cellValue(s, "B2")).toBe(15);
    expect(cellValue(s, "C1")).toBe("#CYCLE!");
    expect(cellValue(s, "D1")).toBe("#DIV/0!");
    expect(cellValue(s, "E1")).toBe("#ERROR!");
    expect(cellValue(s, "F1")).toBe("#REF!");
  });
  it("rejects malformed or excessive sheets and unsafe colors", () => {
    expect(() => parseSheet("{")).toThrow();
    expect(() =>
      parseSheet(JSON.stringify({ ...emptySheet(), rows: 10000 })),
    ).toThrow();
    expect(() =>
      parseSheet(
        JSON.stringify({
          ...emptySheet(),
          cells: { A1: { value: "x", color: "url(https://example.com)" } },
        }),
      ),
    ).toThrow();
  });
  it("exports escaped values and patches only the changed span", () => {
    const s = emptySheet();
    s.rows = 1;
    s.columns = 1;
    s.cells.A1 = { value: 'a,"b"' };
    expect(sheetCsv(s)).toBe('"a,""b"""');
    s.cells.A1 = { value: "+CMD" };
    expect(sheetCsv(s)).toBe('"\'+CMD"');
    const p = textPatch("abc123xyz", "abc456xyz");
    expect(p).toEqual({ start: 3, length: 3, text: "456" });
  });
});

describe("v1.11 tables and bounded evaluation", () => {
  it("aggregates blanks/text correctly, reuses dependencies and detects cycles", () => {
    const s = emptySheet();
    s.cells = {
      A1: { value: "10" },
      A2: { value: "" },
      A3: { value: "Hotel" },
      B1: { value: "=AVERAGE(A1:A3)" },
      B2: { value: "=COUNT(A1:A3)" },
      B3: { value: "=COUNTA(A1:A3)" },
      C1: { value: "=C2" },
      C2: { value: "=C1" },
    };
    const evaluate = sheetEvaluator(s);
    expect(evaluate("B1")).toBe(10);
    expect(evaluate("B2")).toBe(1);
    expect(evaluate("B3")).toBe(2);
    expect(evaluate("C1")).toBe("#CYCLE!");
    expect(evaluate("C2")).toBe("#CYCLE!");
  });
  it("pastes a rectangle atomically, sorts data preserving headers/styles and rejects invalid metadata", () => {
    let s = emptySheet();
    s = pasteCells(s, "A1", "Luogo\tCosto\nKyoto\t20\nTokyo\t10");
    s.cells.A2.bold = true;
    const table = { id: "trip", name: "Costi", range: "A1:B3" };
    s.tables = [table];
    s.charts = [{ id: "chart", title: "Spese", range: "A1:B3", type: "bar" }];
    expect(parseSheet(JSON.stringify(s)).tables).toEqual([table]);
    const sorted = sortTable(s, table, 1);
    expect(sorted.cells.A1.value).toBe("Luogo");
    expect(sorted.cells.A2.value).toBe("Tokyo");
    expect(sorted.cells.A3.bold).toBe(true);
    expect(s.cells.A2.value).toBe("Kyoto");
    expect(() => pasteCells(s, "J30", "x\ty")).toThrow();
    expect(() =>
      parseSheet(
        JSON.stringify({ ...s, tables: [{ ...table, range: "A1:Z999" }] }),
      ),
    ).toThrow();
    expect(() =>
      parseSheet(
        JSON.stringify({ ...s, charts: [{ ...s.charts![0], type: "script" }] }),
      ),
    ).toThrow();
  });
});

it("charges cached references against formula work limits without exhausting display cache", () => {
  const s = emptySheet();
  s.cells.A1 = { value: "10" };
  s.cells.B1 = { value: "=SUM(A1:A30)+SUM(A1:A30)" };
  expect(cellValue(s, "B1", new Set(), { left: 40 }, new Map())).toBe(
    "#LIMIT!",
  );
  const value = sheetEvaluator(s);
  for (let i = 0; i < 250001; i++) value("A1");
  expect(value("A1")).toBe(10);
  expect(value("B1")).toBe(20);
});
