export const templates = [
  {
    id: "blank",
    label: "Vuoto",
    name: "senza-titolo.txt",
    text: "",
    note: "Documento visuale; gli stili richiedono il formato UltraPad.",
  },
  {
    id: "diary",
    label: "Diario",
    name: "diario.md",
    text: "# Diario\n\n## Oggi\n\n### Come mi sento\n\n### Cosa è successo\n\n### Una cosa da ricordare\n",
    note: "Markdown con anteprima.",
  },
  {
    id: "todo",
    label: "Lista TODO",
    name: "todo.txt",
    text: "Da fare\nPrima attività\nSeconda attività\n",
    note: "Documento con checkbox interattive.",
    delta: [
      { insert: "Da fare\n" },
      { insert: "Prima attività" },
      { insert: "\n", attributes: { list: "unchecked" } },
      { insert: "Seconda attività" },
      { insert: "\n", attributes: { list: "unchecked" } },
    ],
  },
  ...(["giornaliero", "settimanale", "mensile", "annuale"] as const).map(
    (period, i) => ({
      id: period,
      label: `Planner ${period}`,
      name: `planner-${period}.md`,
      text: `# Planner ${period}\n\n## Obiettivi\n\n${(i === 0 ? ["Mattina", "Pomeriggio", "Sera"] : i === 1 ? ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"] : i === 2 ? ["Settimana 1", "Settimana 2", "Settimana 3", "Settimana 4", "Settimana 5"] : ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"]).map((v) => `## ${v}\n\n- [ ] \n`).join("\n")}\n## Bilancio\n`,
      note: "Markdown: sezioni modificabili e anteprima.",
    }),
  ),
  {
    id: "meeting",
    label: "Verbale",
    name: "verbale.md",
    text: "# Riunione\n\nData: \nPartecipanti: \n\n## Agenda\n\n## Decisioni\n\n## Azioni e responsabili\n\n- [ ] Attività — responsabile — scadenza\n",
    note: "Markdown con anteprima.",
  },
  {
    id: "readme",
    label: "README",
    name: "README.md",
    text: "# Progetto\n\n## Obiettivo\n\n## Installazione\n\n```sh\n\n```\n\n## Utilizzo\n\n## Licenza\n",
    note: "Markdown con anteprima.",
  },
  {
    id: "spec",
    label: "Specifica tecnica",
    name: "specifica.md",
    text: "# Specifica\n\n## Problema\n\n## Requisiti\n\n## Architettura\n\n## Criteri di accettazione\n\n## Rischi\n",
    note: "Markdown con anteprima.",
  },
  {
    id: "thesis",
    label: "Tesi LaTeX",
    name: "tesi.tex",
    text: "\\documentclass{article}\n\\title{Titolo della tesi}\n\\author{Autore}\n\\begin{document}\n\\maketitle\n\\tableofcontents\n\\section{Introduzione}\n\\section{Metodo}\n\\section{Risultati}\n\\section{Conclusioni}\n\\end{document}\n",
    note: "Sorgente LaTeX; l’anteprima HTML non è un PDF compilato.",
  },
  {
    id: "notebook",
    label: "Notebook JS/Python",
    name: "notebook.md",
    text: "# Esperimento\n\n## Note\n\n```javascript\nconsole.log(2 + 2);\n```\n\n```python\nprint(sum([1, 2, 3]))\n```\n",
    note: "Celle eseguibili solo quando il servizio isolato è configurato.",
  },
  {
    id: "code",
    label: "Codice JavaScript",
    name: "esempio.js",
    text: "// Il tuo codice\nfunction somma(a, b) {\n  return a + b;\n}\n",
    note: "Sorgente modificabile; nessuna esecuzione automatica.",
  },
];
export default function Templates({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const t = templates.find((t) => t.id === value) ?? templates[0];
  return (
    <section className="template-picker">
      <label>
        Inizia da
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <p>{t.note}</p>
      {t.text && (
        <details>
          <summary>Anteprima del modello</summary>
          <pre className="preview">{t.text}</pre>
        </details>
      )}
    </section>
  );
}
