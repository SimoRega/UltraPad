import { test } from "node:test";
import assert from "node:assert/strict";
import { validateJob, sandboxArgs } from "./server.mjs";
test("sandbox is mandatory, pinned, unprivileged and has no network", () => {
  const args = sandboxArgs({
    name: "t",
    image: "test@sha256:" + "a".repeat(64),
    dir: "/tmp/test",
    kind: "code",
    language: "python",
  });
  for (const flag of [
    "--runtime=runsc",
    "--network=none",
    "--read-only",
    "--cap-drop=ALL",
    "--user=65534:65534",
    "--memory=256m",
    "--pids-limit=32",
  ])
    assert.ok(args.includes(flag));
  assert.throws(() => sandboxArgs({ image: "node:latest" }));
});
test("rejects executable manifests, path traversal, duplicate sources and oversized cells", () => {
  for (const name of ["../x.tex", "/x.tex", "shell.sh", "x.tex;id"])
    assert.throws(() =>
      validateJob({ kind: "latex", main: name, files: [{ name, text: "x" }] }),
    );
  assert.throws(() =>
    validateJob({ kind: "code", language: "python", code: "a".repeat(32769) }),
  );
  assert.throws(() =>
    validateJob({
      kind: "latex",
      main: "a.tex",
      files: [
        { name: "a.tex", text: "a" },
        { name: "a.tex", text: "b" },
      ],
    }),
  );
  assert.equal(
    validateJob({
      kind: "code",
      language: "javascript",
      code: "console.log(1)",
    }).kind,
    "code",
  );
});
