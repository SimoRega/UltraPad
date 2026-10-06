import { expect, it } from "vitest";
import { parseRtf } from "./rtf";
it("preserves unicode and basic styles and excludes object content", () => {
  const ops = parseRtf(
    "{\\rtf1\\ansi hello \\b bold\\b0 \\par \\u224?{\\*\\object hidden}}",
  );
  expect(ops.map((o) => o.insert).join("")).toContain("hello bold\nà");
  expect(ops.some((o) => o.attributes?.bold)).toBe(true);
  expect(ops.map((o) => o.insert).join("")).not.toContain("hidden");
});
it("rejects oversized, malformed and binary RTF", () => {
  expect(() => parseRtf("x")).toThrow();
  expect(() => parseRtf("{\\rtf1\\bin2 xx}")).toThrow();
  expect(() => parseRtf("{\\rtf1" + "{".repeat(257))).toThrow();
});
