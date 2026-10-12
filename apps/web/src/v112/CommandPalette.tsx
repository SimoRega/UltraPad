import { useState } from "react";
import { Modal } from "../Dialogs";
import type { MenuAction } from "./ContextMenu";
export default function CommandPalette({
  actions,
  close,
}: {
  actions: MenuAction[];
  close: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const rows = actions.filter(
    (a) =>
      !a.disabled &&
      a.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  function run(index: number) {
    const action = rows[index];
    if (action) {
      close();
      action.run();
    }
  }
  return (
    <Modal title="Palette comandi · Ctrl/⌘ Shift P" close={close}>
      <input
        autoFocus
        role="combobox"
        aria-expanded="true"
        aria-controls="command-options"
        aria-activedescendant={
          rows.length
            ? `command-${Math.min(selected, rows.length - 1)}`
            : undefined
        }
        aria-label="Cerca comando"
        placeholder="Scrivi un’azione…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setSelected((v) =>
              rows.length
                ? (v + (e.key === "ArrowDown" ? 1 : -1) + rows.length) %
                  rows.length
                : 0,
            );
          }
          if (e.key === "Enter") {
            e.preventDefault();
            run(Math.min(selected, rows.length - 1));
          }
        }}
      />
      <div
        className="command-options"
        id="command-options"
        role="listbox"
        aria-label="Comandi"
      >
        {rows.map((a, i) => (
          <button
            role="option"
            aria-selected={i === selected}
            id={`command-${i}`}
            key={a.label}
            onClick={() => run(i)}
          >
            {a.label}
          </button>
        ))}
      </div>
      {!rows.length && <p>Nessun comando trovato.</p>}
    </Modal>
  );
}
