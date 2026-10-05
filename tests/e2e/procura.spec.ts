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
