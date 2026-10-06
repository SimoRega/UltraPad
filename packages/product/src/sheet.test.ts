import { describe, it, expect } from "vitest";
import {
  cellValue,
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
