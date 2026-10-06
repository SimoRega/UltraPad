// Separate trusted service. Never install this inside the Cloudflare Worker.
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { timingSafeEqual, randomUUID } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
export function validateJob(job) {
  if (job.kind === "code") {
    if (
      !["javascript", "python"].includes(job.language) ||
      typeof job.code !== "string" ||
      Buffer.byteLength(job.code) > 32768
    )
      throw Error("INVALID_CODE");
  } else if (job.kind === "latex") {
    if (
      !Array.isArray(job.files) ||
      !job.files.length ||
      job.files.length > 30 ||
      !/^[a-zA-Z0-9_-]+\.tex$/.test(job.main)
    )
      throw Error("INVALID_MANIFEST");
    let size = 0;
    const seen = new Set();
    for (const f of job.files) {
      if (
        !/^[a-zA-Z0-9_-]+\.(tex|bib)$/.test(f.name) ||
        seen.has(f.name) ||
        typeof f.text !== "string"
      )
        throw Error("INVALID_MANIFEST");
      seen.add(f.name);
      size += Buffer.byteLength(f.text);
    }
    if (size > 1048576 || !seen.has(job.main)) throw Error("INVALID_MANIFEST");
  } else throw Error("INVALID_JOB");
  return job;
}
export function sandboxArgs({ name, image, dir, kind, language }) {
  if (!image || !/@sha256:[a-f0-9]{64}$/.test(image))
    throw Error("PINNED_IMAGE_REQUIRED");
  return [
    "run",
    "--rm",
    "--name",
    name,
    "--runtime=runsc",
    "--network=none",
    "--read-only",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--user=65534:65534",
    "--memory=256m",
    "--memory-swap=256m",
    "--cpus=1",
    "--pids-limit=32",
    "--ulimit",
    "fsize=8388608:8388608",
    "--ulimit",
    "nofile=64:64",
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,size=64m,mode=1777",
    "--mount",
    `type=bind,src=${dir},dst=/input,readonly`,
    "--workdir",
    "/tmp",
    image,
    ...(kind === "latex"
      ? ["python3", "/opt/compile.py"]
      : language === "javascript"
        ? ["node", "/input/cell.js"]
        : ["python3", "-I", "/input/cell.py"]),
  ];
}
function execute(args, signal, ms, limit = 8 * 1024 * 1024) {
  return new Promise((resolve) => {
    const p = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "",
      err = "",
      size = 0,
      reason = "";
    const stop = (r) => {
      reason = r;
      p.kill("SIGKILL");
    };
    const timer = setTimeout(() => stop("TIMEOUT"), ms);
    const abort = () => stop("CANCELLED");
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    for (const [stream, key] of [
      [p.stdout, "out"],
      [p.stderr, "err"],
    ])
      stream.on("data", (v) => {
        size += v.length;
        if (size > limit) stop("OUTPUT_LIMIT");
        else if (key === "out") out += v;
        else err += v;
      });
    p.on("error", () => {
      reason = "SANDBOX_UNAVAILABLE";
    });
    p.on("close", (code) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      resolve({
        stdout: out.slice(0, 65536),
        stderr: err.slice(0, 65536),
        raw: out,
        exitCode: code,
        error: reason || undefined,
      });
    });
  });
}
let active = 0;
const users = new Set();
const controllers = new Map();
export function start() {
  const secret = process.env.RUNNER_TOKEN;
  if (!secret || secret.length < 32) throw Error("RUNNER_TOKEN_REQUIRED");
  return createServer(async (req, res) => {
    const authorization = Buffer.from(req.headers.authorization ?? "");
    const expected = Buffer.from(`Bearer ${secret}`);
    if (
      authorization.length !== expected.length ||
      !timingSafeEqual(authorization, expected)
    ) {
      res.writeHead(401).end();
      return;
    }
    if (req.method === "POST" && req.url === "/cancel") {
      const job = controllers.get(req.headers["x-job-id"]);
      if (job?.user === req.headers["x-job-user"]) job.controller.abort();
      res.writeHead(200, { "Content-Type": "application/json" }).end("{}");
      return;
    }
    if (req.method !== "POST" || req.url !== "/run") {
      res.writeHead(404).end();
      return;
    }
    let dir,
      name,
      user,
      registered = false;
    const controller = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) controller.abort();
    });
    try {
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (Buffer.byteLength(body) > 1200000) throw Error("BODY_LIMIT");
      }
      const job = validateJob(JSON.parse(body));
      user = req.headers["x-job-user"];
      if (typeof user !== "string" || !user) throw Error("USER_REQUIRED");
      if (active >= 4 || users.has(user)) {
        res.writeHead(429).end();
        return;
      }
      const jobId = req.headers["x-job-id"];
      if (
        typeof jobId !== "string" ||
        !/^[a-f0-9-]{36}$/.test(jobId) ||
        controllers.has(jobId)
      )
        throw Error("JOB_ID_REQUIRED");
      users.add(user);
      active++;
      registered = true;
      controllers.set(jobId, { user, controller });
      dir = await mkdtemp(join(tmpdir(), "ultrapad-"));
      name = "ultrapad-" + randomUUID();
      if (job.kind === "code")
        await writeFile(
          join(dir, job.language === "javascript" ? "cell.js" : "cell.py"),
          job.code,
          { mode: 0o644 },
        );
      else {
        for (const f of job.files)
          await writeFile(join(dir, f.name), f.text, { mode: 0o644 });
        await writeFile(
          join(dir, "manifest.json"),
          JSON.stringify({ main: job.main }),
          { mode: 0o644 },
        );
      }
      // A bind directory must be readable by the unprivileged container user.
      const { chmod } = await import("node:fs/promises");
      await chmod(dir, 0o755);
      const result = await execute(
        sandboxArgs({
          name,
          dir,
          kind: job.kind,
          language: job.language,
          image:
            job.kind === "latex"
              ? process.env.LATEX_IMAGE
              : process.env.CODE_IMAGE,
        }),
        controller.signal,
        job.kind === "latex" ? 60000 : 10000,
        job.kind === "latex" ? 8 * 1024 * 1024 : 65536,
      );
      let response = {
        runtime:
          job.kind === "latex"
            ? process.env.LATEX_IMAGE
            : process.env.CODE_IMAGE,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        error: result.error,
      };
      if (job.kind === "latex" && !result.error && result.exitCode === 0) {
        try {
          response = JSON.parse(result.raw);
        } catch {
          response.error = "INVALID_SANDBOX_RESULT";
        }
      }
      response.runtime =
        job.kind === "latex" ? process.env.LATEX_IMAGE : process.env.CODE_IMAGE;
      res
        .writeHead(200, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        })
        .end(JSON.stringify(response));
    } catch (e) {
      res
        .writeHead(400, { "Content-Type": "application/json" })
        .end(JSON.stringify({ error: e.message }));
    } finally {
      if (name)
        await execute(["rm", "-f", name], new AbortController().signal, 5000);
      if (dir) await rm(dir, { recursive: true, force: true });
      if (registered) {
        controllers.delete(req.headers["x-job-id"]);
        if (users.delete(user)) active--;
      }
    }
  }).listen(Number(process.env.PORT ?? 8090), "127.0.0.1");
}
if (process.argv[1] === new URL(import.meta.url).pathname) start();
