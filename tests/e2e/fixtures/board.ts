import { expect, type Page } from "@playwright/test";
const project = "20000000-0000-4000-8000-000000000001";
export type Item = {
  id: string;
  project_id: string;
  kind: string;
  body: string;
  x: number;
  y: number;
  color: string;
  version: number;
  source?: string;
  target?: string;
};
export async function board(page: Page, viewer = false, connections = false) {
  await page.addInitScript(() => {
    const uid = "00000000-0000-4000-8000-000000000001",
      expires = Math.floor(Date.now() / 1000) + 3600;
    const jwt =
      btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })) +
      "." +
      btoa(
        JSON.stringify({
          sub: uid,
          exp: expires,
          iat: expires - 3600,
          aud: "authenticated",
          role: "authenticated",
        }),
      ) +
      ".test-signature";
    localStorage.setItem(
      "sb-localhost-auth-token",
      JSON.stringify({
        access_token: jwt,
        refresh_token: "test-only-refresh",
        expires_at: expires,
        expires_in: 3600,
        token_type: "bearer",
        user: {
          id: uid,
          aud: "authenticated",
          role: "authenticated",
          email: "test@example.invalid",
          app_metadata: {},
          user_metadata: {},
          created_at: new Date().toISOString(),
        },
      }),
    );
  });
  let items: Item[] = [
    {
      id: crypto.randomUUID(),
      project_id: project,
      kind: "note",
      body: "Sposta questa nota",
      x: 40,
      y: 40,
      color: "#fff2b3",
      version: 1,
    },
  ];
  if (connections)
    items.push(
      {
        id: crypto.randomUUID(),
        project_id: project,
        kind: "group",
        body: "Gruppo",
        x: 300,
        y: 120,
        color: "#fff2b3",
        version: 1,
      },
      {
        id: crypto.randomUUID(),
        project_id: project,
        kind: "edge",
        body: "",
        x: 0,
        y: 0,
        color: "#fff2b3",
        version: 1,
        source: items[0].id,
        target: undefined,
      },
    );
  if (connections) items[2].target = items[1].id;
  const writes: Item[] = [];
  let reads = 0;
  let fail = false;
  await page.route("**/api/v1/projects/*/board", (r) => {
    reads++;
    return r.fulfill({ json: items });
  });
  await page.route("**/api/v1/collaborate", async (r) => {
    const { op, args } = r.request().postDataJSON();
    if (fail) {
      await r.fulfill({ status: 409, json: { error: "BOARD_CONFLICT" } });
      return;
    }
    if (op === "board_delete") {
      items = items.filter((i) => i.id !== args.id);
      await r.fulfill({ json: {} });
      return;
    }
    const before = items.find((i) => i.id === args.id);
    if (before && before.version !== args.version) {
      await r.fulfill({ status: 409, json: { error: "BOARD_CONFLICT" } });
      return;
    }
    const next = { ...args, version: (before?.version ?? 0) + 1 };
    items = [...items.filter((i) => i.id !== next.id), next];
    writes.push(next);
    await r.fulfill({ json: next });
  });
  if (viewer)
    await page.route("**/api/v1/bootstrap", async (r) => {
      const response = await r.fetch(),
        data = await response.json();
      data.projects[0].role = "viewer";
      await r.fulfill({ json: data });
    });
  await page.goto(`/projects/${project}`);
  await page.getByRole("button", { name: "Lavagna", exact: true }).click();
  await expect(
    page.locator(".board-card").filter({ hasText: "Sposta questa nota" }),
  ).toContainText("Sposta questa nota");
  return {
    writes,
    get reads() {
      return reads;
    },
    get items() {
      return items;
    },
    set fail(v: boolean) {
      fail = v;
    },
  };
}
