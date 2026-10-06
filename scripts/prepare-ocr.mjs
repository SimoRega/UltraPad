import { createRequire } from "node:module";
import { mkdir, copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
const require = createRequire(import.meta.url);
const root = dirname(require.resolve("tesseract.js/package.json"));
const internal = createRequire(join(root, "package.json"));
const core = dirname(internal.resolve("tesseract.js-core/package.json"));
const target = new URL("../apps/web/public/ocr/", import.meta.url);
await mkdir(target, { recursive: true });
await copyFile(
  join(root, "dist/worker.min.js"),
  new URL("worker.min.js", target),
);
for (const name of [
  "tesseract-core-lstm.wasm.js",
  "tesseract-core-simd-lstm.wasm.js",
])
  await copyFile(join(core, name), new URL(name, target));
for (const lang of ["ita", "eng"])
  await copyFile(
    join(
      dirname(require.resolve(`@tesseract.js-data/${lang}/package.json`)),
      "4.0.0",
      `${lang}.traineddata.gz`,
    ),
    new URL(`${lang}.traineddata.gz`, target),
  );
