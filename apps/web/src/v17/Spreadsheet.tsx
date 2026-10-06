import { useRef, useState } from "react";
import {
  cellValue,
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
}: {
  id: string;
  value: string;
  disabled: boolean;
  select: () => void;
  save: (value: string) => void;
}) {
  const [draft, setDraft] = useState<string>();
  const cancelled = useRef(false);
  return (
    <input
      aria-label={`Cella ${id}`}
      disabled={disabled}
      value={draft ?? value}
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
  let sheet;
  try {
    sheet = parseSheet(text);
  } catch (e) {
    return (
      <div role="alert">
        <p>{(e as Error).message}</p>
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
        Formule: =A1+B1, =SUM(A1:A5), AVERAGE, MIN, MAX. Seleziona una cella;
        Invio conferma. Salvataggio dopo uscita dalla cella.
      </p>
      <div className="sheet-scroll">
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
            {Array.from({ length: sheet.rows }, (_, r) => (
              <tr key={r}>
                <th scope="row">{r + 1}</th>
                {Array.from({ length: sheet.columns }, (_, c) => {
                  const id = columnName(c) + (r + 1),
                    cell = sheet.cells[id],
                    value = cellValue(sheet, id);
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
                      className={selected === id ? "selected" : ""}
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
          </tbody>
        </table>
      </div>
    </section>
  );
}
