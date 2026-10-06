import { test, expect, type Page } from "@playwright/test";
test.setTimeout(60000);
import { board } from "./fixtures/board";
const photo = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAALUlEQVR4nGNMmXaCgZaAiaamj1owasGoBaMWjFowasGoBaMWjFowasGoBVQEAN3CAgL3QDzoAAAAAElFTkSuQmCC", "base64");
async function create(page: Page, template: string) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Continua senza account", exact: true })
    .click();
  await page.getByRole("button", { name: "+ Nuovo file", exact: true }).click();
  await page.getByLabel("Inizia da").selectOption(template);
  await page.getByRole("button", { name: "Crea", exact: true }).click();
}
test("v1.11 pin stays in layout, survives editor click/reload and can be released", async ({
  page,
}) => {
  await create(page, "blank");
  await page
    .getByRole("button", { name: "Formattazione", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Fissa Formattazione", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Contenuto senza-titolo.txt" })
    .fill("Barra fissata");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("region", { name: "Formattazione", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".format-menu .tool-popover")).toHaveCSS(
    "position",
    "static",
  );
  await page.reload();
  await page
    .getByRole("button", { name: "senza-titolo.txt", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Sblocca Formattazione", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Sblocca Formattazione", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Formattazione", exact: true }),
  ).toHaveCount(0);
});
test("v1.11 board solid canvas, hand navigation, frame drawing and quiet reads", async ({
  page,
}) => {
  const state = await board(page);
  const initialReads = state.reads;
  await expect(
    page.getByRole("button", { name: "Home", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".board-canvas")).toHaveCSS(
    "background-color",
    "rgb(0, 0, 0)",
  );
  await expect(page.locator(".board-canvas")).toHaveCSS(
    "background-image",
    "none",
  );
  await page.locator(".board-viewport").evaluate((el) => {
    el.scrollLeft = 100;
    el.scrollTop = 100;
  });
  await page.getByRole("button", { name: "Mano", exact: true }).click();
  const box = (await page.locator(".board-viewport").boundingBox())!;
  await page.mouse.move(box.x + 350, box.y + 250);
  await page.mouse.down();
  await page.mouse.move(box.x + 250, box.y + 200, { steps: 8 });
  await page.mouse.up();
  expect(
    await page.locator(".board-viewport").evaluate((el) => el.scrollLeft),
  ).toBeGreaterThan(150);
  expect(state.writes).toHaveLength(0);
  await page
    .getByRole("button", { name: "Ripristina vista", exact: true })
    .click();
  await page.getByRole("button", { name: "Pennello", exact: true }).click();
  await page.mouse.move(box.x + 280, box.y + 170);
  await page.mouse.down();
  await page.mouse.move(box.x + 380, box.y + 220, { steps: 30 });
  await page.mouse.up();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.reads).toBe(initialReads);
  await expect(page.locator(".board-strokes path")).toHaveCount(1);
  await page.waitForTimeout(10500);
  expect(state.reads).toBe(initialReads + 1);
  await page.getByRole("button", { name: "Aspetto", exact: true }).click();
  await page.getByRole("button", { name: "☀ Bianco", exact: true }).click();
  await page.getByRole("button", { name: "Chiudi", exact: true }).click();
  await expect(page.locator(".board-canvas")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await page.screenshot({ path: "test-results/v111-board.png" });
});
test("v1.11 paste table, numeric sorting/filtering, linked charts and reload", async ({
  page,
}) => {
  await create(page, "sheet");
  await page
    .getByRole("button", { name: "Modifica celle", exact: true })
    .click();
  const input = page.getByRole("textbox", { name: "Cella A1", exact: true });
  await input.focus();
  await input.evaluate((el) => {
    const data = new DataTransfer();
    data.setData("text/plain", "Luogo\tCosto\nKyoto\t20\nTokyo\t10");
    el.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await page
    .getByRole("button", { name: "Mostra risultati", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Cella B2: 20", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Tabelle e grafici", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Fissa Tabelle e grafici", exact: true })
    .click();
  await page.getByLabel("Intervallo tabella o grafico").fill("A1:B3");
  await page.getByRole("button", { name: "Crea tabella", exact: true }).click();
  await page
    .getByLabel("Tabella", { exact: true })
    .selectOption({ label: "Tabella 1 · A1:B3" });
  await page.getByRole("button", { name: "Cella B2: 20", exact: true }).click();
  await page
    .getByRole("button", { name: "Ordina crescente", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Cella A2: Tokyo", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Filtra tabella").fill("Kyoto");
  await expect(
    page.getByRole("button", { name: "Cella A2: Tokyo", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Filtra tabella").fill("");
  await page.getByRole("button", { name: "Crea grafico", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Tabella 1, grafico bar", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "foglio.sheet.json", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "Tabella 1, grafico bar", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cella A2: Tokyo", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/v111-sheet.png" });
});
test("v1.11 travel previews, photo survives reload and short maps resolve without auth", async ({
  page,
}) => {
  await page.route("https://example.com/hotel", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: '<title>Hotel Kyoto</title><meta property="og:image" content="https://example.com/photo.png">',
      headers: { "Access-Control-Allow-Origin": "*" },
    }),
  );
  await page.route("https://example.com/photo.png", (r) =>
    r.fulfill({ body: photo, contentType: "image/png" }),
  );
  await page.route("**/api/maps-preview?**", (r) =>
    r.fulfill({ json: { url: "https://www.google.com/maps?query=35,135" } }),
  );
  await page.route("https://www.google.com/maps?**", (r) =>
    r.fulfill({ contentType: "text/html", body: "<p>Mappa di test</p>" }),
  );
  await create(page, "travel");
  await page
    .getByLabel("Itinerario e link")
    .fill(
      "# Giappone\nhttps://example.com/hotel\nhttps://maps.app.goo.gl/abc123",
    );
  await page
    .getByRole("heading", { name: "Travel planner", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Hotel Kyoto", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Foto di Hotel Kyoto", exact: true }),
  ).toBeVisible();
  await expect(page.getByTitle("Mappa: maps.app.goo.gl")).toHaveAttribute(
    "src",
    /q=35%2C135/,
  );
  await page
    .getByLabel("Allega foto a example.com", { exact: true })
    .setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: photo });
  await expect(page.locator(".travel-card img").first()).toHaveAttribute(
    "src",
    /^data:image\/jpeg;base64,/,
    { timeout: 20000 },
  );
  await expect(page.getByLabel("Itinerario e link")).not.toHaveValue(/base64/);
  await page.reload();
  await page
    .getByRole("button", { name: "viaggio.travel.md", exact: true })
    .click();
  await expect(page.locator(".travel-card img").first()).toHaveAttribute(
    "src",
    /^data:image\/jpeg;base64,/,
    { timeout: 20000 },
  );
  await expect(page.getByTitle("Mappa: maps.app.goo.gl")).toBeVisible();
  await page.screenshot({ path: "test-results/v111-travel.png" });
});
