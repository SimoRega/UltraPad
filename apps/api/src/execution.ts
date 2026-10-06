import type { Env } from "./db";
export function codeCells(text: string) {
  return [
    ...text.matchAll(/^```(javascript|js|python|py)\s*\n([\s\S]*?)^```\s*$/gm),
  ].map((m) => ({
    language: /^(js|javascript)$/.test(m[1]) ? "javascript" : "python",
    code: m[2],
    offset: m.index!,
  }));
}
export async function execute(
  env: Env,
  user: string,
  job: unknown,
  jobId: string,
) {
  if (!env.RUNNER_URL || !env.RUNNER_TOKEN)
    throw new Error("RUNNER_NOT_CONFIGURED");
  const url = new URL(env.RUNNER_URL);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("RUNNER_CONFIGURATION");
  const response = await fetch(new URL("/run", url), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RUNNER_TOKEN}`,
      "X-Job-User": user,
      "X-Job-Id": jobId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(job),
    signal: AbortSignal.timeout(65000),
  });
  if (!response.ok)
    throw new Error(
      response.status === 429 ? "RUNNER_BUSY" : "RUNNER_UNAVAILABLE",
    );
  const text = await response.text();
  if (text.length > 6 * 1024 * 1024) throw new Error("RUNNER_RESULT_LIMIT");
  return JSON.parse(text) as {
    stdout: string;
    stderr?: string;
    error?: string;
    exitCode: number;
    pdf?: string;
  };
}

export async function cancelExecution(env: Env, user: string, jobId: string) {
  if (!env.RUNNER_URL || !env.RUNNER_TOKEN)
    throw Error("RUNNER_NOT_CONFIGURED");
  const url = new URL(env.RUNNER_URL);
  if (url.protocol !== "https:") throw Error("RUNNER_CONFIGURATION");
  const r = await fetch(new URL("/cancel", url), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RUNNER_TOKEN}`,
      "X-Job-User": user,
      "X-Job-Id": jobId,
    },
    signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) throw Error("RUNNER_UNAVAILABLE");
}
