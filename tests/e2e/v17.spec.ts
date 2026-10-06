import { test, expect, type Page } from "@playwright/test";
async function create(page: Page, template: string) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Continua senza account", exact: true })
    .click();
  await page.getByRole("button", { name: "+ Nuovo file", exact: true }).click();
  await page.getByLabel("Inizia da").selectOption(template);
  await page.getByRole("button", { name: "Crea", exact: true }).click();
}
test("v1.7 planner edits Markdown and survives reload", async ({ page }) => {
  await create(page, "settimanale");
  const monday = page.getByRole("textbox", { name: "Lunedì", exact: true });
  await monday.fill("- [ ] Allenamento 18:00");
  await page
    .getByRole("heading", { name: "Planner settimanale", exact: true })
    .click();
  await page.reload();
  await page
    .getByRole("button", { name: "planner-settimanale.md", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Lunedì", exact: true }),
  ).toHaveValue("- [ ] Allenamento 18:00");
  await page
    .getByRole("button", { name: "Sorgente testo", exact: true })
    .click();
  await expect(page.locator(".monaco")).toBeVisible();
  await page.getByRole("button", { name: "Calendario", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Lunedì", exact: true }),
  ).toHaveValue("- [ ] Allenamento 18:00");
});
test("v1.7 spreadsheet formulas, style, source and CSV export", async ({
  page,
}) => {
  await create(page, "sheet");
  await page
    .getByRole("button", { name: "Modifica celle", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Cella A1", exact: true }).fill("10");
  await page.getByRole("textbox", { name: "Cella A2", exact: true }).fill("20");
  await page
    .getByRole("textbox", { name: "Cella B1", exact: true })
    .fill("=SUM(A1:A2)");
  await page
    .getByRole("button", { name: "Mostra risultati", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Cella B1: 30", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cella B1: 30", exact: true }).click();
  await page.getByRole("button", { name: "Grassetto", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Cella B1: 30", exact: true }),
  ).toHaveCSS("font-weight", "700");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Esporta CSV", exact: true }).click();
  expect((await pending).suggestedFilename()).toBe("foglio.csv");
  await page.reload();
  await page
    .getByRole("button", { name: "foglio.sheet.json", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Cella B1: 30", exact: true }),
  ).toBeVisible();
});
test("v1.7 clicking backdrop dismisses dialog; inside does not", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Continua senza account", exact: true })
    .click();
  await page.getByRole("button", { name: "+ Nuovo file", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Nome", { exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.mouse.click(2, 2);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
async function signedIn(page: Page) {
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
}
test("v1.7 sidebar emoji, workspace form, primary Calderone and search bar", async ({
  page,
}) => {
  await signedIn(page);
  const wid = "10000000-0000-4000-8000-000000000001";
  await page.route("**/api/v1/bootstrap", async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    body.workspaces[0].emoji = "🚀";
    await route.fulfill({ json: body });
  });
  await page.goto(`/workspaces/${wid}`);
  await expect(
    page
      .locator(".rail")
      .getByRole("button", { name: "Test workspace", exact: true }),
  ).toHaveText("🚀");
  await expect(
    page.locator(".rail").getByRole("button", { name: "Cestino", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Calderone", exact: true }),
  ).toHaveClass(/primary/);
  await page
    .getByRole("button", { name: "Modifica workspace", exact: true })
    .click();
  await page.getByLabel("Nome", { exact: true }).fill("Studio");
  await page
    .getByRole("button", { name: "Scegli emoji del workspace" })
    .click();
  await page.getByRole("button", { name: "Emoji 📚", exact: true }).click();
  const outgoing = page.waitForRequest((r) => r.url().endsWith("/mutations"));
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Salva", exact: true })
    .click();
  expect((await outgoing).postDataJSON()).toMatchObject({
    op: "rename_workspace",
    args: { name: "Studio", emoji: "📚" },
  });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("searchbox", { name: "Cerca documenti e azioni" })
    .fill("appunti");
  await expect(page.getByRole("searchbox",{name:"Cerca documenti e azioni"})).toHaveValue("appunti");
  await page.getByRole("button", { name: "Avvia ricerca" }).click();
  await expect(
    page.getByRole("dialog").getByRole("textbox", { name: "Ricerca globale" }),
  ).toHaveValue("appunti");
});
test("v1.7 spreadsheet shares independent cells through real durable room and enforces viewer", async ({
  page,
  browser,
}) => {
  const context = await browser.newContext();
  const other = await context.newPage();
  try {
    const project = "20000000-0000-4000-8000-000000000001",
      id = crypto.randomUUID();
    const record = {
      id,
      project_id: project,
      workspace_id: "10000000-0000-4000-8000-000000000001",
      name: "shared.sheet.json",
      kind: "text",
      parent_id: null,
      generation: 1,
      language: "json",
      metadata_version: 1,
      status: "ready",
    };
    for (const p of [page, other]) {
      await signedIn(p);
      await p.route("**/api/v1/projects/*/files", (r) =>
        r.fulfill({ json: [record] }),
      );
    }
    const path = `/projects/${project}/files/${id}`;
    await page.goto(path);
    await expect(page.getByRole("status")).toHaveText("salvato sul server", {
      timeout: 20000,
    });
    await page
      .getByRole("button", { name: "Inizializza foglio vuoto" })
      .click();
    await expect(page.getByRole("status")).toHaveText("salvato sul server", {
      timeout: 20000,
    });
    await other.goto(path);
    await expect(
      other.getByRole("button", { name: "Cella A1:", exact: true }),
    ).toBeVisible({ timeout: 20000 });
    await page
      .getByRole("button", { name: "Modifica celle", exact: true })
      .click();
    await other
      .getByRole("button", { name: "Modifica celle", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Cella A1", exact: true })
      .fill("42");
    await page
      .getByRole("textbox", { name: "Cella A1", exact: true })
      .press("Enter");
    await expect(
      other.getByRole("textbox", { name: "Cella A1", exact: true }),
    ).toHaveValue("42");
    await other
      .getByRole("textbox", { name: "Cella B1", exact: true })
      .fill("=A1*2");
    await other
      .getByRole("textbox", { name: "Cella B1", exact: true })
      .press("Enter");
    await page
      .getByRole("button", { name: "Mostra risultati", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Cella B1: 84", exact: true }),
    ).toBeVisible({ timeout: 20000 });
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Cella B1: 84", exact: true }),
    ).toBeVisible({ timeout: 20000 });
    await page.route("**/api/v1/bootstrap", async (r) => {
      const res = await r.fetch(),
        body = await res.json();
      body.projects[0].role = "viewer";
      await r.fulfill({ json: body });
    });
    await page.route(
      "**/api/v1/files/*/collaboration-ticket",
      async (route) => {
        const response = await page.request.post(
          "http://localhost:8788/ticket",
          { data: { token: "viewer", fileId: id, generation: 1 } },
        );
        await route.fulfill({ json: await response.json() });
      },
    );
    await page.reload();
    await expect(
      page.getByRole("textbox", { name: "Formula o valore" }),
    ).toBeDisabled();
  } finally {
    await page.unrouteAll({behavior:"wait"});
    await context.close();
  }
});
