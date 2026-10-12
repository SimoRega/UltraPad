import { it, expect } from "vitest";
import { parseSession, ancestors } from "../../../apps/web/src/v112/session";
it("restores only bounded deduplicated file IDs and references already in tabs", () => {
  expect(
    parseSession({
      tabs: ["abc", "abc", "bad/path", 3],
      active: "abc",
      secondary: "missing",
    }),
  ).toEqual({ tabs: ["abc"], active: "abc", secondary: undefined });
  expect(parseSession(null)).toEqual({ tabs: [] });
  expect(
    parseSession({ tabs: Array.from({ length: 100 }, (_, i) => String(i)) })
      .tabs,
  ).toHaveLength(50);
});
it("breadcrumb ancestry is ordered and stops corrupt cycles or inaccessible parents", () => {
  const rows = [
    { id: "root", parent_id: null },
    { id: "sub", parent_id: "root" },
    { id: "file", parent_id: "sub" },
  ];
  expect(ancestors(rows[2], rows).map((r) => r.id)).toEqual(["root", "sub"]);
  expect(ancestors({ id: "file", parent_id: "missing" }, rows)).toEqual([]);
  expect(
    ancestors({ id: "a", parent_id: "b" }, [{ id: "b", parent_id: "a" }]),
  ).toEqual([{ id: "b", parent_id: "a" }]);
});
