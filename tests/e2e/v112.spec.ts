import { test, expect, type Page } from "@playwright/test";
async function signedIn(page: Page) {
  await page.addInitScript(() => {
    const uid = "00000000-0000-4000-8000-000000000001";
    const expires = Math.floor(Date.now() / 1000) + 3600;
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
          user_metadata: { first_name: "Test", last_name: "user" },
          created_at: new Date().toISOString(),
        },
      }),
    );
  });
}

const project = "20000000-0000-4000-8000-000000000001";
const base = {
  project_id: project,
  workspace_id: "10000000-0000-4000-8000-000000000001",
  parent_id: null,
  generation: 1,
  language: "plaintext",
  metadata_version: 7,
  status: "ready",
};
const records = [
  {
    ...base,
    id: "31200000-0000-4000-8000-000000000001",
    name: "uno.txt",
    kind: "text",
  },
  {
    ...base,
    id: "31200000-0000-4000-8000-000000000002",
    name: "due.txt",
    kind: "text",
  },
  {
    ...base,
    id: "31200000-0000-4000-8000-000000000003",
    name: "Cartella",
    kind: "folder",
  },
];
async function setup(page: Page, viewer = false) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signedIn(page);
  await page.route("**/api/v1/bootstrap", async (r) => {
    const res = await r.fetch();
    const body = await res.json();
    body.workspaces[0].emoji = "🚀";
    if (viewer) body.projects[0].role = "viewer";
    await r.fulfill({ json: body });
  });
  await page.route("**/api/v1/projects/*/files", (r) =>
    r.fulfill({ json: records }),
  );
  if (viewer)
    await page.route("**/api/v1/files/*/collaboration-ticket", async (r) => {
      const opts = r.request().postDataJSON();
      const fileId = r.request().url().split("/").at(-2);
      const response = await page.request.post("/api/ticket", {
        data: {
          token: "viewer",
          fileId,
          generation: 1,
          document: opts.document,
          documentSchema: 2,
        },
      });
      await r.fulfill({ json: await response.json() });
    });
  await page.goto(`/projects/${project}/files/${records[0].id}`);
  await expect(page.locator(".tabs .file-tab")).toHaveCount(1);
  await expect(page.getByRole("status")).toHaveText("salvato sul server", {
    timeout: 20000,
  });
}
test("v1.12 explorer resize, keyboard menu, palette and session restore", async ({
  page,
}) => {
  await setup(page);
  const handle = page.getByRole("separator", {
    name: "Larghezza esplora file",
  });
  await handle.focus();
  await page.keyboard.press("ArrowRight");
  await expect(handle).toHaveAttribute("aria-valuenow", "276");
  await page
    .locator(".tree-row")
    .filter({ hasText: "due.txt" })
    .getByRole("button", { name: "due.txt", exact: true })
    .focus();
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.locator(".tree-name").filter({ hasText: "due.txt" }).click();
  await expect(page.locator(".file-tab")).toHaveCount(2);
  await page.reload();
  await expect(page.locator(".file-tab")).toHaveCount(2);
  await expect(handle).toHaveAttribute("aria-valuenow", "276");
  await page.keyboard.press("Control+Shift+P");
  await page.getByRole("combobox", { name: "Cerca comando" }).fill("Temi");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Temi e colori" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Collassa Cartella" }).click();
  await expect(
    page.getByRole("button", { name: "Espandi Cartella" }),
  ).toHaveAttribute("aria-expanded", "false");
});
test("v1.12 split keeps independent editor contents, viewer permissions and reload", async ({
  page,
}) => {
  await setup(page, true);
  await page.getByLabel("Apri file affiancato").selectOption(records[1].id);
  await expect(
    page.getByRole("region", { name: "Editor affiancato", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".file-panes .editor-region")).toHaveCount(2);
  await expect(page.locator(".secondary-pane .editor-access")).toHaveText(
    "Sola lettura",
    { timeout: 20000 },
  );
  await page.reload();
  await expect(page.locator(".secondary-pane")).toBeVisible();
  await page.getByRole("button", { name: "Chiudi affiancato" }).click();
  await expect(page.locator(".secondary-pane")).toHaveCount(0);
  await page.unrouteAll({behavior:"wait"});
});
test("v1.12 guest multi import, embedded image/link/table, outline and native round trip", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Continua senza account", exact: true })
    .click();
  await page.getByLabel("Importa file ospite").setInputFiles([
    {
      name: "one.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Heading\nBody\n"),
    },
    { name: "two.md", mimeType: "text/plain", buffer: Buffer.from("# Two") },
  ]);
  await expect(page.locator(".guest-files>button")).toHaveCount(2);
  await page.getByRole("button", { name: "one.txt", exact: true }).click();
  const content = page.getByRole("textbox", { name: "Contenuto one.txt" });
  await expect(content).toBeVisible({ timeout: 20000 });
  await page.getByRole("button", { name: "Inserisci", exact: true }).click();
  await page.getByRole("button", { name: "Link", exact: true }).click();
  await page.getByLabel("Indirizzo").fill("https://example.com/");
  await page
    .getByRole("button", { name: "Inserisci link", exact: true })
    .click();
  await expect(page.locator(".ql-editor a")).toHaveAttribute(
    "href",
    "https://example.com/",
  );
  await page.getByRole("button", { name: "Inserisci", exact: true }).click();
  await page.getByRole("button", { name: "Immagine", exact: true }).click();
  await page.getByLabel("Immagine PNG, JPEG o WebP").setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAALUlEQVR4nGNMmXaCgZaAiaamj1owasGoBaMWjFowasGoBaMWjFowasGoBVQEAN3CAgL3QDzoAAAAAElFTkSuQmCC",
      "base64",
    ),
  });
  await expect(page.locator(".ql-editor img")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Sorgente testo", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("vista visuale");
  await expect(content).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "one.txt", exact: true }).click();
  await expect(page.locator(".ql-editor img")).toHaveCount(1, {
    timeout: 20000,
  });
  await page.getByRole("button", { name: "Inserisci", exact: true }).click();
  await page.getByRole("button", { name: "Tabella", exact: true }).click();
  await page
    .getByRole("button", { name: "Inserisci tabella", exact: true })
    .click();
  await expect(page.locator(".ql-editor table td")).toHaveCount(4);
  await page.reload();
  await page.getByRole("button", { name: "one.txt", exact: true }).click();
  await expect(page.locator(".ql-editor table td")).toHaveCount(4, {
    timeout: 20000,
  });
  await page.screenshot({
    path: "test-results/v112-document.png",
    fullPage: true,
  });
});

test("v1.12 multi import confirms every source in a real room, even before opening it", async ({
  page,
}) => {
  await setup(page);
  const imported = [...records];
  let next = 10;
  await page.route("**/api/v1/projects/*/files", (r) =>
    r.fulfill({ json: imported }),
  );
  await page.route("**/api/v1/mutations", async (r) => {
    const body = r.request().postDataJSON();
    const record = {
      ...base,
      id: `31200000-0000-4000-8000-${String(next++).padStart(12, "0")}`,
      name: body.args.name,
      kind: "text",
      language: "markdown",
    };
    imported.push(record);
    await r.fulfill({ json: record });
  });
  await page.locator("input[type=file]").setInputFiles([
    {
      name: "import-one.md",
      mimeType: "text/plain",
      buffer: Buffer.from("# First imported"),
    },
    {
      name: "import-two.md",
      mimeType: "text/plain",
      buffer: Buffer.from("# Second imported"),
    },
  ]);
  await expect(
    page.locator(".tree-name").filter({ hasText: "import-one.md" }),
  ).toBeVisible();
  await expect(
    page.locator(".tree-name").filter({ hasText: "import-two.md" }),
  ).toBeVisible();
  for (const f of imported.slice(records.length)) {
    const response = await page.request.get(`/api/v1/files/${f.id}/snapshot`);
    expect(response.ok()).toBe(true);
    expect(await response.json()).toMatchObject({
      text:
        f.name === "import-one.md" ? "# First imported" : "# Second imported",
    });
  }
});

test("v1.12 mobile guest palette has no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Continua senza account", exact: true })
    .click();
  await page.getByRole("button", { name: "Comandi", exact: true }).click();
  await page.getByRole("combobox", { name: "Cerca comando" }).fill("Nuovo");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Nuovo file ospite" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/v112-mobile.png",
    fullPage: true,
  });
});

test("v1.12 two editable panes keep separate documents and server acknowledgements", async ({
  page,
}) => {
  await setup(page);
  await page.getByLabel("Apri file affiancato").selectOption(records[1].id);
  const left = page.locator(".file-pane").first();
  const right = page.locator(".secondary-pane");
  await left
    .getByRole("textbox", { name: "Contenuto uno.txt" })
    .fill("Primary independent");
  await right
    .getByRole("textbox", { name: "Contenuto due.txt" })
    .fill("Secondary independent");
  await expect(left.getByRole("status")).toHaveText("salvato sul server", {
    timeout: 20000,
  });
  await expect(right.getByRole("status")).toHaveText("salvato sul server", {
    timeout: 20000,
  });
  await expect(left.locator(".ql-editor")).toHaveText("Primary independent");
  await expect(right.locator(".ql-editor")).toHaveText("Secondary independent");
  await page.screenshot({
    path: "test-results/v112-split.png",
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.locator(".file-pane").first().locator(".ql-editor"),
  ).toHaveText("Primary independent", { timeout: 20000 });
  await expect(page.locator(".secondary-pane .ql-editor")).toHaveText(
    "Secondary independent",
    { timeout: 20000 },
  );
});

test("v1.12 live images arrive in a second authenticated editor and survive server reload", async ({
  page,
  browser,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Inserisci", exact: true }).click();
  await page.getByRole("button", { name: "Immagine", exact: true }).click();
  await page
    .getByLabel("Immagine PNG, JPEG o WebP")
    .setInputFiles({
      name: "photo.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAALUlEQVR4nGNMmXaCgZaAiaamj1owasGoBaMWjFowasGoBaMWjFowasGoBVQEAN3CAgL3QDzoAAAAAElFTkSuQmCC",
        "base64",
      ),
    });
  await expect(page.locator(".ql-editor img")).toHaveCount(1);
  await expect(page.getByRole("status")).toHaveText("salvato sul server", {
    timeout: 20000,
  });
  const other = await browser.newContext({baseURL:new URL(page.url()).origin});
  try {
    const remote = await other.newPage();
    await setup(remote);
    await expect(remote.locator(".ql-editor img")).toHaveCount(1, {
      timeout: 20000,
    });
    await page.reload();
    await expect(page.locator(".ql-editor img")).toHaveCount(1, {
      timeout: 20000,
    });
  } finally {
    await other.close();
  }
});
