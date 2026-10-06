// Restricted preview support. PDF builds use the real xcolor package in the sandbox.
export class LatexColors {
  static args = {
    uptextcolor: ["H", "i?", "k", "g"],
    upcolorbox: ["H", "i?", "k", "g"],
    updefinecolor: ["P", "i", "i", "k"],
  };
  private colors = new Map<string, string>();
  private css = (model: string | null, color: string) => {
    const defined = this.colors.get(color);
    if (defined) return defined;
    let value = color;
    if (model === "HTML" && /^[a-f0-9]{6}$/i.test(color)) value = "#" + color;
    else if (model === "RGB" || model === "rgb") {
      const channels = color.split(",").map(Number);
      if (
        channels.length !== 3 ||
        channels.some(
          (n) =>
            !Number.isFinite(n) || n < 0 || n > (model === "RGB" ? 255 : 1),
        )
      )
        throw Error("Colore RGB non valido");
      value = `rgb(${channels.map((n) => Math.round(n * (model === "RGB" ? 1 : 255))).join(",")})`;
    } else if (model && model !== "named")
      throw Error("Modello colore non supportato nell’anteprima");
    if (!CSS.supports("color", value) || /url|var\(|currentColor/i.test(value))
      throw Error("Colore non supportato nell’anteprima");
    return value;
  };
  updefinecolor = (name: string, model: string, color: string) => {
    this.colors.set(name, this.css(model, color));
  };
  uptextcolor = (
    model: string | null,
    color: string,
    group: DocumentFragment,
  ) => {
    const node = document.createElement("span");
    node.style.color = this.css(model, color);
    node.appendChild(group as unknown as Node);
    return [node];
  };
  upcolorbox = (
    model: string | null,
    color: string,
    group: DocumentFragment,
  ) => {
    const node = document.createElement("span");
    node.style.backgroundColor = this.css(model, color);
    node.appendChild(group as unknown as Node);
    return [node];
  };
}

export function previewColorMacros(text: string) {
  // KaTeX already implements color in math; leave those expressions untouched.
  return text
    .split(
      /(\$\$[\s\S]*?\$\$|(?<!\\)\$(?:\\.|[^$])*\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g,
    )
    .map((part, i) =>
      i % 2
        ? part
        : part.replace(/\\(textcolor|colorbox|definecolor)\b/g, "\\up$1"),
    )
    .join("");
}
