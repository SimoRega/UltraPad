export const thesisFiles = [
  {
    name: "main.tex",
    text: "\\documentclass{report}\n\\usepackage[utf8]{inputenc}\n\\usepackage{xcolor}\n\\title{Titolo della tesi}\n\\author{Autore}\n\\begin{document}\n\\maketitle\n\\tableofcontents\n\\include{introduzione}\n\\include{metodo}\n\\include{risultati}\n\\bibliographystyle{plain}\n\\bibliography{bibliografia}\n\\end{document}\n",
  },
  {
    name: "introduzione.tex",
    text: "\\chapter{Introduzione}\nObiettivi e contesto. Un riferimento: \\cite{esempio}.\n",
  },
  {
    name: "metodo.tex",
    text: "\\chapter{Metodo}\nDescrivi il metodo e i materiali.\n",
  },
  {
    name: "risultati.tex",
    text: "\\chapter{Risultati e conclusioni}\nDescrivi i risultati e le prospettive.\n",
  },
  {
    name: "bibliografia.bib",
    text: "@book{esempio,\n  author = {Mario Rossi},\n  title = {Titolo di esempio},\n  year = {2026},\n  publisher = {Editore}\n}\n",
  },
];
