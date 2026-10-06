import { expect, it } from "vitest";
import { previewColorMacros } from "../../../apps/web/src/v16/LatexColors";
it("adds text preview colors while preserving existing KaTeX color expressions", () => {
  expect(
    previewColorMacros(
      "\\textcolor{red}{text} $\\textcolor{blue}{x}$ \\[\\textcolor{green}{y}\\]",
    ),
  ).toBe(
    "\\uptextcolor{red}{text} $\\textcolor{blue}{x}$ \\[\\textcolor{green}{y}\\]",
  );
});
