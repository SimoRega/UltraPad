import { test, expect, type Page } from "@playwright/test";
const project = "20000000-0000-4000-8000-000000000001";
type Item = {
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
async function board(page: Page, viewer = false, connections = false) {
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
  let fail = false;
  await page.route("**/api/v1/projects/*/board", (r) =>
    r.fulfill({ json: items }),
  );
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
    get items() {
      return items;
    },
    set fail(v: boolean) {
      fail = v;
    },
  };
}
async function draw(page: Page) {
  const box = (await page.locator(".board-viewport").boundingBox())!;
  await page.mouse.move(box.x + 280, box.y + 190);
  await page.mouse.down();
  await page.mouse.move(box.x + 330, box.y + 220, { steps: 10 });
  await page.mouse.move(box.x + 390, box.y + 190, { steps: 10 });
  await page.mouse.up();
}
test("v1.9 mouse drag accounts for zoom/scroll, updates edges and supports undo", async ({
  page,
}) => {
  const state = await board(page, false, true);
  const zoom = page.getByLabel("Zoom", { exact: true });
  await zoom.fill("0.5");
  const card = page
    .locator(".board-card")
    .filter({ hasText: "Sposta questa nota" });
  const before = (await card.boundingBox())!;
  await page.mouse.move(before.x + 30, before.y + 15);
  await page.mouse.down();
  await page.mouse.move(before.x + 90, before.y + 55, { steps: 5 });
  await expect(page.locator(".board-lines line")).toHaveAttribute("x1", "130");
  await page.mouse.up();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.writes[0]).toMatchObject({ x: 160, y: 120, version: 2 });
  await page.getByRole("button", { name: "Annulla mia modifica" }).click();
  await expect
    .poll(() => state.items.find((i) => i.kind === "note")!.x)
    .toBe(40);
  await expect(
    page.getByRole("button", { name: "Seleziona / sposta", exact: true }),
  ).toBeEnabled();
  await zoom.fill("1.5");
  await page.locator(".board-viewport").evaluate((el) => {
    el.scrollLeft = 30;
    el.scrollTop = 20;
  });
  const scrolled = (await card.boundingBox())!;
  await page.mouse.move(scrolled.x + 30, scrolled.y + 15);
  await page.mouse.down();
  await page.mouse.move(scrolled.x + 90, scrolled.y + 45, { steps: 5 });
  await page.mouse.up();
  await expect
    .poll(() => state.items.find((i) => i.kind === "note")!.x)
    .toBe(80);
  expect(state.items.find((i) => i.kind === "note")!.y).toBe(60);
  const count = state.writes.length;
  await card.getByRole("button", { name: "Modifica", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Modifica scheda" }),
  ).toBeVisible();
  expect(state.writes.length).toBe(count);
});
test("v1.9 brush color/width, reload, move stroke, export, undo and list", async ({
  page,
}) => {
  const state = await board(page);
  await page.getByRole("button", { name: "Pennello", exact: true }).click();
  await page.getByLabel("Colore pennello").fill("#ef1234");
  await page.getByLabel("Spessore pennello").fill("8");
  await draw(page);
  await expect.poll(() => state.writes.length).toBe(1);
  const stroke = state.items.find((i) => i.kind === "stroke")!;
  expect(stroke.color).toBe("#ef1234");
  expect(JSON.parse(stroke.body).width).toBe(8);
  expect(JSON.parse(stroke.body).points.length).toBeGreaterThan(2);
  await expect(page.locator(".board-strokes path")).toHaveAttribute(
    "stroke",
    "#ef1234",
  );
  await page.reload();
  await page.getByRole("button", { name: "Lavagna", exact: true }).click();
  await expect(page.locator(".board-strokes path")).toHaveCount(1);
  const box = (await page.locator(".board-canvas").boundingBox())!;
  await page.mouse.move(box.x + stroke.x, box.y + stroke.y);
  await page.mouse.down();
  await page.mouse.move(box.x + stroke.x + 40, box.y + stroke.y + 30, {
    steps: 5,
  });
  await page.mouse.up();
  await expect
    .poll(() => state.items.find((i) => i.kind === "stroke")!.x)
    .toBe(stroke.x + 40);
  await page.getByRole("button", { name: "Annulla mia modifica" }).click();
  await expect
    .poll(() => state.items.find((i) => i.kind === "stroke")!.x)
    .toBe(stroke.x);
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Esporta lavagna", exact: true })
    .click();
  const stream = await (await pending).createReadStream();
  let value = "";
  for await (const part of stream!) value += part;
  expect(
    JSON.parse(value).items.some(
      (i: Item) => i.kind === "stroke" && i.body === stroke.body,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Vista elenco" }).click();
  await expect(page.locator(".board-list")).toContainText(
    "Disegno a mano libera",
  );
});
test("v1.9 Escape/right mouse cancel; failed save retains drawing until retry", async ({
  page,
}) => {
  const state = await board(page);
  await page.getByRole("button", { name: "Pennello", exact: true }).click();
  const box = (await page.locator(".board-viewport").boundingBox())!;
  await page.mouse.move(box.x + 300, box.y + 180);
  await page.mouse.down();
  await page.mouse.move(box.x + 350, box.y + 220);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.locator(".board-strokes path")).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
  await page.mouse.click(box.x + 300, box.y + 180, { button: "right" });
  expect(state.writes).toHaveLength(0);
  state.fail = true;
  await draw(page);
  await expect(page.getByRole("alert")).toContainText(
    "Salvataggio non riuscito",
  );
  await expect(page.locator(".board-strokes path")).toHaveCount(1);
  state.fail = false;
  await page.getByRole("button", { name: "Riprova salvataggio" }).click();
  await expect.poll(() => state.writes.length).toBe(1);
  await expect(
    page.getByRole("button", { name: "Riprova salvataggio" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Annulla mia modifica" }).click();
  await expect(page.locator(".board-strokes path")).toHaveCount(0);
});
test("v1.9 viewer can inspect the board but cannot move or draw", async ({
  page,
}) => {
  const state = await board(page, true);
  await expect(
    page.getByRole("button", { name: "Pennello", exact: true }),
  ).toHaveCount(0);
  const box = (await page
    .locator(".board-card")
    .filter({ hasText: "Sposta questa nota" })
    .boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 15);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 80);
  await page.mouse.up();
  expect(state.writes).toHaveLength(0);
  expect(state.items.find((i) => i.kind === "note")!.x).toBe(40);
});
test("v1.9 brush click creates a dot and failed local edits can be discarded", async ({
  page,
}) => {
  const state = await board(page);
  await page.getByRole("button", { name: "Pennello", exact: true }).click();
  const box = (await page.locator(".board-viewport").boundingBox())!;
  await page.mouse.click(box.x + 300, box.y + 180);
  await expect.poll(() => state.writes.length).toBe(1);
  expect(JSON.parse(state.writes[0].body).points).toHaveLength(1);
  await expect(
    page.getByRole("button", { name: "Pennello", exact: true }),
  ).toBeEnabled();
  state.fail = true;
  await draw(page);
  await expect(page.getByRole("alert")).toContainText(
    "Salvataggio non riuscito",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".board-strokes path")).toHaveCount(2);
  await page.getByRole("button", { name: "Scarta modifica locale" }).click();
  await expect(page.locator(".board-strokes path")).toHaveCount(1);
  expect(state.writes).toHaveLength(1);
});
