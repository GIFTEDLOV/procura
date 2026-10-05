import { expect, test } from "@playwright/test";

test("evaluation room loads as controlled demo", async ({ page }) => {
  await page.goto("/evaluation-room");
  await expect(page.getByText("Evaluation Room").first()).toBeVisible();
  await expect(page.getByText("CONTROLLED DEMO").first()).toBeVisible();
  await expect(page.getByText("Solbridge").first()).toBeVisible();
});

test("inspection room exposes canonical mismatch", async ({ page }) => {
  await page.goto("/inspection-room");
  await expect(page.getByText("MATERIAL_DELIVERY_MISMATCH")).toBeVisible();
  await expect(page.getByText("Payment is blocked")).toBeVisible();
});

test("controlled demo lifecycle stays truthful across flagship surfaces", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  const expectNoOverflow = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto("/");
  await expect(page.getByText("Good morning, Northstar.")).toBeVisible();
  await expectNoOverflow();
  await page.goto("/tender-room");
  await expect(page.getByText("Frozen requirements")).toBeVisible();
  await page.goto("/supplier-portal");
  await expect(page.getByText("Supplier A · Solbridge Systems")).toBeVisible();
  await page.goto("/evaluation-room");
  await expect(page.getByText("Supplier conformity matrix")).toBeVisible();
  await expectNoOverflow();
  await page.getByRole("button", { name: /6,000 cycles guaranteed/i }).click();
  await expect(page.getByRole("dialog", { name: "Evaluation detail" })).toBeVisible();
  await page.screenshot({ path: `../evidence/screenshots/evaluation-room-${testInfo.project.name}.png`, fullPage: true });
  await page.goto("/award-desk");
  await expect(page.getByText("COMPLIANT under all mandatory frozen requirements")).toBeVisible();
  await page.goto("/delivery-workspace");
  await expect(page.getByText("Product substitution submitted")).toBeVisible();
  await page.goto("/inspection-room");
  await expect(page.getByText("MATERIAL_DELIVERY_MISMATCH")).toBeVisible();
  await expectNoOverflow();
  await page.screenshot({ path: `../evidence/screenshots/inspection-room-${testInfo.project.name}.png`, fullPage: true });
  await page.goto("/payments");
  await expect(page.getByText("Payment blocked pending permitted resolution")).toBeVisible();
  await expectNoOverflow();
  await page.screenshot({ path: `../evidence/screenshots/settlement-ledger-${testInfo.project.name}.png`, fullPage: true });
  await page.goto("/proof-audit");
  await expect(page.getByText("Evidence and audit anchors")).toBeVisible();
  expect(errors).toEqual([]);
});

test("all core routes support explicit readback states", async ({ page }) => {
  for (const route of ["tenders", "tender-builder", "tender-room", "supplier-portal", "bid-builder", "evaluation-room", "award-desk", "delivery-workspace", "inspection-room", "payments", "disputes", "proof-audit"]) {
    await page.goto(`/${route}?state=empty`);
    await expect(page.locator('[data-state="empty"]')).toBeVisible();
    await page.goto(`/${route}?state=error`);
    await expect(page.locator('[data-state="error"]')).toBeVisible();
  }
});
