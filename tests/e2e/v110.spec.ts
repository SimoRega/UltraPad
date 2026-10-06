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
    id: "30000000-0000-4000-8000-000000000001",
    name: "uno.txt",
    kind: "text",
  },
  {
    ...base,
    id: "30000000-0000-4000-8000-000000000002",
    name: "due.txt",
    kind: "text",
  },
  {
    ...base,
    id: "30000000-0000-4000-8000-000000000003",
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
  await page.goto(`/projects/${project}/files/${records[0].id}`);
  await expect(page.locator(".tabs .file-tab")).toHaveCount(1);
  await expect(page.getByRole("status")).toHaveText("salvato sul server", {
    timeout: 20000,
  });
}
test("v1.10 expanded rail labels and tab close/border", async ({ page }) => {
  await setup(page);
  const rail = page.locator(".rail");
  await expect(
    rail.getByRole("button", { name: "UltraPad", exact: true }),
  ).toHaveText("U");
  await rail.getByRole("button", { name: "Espandi sidebar workspace" }).click();
  await expect(
    rail.getByRole("button", { name: "UltraPad", exact: true }),
  ).toHaveText("UltraPad");
  await expect(
    rail.getByRole("button", { name: "Riduci sidebar workspace" }),
  ).toContainText("Collassa");
  await expect(
    rail.getByRole("button", { name: "Test workspace", exact: true }),
  ).toHaveText("🚀Test workspace");
  await expect(
    rail.getByRole("button", { name: "Aspetto", exact: true }),
  ).toHaveText("◐ Tema");
  await expect(
    rail.getByRole("button", { name: "Account", exact: true }),
  ).toContainText("Test user");
  await expect(page.locator(".file-tab.active")).toHaveCSS(
    "border-top-width",
    "2px",
  );
  await expect(page.locator(".tab-close")).toHaveCSS(
    "justify-content",
    "center",
  );
  await expect(page.locator(".tab-close svg")).toHaveCount(1);
  await rail.getByRole("button", { name: "Riduci sidebar workspace" }).click();
  await expect(
    rail.getByRole("button", { name: "UltraPad", exact: true }),
  ).toHaveText("U");
});
test("v1.10 file drag uses existing mutation and reports failure without moving", async ({
  page,
}) => {
  await setup(page);
  let calls = 0;
  await page.route("**/api/v1/mutations", async (r) => {
    calls++;
    expect(r.request().postDataJSON()).toEqual({
      op: "move_file",
      args: {
        id: records[0].id,
        parent_id: records[2].id,
        metadata_version: 7,
      },
    });
    await r.fulfill({ status: 409, json: { error: "METADATA_CONFLICT" } });
  });
  const source = page.locator(".tree-row").filter({
    has: page.getByRole("button", { name: "uno.txt", exact: true }),
  });
  const target = page.locator(".tree-row").filter({
    has: page.getByRole("button", { name: "Cartella", exact: true }),
  });
  async function dragFile() {
    await target.scrollIntoViewIfNeeded();
    await source.scrollIntoViewIfNeeded();
    const a = (await source.boundingBox())!,
      b = (await target.boundingBox())!;
    await page.mouse.move(a.x + 60, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + 70, a.y + a.height / 2, { steps: 5 });
    await page.mouse.move(b.x + 60, b.y + b.height / 2, { steps: 10 });
    await page.mouse.move(b.x + 65, b.y + b.height / 2);
    await page.mouse.up();
  }

  await dragFile();
  await expect.poll(() => calls).toBe(1);
  await expect(page.locator(".notice[role=alert]").first()).toBeVisible();
  await expect(source).toBeVisible();
  await page.unroute("**/api/v1/mutations");
  await page.route("**/api/v1/mutations", (r) =>
    r.fulfill({ json: { ok: true } }),
  );
  await page.unroute("**/api/v1/projects/*/files");
  await page.route("**/api/v1/projects/*/files", (r) =>
    r.fulfill({
      json: records.map((f) =>
        f.id === records[0].id
          ? { ...f, parent_id: records[2].id, metadata_version: 8 }
          : f,
      ),
    }),
  );
  await dragFile();
  await expect(source).toHaveCSS("padding-left", "26px");
  await page.reload();
  await expect(source).toHaveCSS("padding-left", "26px");
});
test("v1.10 tabs reorder without changing active file and viewer files cannot drag", async ({
  page,
}) => {
  await setup(page, true);
  await expect(page.locator(".tree-row").first()).toHaveAttribute(
    "draggable",
    "false",
  );
  await page.locator(".tree-name").filter({ hasText: "due.txt" }).click();
  await expect(page.locator(".tabs .file-tab")).toHaveCount(2);
  const first = page.locator(".file-tab").filter({ hasText: "uno.txt" });
  const second = page.locator(".file-tab").filter({ hasText: "due.txt" });
  const url = page.url();
  await first.dragTo(second, {
    sourcePosition: { x: 15, y: 15 },
    targetPosition: { x: 85, y: 15 },
  });
  await expect(page.locator(".file-tab .tab-title")).toHaveText([
    "due.txt",
    "uno.txt",
  ]);
  expect(page.url()).toBe(url);
  await expect(second).toHaveClass(/active/);
  await page
    .getByRole("button", { name: "Chiudi uno.txt", exact: true })
    .click();
  await expect(page.locator(".file-tab .tab-title")).toHaveText(["due.txt"]);
});
