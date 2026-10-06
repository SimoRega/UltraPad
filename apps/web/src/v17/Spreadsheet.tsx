import ToolMenu from "../ToolMenu";
import Chart from "./SheetChart";
import { useMemo, useRef, useState } from "react";
import {
  sheetEvaluator,
  rangeCells,
  pasteCells,
  sortTable,
  type Sheet,
  columnName,
  emptySheet,
  parseSheet,
  sheetCsv,
  textPatch,
  type Cell,
} from "../../../../packages/product/src/sheet";
import { download } from "../files";
function CellInput({
  id,
  value,
  disabled,
  select,
  save,
  paste,
}: {
  id: string;
  value: string;
  disabled: boolean;
  select: () => void;
  save: (value: string) => void;
  paste: (value: string) => void;
}) {
  const [draft, setDraft] = useState<string>();
  const cancelled = useRef(false);
  return (
    <input
      aria-label={`Cella ${id}`}
      disabled={disabled}
      value={draft ?? value}
      onPaste={(e) => {
        const value = e.clipboardData.getData("text/plain");
        if (/[\t\n]/.test(value)) {
          e.preventDefault();
          setDraft(undefined);
          cancelled.current = true;
          paste(value);
          e.currentTarget.blur();
        }
      }}
      onFocus={() => {
        select();
        cancelled.current = false;
        setDraft(value);
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (!cancelled.current && draft !== undefined && draft !== value)
          save(draft);
        setDraft(undefined);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          cancelled.current = true;
          setDraft(undefined);
          e.currentTarget.blur();
        }
      }}
    />
  );
}
export default function Spreadsheet({
  name,
  text,
  readOnly,
  replace,
}: {
  name: string;
  text: string;
  readOnly: boolean;
  replace: (start: number, length: number, value: string) => void;
}) {
  const [selected, setSelected] = useState("A1");
  const [editing, setEditing] = useState(false);
  const [formula, setFormula] = useState<string>();
  const [range, setRange] = useState("A1:B6"),
    [title, setTitle] = useState("Tabella 1"),
    [chartType, setChartType] = useState<"bar" | "line" | "pie">("bar"),
    [activeTable, setActiveTable] = useState(""),
    [filter, setFilter] = useState(""),
    [scroll, setScroll] = useState(0),
    [error, setError] = useState("");
  const parsed = useMemo(() => {
    try {
      return { sheet: parseSheet(text) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [text]);
  const sheet = parsed.sheet;
  const evaluate = useMemo(
    () => (sheet ? sheetEvaluator(sheet) : () => ""),
    [sheet],
  );
  if (!sheet) {
    return (
      <div role="alert">
        <p>{parsed.error}</p>
        {!text && !readOnly && (
          <button
            onClick={() => replace(0, 0, JSON.stringify(emptySheet(), null, 2))}
          >
            Inizializza foglio vuoto
          </button>
        )}
      </div>
    );
  }
  const cell = sheet.cells[selected] ?? { value: "" };
  function commit(next: Sheet) {
    if (readOnly) return;
    try {
      const json = JSON.stringify(next, null, 2);
      parseSheet(json);
      const p = textPatch(text, json);
      replace(p.start, p.length, p.text);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function attempt(fn: () => Sheet) {
    try {
      commit(fn());
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const table = sheet.tables?.find((t) => t.id === activeTable),
    area = table ? rangeCells(sheet, table.range) : undefined;
  const rows = Array.from({ length: sheet.rows }, (_, r) => r).filter(
    (r) =>
      !area ||
      !filter ||
      r <= area.top ||
      r > area.bottom ||
      Array.from({ length: area.right - area.left + 1 }, (_, c) =>
        String(evaluate(columnName(area.left + c) + (r + 1))),
      ).some((v) => v.toLowerCase().includes(filter.toLowerCase())),
  );
  const start = editing
      ? 0
      : Math.max(0, Math.min(rows.length - 1, Math.floor(scroll / 36) - 5)),
    visibleRows = editing ? rows : rows.slice(start, start + 40);
  function update(id: string, patch: Partial<Cell>) {
    if (readOnly) return;
    const next = {
      ...sheet!,
      cells: {
        ...sheet!.cells,
        [id]: { ...(sheet!.cells[id] ?? { value: "" }), ...patch },
      },
    };
    const p = textPatch(text, JSON.stringify(next, null, 2));
    replace(p.start, p.length, p.text);
  }
  return (
    <section className="spreadsheet">
      <div
        role="toolbar"
        aria-label="Strumenti foglio di calcolo"
        className="format-toolbar"
      >
        <button aria-pressed={editing} onClick={() => setEditing((v) => !v)}>
          {editing ? "Mostra risultati" : "Modifica celle"}
        </button>
        <button
          disabled={readOnly}
          aria-pressed={Boolean(cell.bold)}
          onClick={() => update(selected, { bold: !cell.bold })}
        >
          <b>Grassetto</b>
        </button>
        <button
          disabled={readOnly}
          aria-pressed={Boolean(cell.italic)}
          onClick={() => update(selected, { italic: !cell.italic })}
        >
          <i>Corsivo</i>
        </button>
        <label>
          Colore testo
          <input
            type="color"
            disabled={readOnly}
            value={cell.color ?? "#222222"}
            onChange={(e) => update(selected, { color: e.target.value })}
          />
        </label>
        <label>
          Sfondo cella
          <input
            type="color"
            disabled={readOnly}
            value={cell.background ?? "#ffffff"}
            onChange={(e) => update(selected, { background: e.target.value })}
          />
        </label>
        <label>
          Allineamento
          <select
            disabled={readOnly}
            value={cell.align ?? "left"}
            onChange={(e) =>
              update(selected, { align: e.target.value as Cell["align"] })
            }
          >
            <option value="left">Sinistra</option>
            <option value="center">Centro</option>
            <option value="right">Destra</option>
          </select>
        </label>
        <label>
          Formato numero
          <select
            disabled={readOnly}
            value={cell.format ?? "number"}
            onChange={(e) =>
              update(selected, { format: e.target.value as Cell["format"] })
            }
          >
            <option value="number">Numero</option>
            <option value="currency">Euro</option>
            <option value="percent">Percentuale</option>
          </select>
        </label>
        <button
          disabled={readOnly || sheet.rows >= 200}
          onClick={() => {
            const p = textPatch(
              text,
              JSON.stringify({ ...sheet, rows: sheet.rows + 1 }, null, 2),
            );
            replace(p.start, p.length, p.text);
          }}
        >
          + Riga
        </button>
        <button
          disabled={readOnly || sheet.columns >= 26}
          onClick={() => {
            const p = textPatch(
              text,
              JSON.stringify({ ...sheet, columns: sheet.columns + 1 }, null, 2),
            );
            replace(p.start, p.length, p.text);
          }}
        >
          + Colonna
        </button>
        <button
          onClick={() =>
            download(
              name.replace(/\.sheet\.json$/i, ".csv"),
              sheetCsv(sheet),
              "text/csv;charset=utf-8",
            )
          }
        >
          Esporta CSV
        </button>
      </div>
      <ToolMenu label="Tabelle e grafici">
        <div
          className="sheet-data-tools"
          role="toolbar"
          aria-label="Tabelle e grafici"
        >
          <label>
            Intervallo
            <input
              aria-label="Intervallo tabella o grafico"
              value={range}
              onChange={(e) => setRange(e.target.value.toUpperCase())}
            />
          </label>
          <label>
            Titolo
            <input
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <button
            disabled={readOnly}
            onClick={() =>
              attempt(() => ({
                ...sheet,
                tables: [
                  ...(sheet.tables ?? []),
                  { id: crypto.randomUUID(), name: title, range },
                ],
              }))
            }
          >
            Crea tabella
          </button>
          <label>
            Tipo grafico
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value as typeof chartType)}
            >
              <option value="bar">Barre</option>
              <option value="line">Linee</option>
              <option value="pie">Torta</option>
            </select>
          </label>
          <button
            disabled={readOnly}
            onClick={() =>
              attempt(() => {
                const a = rangeCells(sheet, range);
                if (a.right <= a.left || a.bottom <= a.top)
                  throw Error(
                    "Il grafico richiede intestazioni e almeno due colonne.",
                  );
                return {
                  ...sheet,
                  charts: [
                    ...(sheet.charts ?? []),
                    { id: crypto.randomUUID(), title, range, type: chartType },
                  ],
                };
              })
            }
          >
            Crea grafico
          </button>
          <label>
            Tabella
            <select
              aria-label="Tabella"
              value={activeTable}
              onChange={(e) => {
                setActiveTable(e.target.value);
                setFilter("");
                setScroll(0);
              }}
            >
              <option value="">Nessuna</option>
              {sheet.tables?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.range}
                </option>
              ))}
            </select>
          </label>
          {table && (
            <>
              <label>
                Filtra tabella
                <input
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setScroll(0);
                  }}
                />
              </label>
              <button
                disabled={readOnly}
                onClick={() =>
                  attempt(() =>
                    sortTable(sheet, table, selected.charCodeAt(0) - 65),
                  )
                }
              >
                Ordina crescente
              </button>
              <button
                disabled={readOnly}
                onClick={() =>
                  attempt(() =>
                    sortTable(sheet, table, selected.charCodeAt(0) - 65, true),
                  )
                }
              >
                Ordina decrescente
              </button>
              <button
                disabled={readOnly}
                onClick={() => {
                  commit({
                    ...sheet,
                    tables: sheet.tables?.filter((t) => t.id !== table.id),
                  });
                  setActiveTable("");
                }}
              >
                Rimuovi tabella
              </button>
            </>
          )}
        </div>
      </ToolMenu>
      {error && <p role="alert">{error}</p>}
      <label className="formula-bar">
        <strong>{selected}</strong>
        <span>ƒx</span>
        <input
          aria-label="Formula o valore"
          disabled={readOnly}
          value={formula ?? cell.value}
          onChange={(e) => setFormula(e.target.value)}
          onBlur={() => {
            if (formula !== undefined) update(selected, { value: formula });
            setFormula(undefined);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
      </label>
      <p className="muted">
        Formule: =A1+B1, =SUM(A1:A5), AVERAGE, MIN, MAX, COUNT, COUNTA. Incolla
        righe e colonne con Tab; seleziona una cella; Invio conferma.
        Salvataggio dopo uscita dalla cella.
      </p>
      <div
        className="sheet-scroll"
        onScroll={(e) => setScroll(e.currentTarget.scrollTop)}
      >
        <table aria-label="Foglio di calcolo">
          <thead>
            <tr>
              <th></th>
              {Array.from({ length: sheet.columns }, (_, c) => (
                <th key={c} scope="col">
                  {columnName(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {start > 0 && (
              <tr aria-hidden="true">
                <td
                  colSpan={sheet.columns + 1}
                  style={{ height: start * 36, padding: 0 }}
                />
              </tr>
            )}
            {visibleRows.map((r) => (
              <tr key={r}>
                <th scope="row">{r + 1}</th>
                {Array.from({ length: sheet.columns }, (_, c) => {
                  const id = columnName(c) + (r + 1),
                    cell = sheet.cells[id],
                    value = evaluate(id);
                  const result =
                    typeof value === "number" && cell?.format === "currency"
                      ? new Intl.NumberFormat("it-IT", {
                          style: "currency",
                          currency: "EUR",
                        }).format(value)
                      : typeof value === "number" && cell?.format === "percent"
                        ? new Intl.NumberFormat("it-IT", {
                            style: "percent",
                          }).format(value)
                        : String(value);
                  return (
                    <td
                      key={id}
                      className={`${selected === id ? "selected" : ""} ${
                        sheet.tables?.some((t) => {
                          const a = rangeCells(sheet, t.range);
                          return (
                            r >= a.top &&
                            r <= a.bottom &&
                            c >= a.left &&
                            c <= a.right
                          );
                        })
                          ? "table-cell"
                          : ""
                      }`}
                      style={{
                        fontWeight: cell?.bold ? "bold" : undefined,
                        fontStyle: cell?.italic ? "italic" : undefined,
                        color: cell?.color,
                        background: cell?.background,
                        textAlign: cell?.align,
                      }}
                    >
                      {editing ? (
                        <CellInput
                          id={id}
                          value={cell?.value ?? ""}
                          disabled={readOnly}
                          select={() => {
                            setSelected(id);
                            setFormula(undefined);
                          }}
                          save={(value) => update(id, { value })}
                          paste={(value) =>
                            attempt(() => pasteCells(sheet, id, value))
                          }
                        />
                      ) : (
                        <button
                          aria-label={`Cella ${id}: ${result}`}
                          onClick={() => {
                            setSelected(id);
                            setFormula(undefined);
                          }}
                          onDoubleClick={() => setEditing(true)}
                        >
                          {result || "\u00a0"}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {start + visibleRows.length < rows.length && (
              <tr aria-hidden="true">
                <td
                  colSpan={sheet.columns + 1}
                  style={{
                    height: (rows.length - start - visibleRows.length) * 36,
                    padding: 0,
                  }}
                />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="sheet-charts">
        {sheet.charts?.map((chart) => (
          <div key={chart.id}>
            <Chart sheet={sheet} chart={chart} />
            <button
              disabled={readOnly}
              onClick={() =>
                commit({
                  ...sheet,
                  charts: sheet.charts?.filter((c) => c.id !== chart.id),
                })
              }
            >
              Rimuovi grafico {chart.title}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
