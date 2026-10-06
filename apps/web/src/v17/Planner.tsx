import { useState } from "react";
export function plannerPeriod(name: string) {
  return name
    .match(/^planner-(giornaliero|settimanale|mensile|annuale)\.md$/i)?.[1]
    .toLowerCase();
}
export function sections(text: string) {
  const matches = [...text.matchAll(/^## (.+)$/gm)];
  return matches.map((m, i) => {
    const start = m.index! + m[0].length + 1,
      end = matches[i + 1]?.index ?? text.length;
    return { title: m[1], start, end, value: text.slice(start, end) };
  });
}
function Entry({
  title,
  label,
  value,
  readOnly,
  save,
}: {
  title: string;
  label?: string;
  value: string;
  readOnly: boolean;
  save: (v: string) => void;
}) {
  const [draft, setDraft] = useState<string>();
  return (
    <label className="planner-entry">
      <strong>{label ?? title}</strong>
      <textarea
        aria-label={title}
        disabled={readOnly}
        value={draft ?? value.trim()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== undefined) {
            save("\n" + draft + "\n\n");
            setDraft(undefined);
          }
        }}
        placeholder="Attività, orari, note…"
      />
    </label>
  );
}
export default function Planner({
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
  const period = plannerPeriod(name),
    entries = sections(text),
    dateMatch = text.match(/^Data: (\d{4}-\d{2}-\d{2})$/m),
    dateValue = dateMatch?.[1] ?? new Date().toLocaleDateString("sv-SE");
  const date = new Date(dateValue + "T12:00:00");
  const validDate = !Number.isNaN(date.getTime()),
    days = validDate
      ? new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
      : 31;
  function saveDate(value: string) {
    if (!value) return;
    if (dateMatch) replace(dateMatch.index! + 6, 10, value);
    else {
      const index = text.indexOf("\n") + 1;
      replace(index, 0, `\nData: ${value}\n`);
    }
  }
  const calendar = entries.filter(
    (e) => !["Obiettivi", "Bilancio"].includes(e.title),
  );
  const notes = entries.filter((e) =>
    ["Obiettivi", "Bilancio"].includes(e.title),
  );
  function entry(e: (typeof entries)[number], label?: string) {
    return (
      <Entry
        key={e.title}
        title={e.title}
        label={label}
        value={e.value}
        readOnly={readOnly}
        save={(v) => replace(e.start, e.end - e.start, v)}
      />
    );
  }
  return (
    <section className="planner">
      <header>
        <h2>Planner {period}</h2>
        <label>
          Data di riferimento
          <input
            type="date"
            disabled={readOnly}
            value={dateValue}
            onChange={(e) => saveDate(e.target.value)}
          />
        </label>
        <p>
          {validDate &&
            date.toLocaleDateString("it-IT", {
              month: "long",
              year: "numeric",
            })}{" "}
          · attività conservate nel file Markdown
        </p>
      </header>
      {notes.filter((e) => e.title === "Obiettivi").map((e) => entry(e))}
      <div className={`planner-calendar ${period}`}>
        {period === "mensile" && (
          <>
            {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((d) => (
              <strong key={d}>{d}</strong>
            ))}
            {validDate &&
              Array.from(
                {
                  length:
                    (new Date(date.getFullYear(), date.getMonth(), 1).getDay() +
                      6) %
                    7,
                },
                (_, i) => <span key={i} />,
              )}
          </>
        )}
        {calendar.map((e, i) => {
          if (
            period === "mensile" &&
            /^Giorno \d+$/.test(e.title) &&
            Number(e.title.slice(7)) > days
          )
            return null;
          let label = e.title;
          if (validDate && period === "settimanale" && i < 7) {
            const d = new Date(date);
            d.setDate(date.getDate() - ((date.getDay() + 6) % 7) + i);
            label =
              e.title +
              " " +
              d.toLocaleDateString("it-IT", {
                day: "numeric",
                month: "numeric",
              });
          }
          return entry(e, label);
        })}
      </div>
      {notes.filter((e) => e.title === "Bilancio").map((e) => entry(e))}
      {!entries.length && (
        <p>
          Aggiungi sezioni «## Giorno» dal sorgente per usare il calendario.
        </p>
      )}
    </section>
  );
}
