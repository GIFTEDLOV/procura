import { expect, test } from "@playwright/test";
import path from "node:path";

const routes = ["command-center", "tenders", "tender-builder", "tender-room", "supplier-portal", "bid-builder", "evaluation-room", "award-desk", "delivery-workspace", "inspection-room", "payments", "disputes", "suppliers", "analytics", "proof-audit", "settings"] as const;
const screenshotRoot = path.resolve(process.cwd(), "..", "docs", "assets", "screenshots");

async function noPageOverflow(page: import("@playwright/test").Page) {
  const size = await page.evaluate(() => {
    const ancestors = [...document.querySelectorAll("section.rounded-2xl.border")].slice(0, 1).flatMap((section) => {
      const chain: string[] = [];
      let element: Element | null = section;
      while (element && chain.length < 8) {
        const bounds = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const classes = typeof element.className === "string" ? element.className : "";
        chain.push(`${element.tagName.toLowerCase()}.${classes.split(/\s+/).slice(0, 2).join(".")} x=${Math.round(bounds.x)} right=${Math.round(bounds.right)} width=${Math.round(bounds.width)} css=${style.width} min=${style.minWidth} display=${style.display} overflow-x=${style.overflowX}`);
        element = element.parentElement;
      }
      return chain;
    });
    return {
    pathname: window.location.pathname,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyWidth: document.body.getBoundingClientRect().width,
    rootWidth: document.querySelector("#root")?.getBoundingClientRect().width,
    ancestors,
    overflow: [...document.body.querySelectorAll("*")]
      .map((element) => {
        const bounds = element.getBoundingClientRect();
        if (bounds.width === 0 || bounds.right <= window.innerWidth + 1) return null;
        const classes = typeof element.className === "string" ? element.className : "";
        return `${element.tagName.toLowerCase()}.${classes.split(/\s+/).slice(0, 2).join(".")} right=${Math.ceil(bounds.right)} width=${Math.ceil(bounds.width)}`;
      })
      .filter((value): value is string => value !== null)
      .slice(0, 5),
    };
  });
  expect(
    size.documentWidth <= size.viewportWidth,
    `Horizontal overflow at ${size.pathname}: document ${size.documentWidth}px, viewport ${size.viewportWidth}px, client ${size.clientWidth}px, body ${size.bodyWidth}px, root ${size.rootWidth}px; ancestors: ${size.ancestors.join(" | ")}; elements: ${size.overflow.join(" | ")}`,
  ).toBe(true);
}
async function noConsoleErrors(page: import("@playwright/test").Page) { const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message)); page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); }); return errors; }

test("landing page communicates the product and opens the app", async ({ page }, testInfo) => {
  const errors = await noConsoleErrors(page); await page.goto("/");
  await expect(page.getByRole("heading", { name: "Procurement you can prove." })).toBeVisible(); await expect(page.getByText("Requirement", { exact: true })).toBeVisible(); await expect(page.getByText("COMPLIANT", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: /Open Procura/ }).first().click(); await expect(page).toHaveURL(/\/app\/command-center/); await expect(page.getByText("Good morning, Northstar.")).toBeVisible(); await noPageOverflow(page);
  if (testInfo.project.name.includes("1440")) await page.screenshot({ path: path.join(screenshotRoot, "landing-desktop.png"), fullPage: true }); if (testInfo.project.name.includes("430")) { await page.goto("/"); await page.screenshot({ path: path.join(screenshotRoot, "landing-mobile.png"), fullPage: true }); } expect(errors).toEqual([]);
});
test("unknown routes render an intentional 404", async ({ page }) => { await page.goto("/this-route-does-not-exist"); await expect(page.getByRole("heading", { name: "That surface does not exist." })).toBeVisible(); await expect(page.getByText("Good morning, Northstar.")).not.toBeVisible(); });
test("all advertised routes have distinct identity", async ({ page }) => { for (const route of routes) { await page.goto(`/app/${route}`); await expect(page.locator("h1").first()).toBeVisible(); await expect(page.getByText("Ready for operator review")).not.toBeVisible(); } });
test("legacy paths redirect into the app namespace", async ({ page }) => { await page.goto("/evaluation-room"); await expect(page).toHaveURL(/\/app\/evaluation-room/); await expect(page.getByText("Evaluation Room").first()).toBeVisible(); });
test("controlled demo remains explicitly separated", async ({ page }) => { await page.goto("/app/evaluation-room"); await expect(page.getByText("CONTROLLED DEMO").last()).toBeVisible(); await expect(page.getByText("Solbridge").first()).toBeVisible(); await page.getByLabel("Workspace mode").selectOption("HISTORICAL"); await expect(page.getByText("HISTORICAL").last()).toBeVisible(); await expect(page.getByText("Historical proof workspace")).toBeVisible(); await expect(page.getByText("Solbridge").first()).not.toBeVisible(); });
test("LIVE mode uses Studionet and never silently falls back to demo data", async ({ page }) => { let requestedStudionet = false; await page.route("**/_genlayer/studionet", (route) => { requestedStudionet = true; return route.abort(); }); await page.goto("/app/command-center"); await page.getByLabel("Workspace mode").selectOption("LIVE"); await expect(page.getByText("LIVE").last()).toBeVisible(); await expect(page.getByText("Canonical state is unavailable.").or(page.getByText("Canonical LIVE readback"))).toBeVisible({ timeout: 15000 }); await expect(page.getByText("Good morning, Northstar.")).not.toBeVisible(); expect(requestedStudionet).toBe(true); });
test("wallet disconnected state is honest and public reads remain available", async ({ page }) => { await page.goto("/app/command-center"); await expect(page.getByRole("button", { name: "Connect wallet" })).toBeVisible(); await expect(page.getByText("CONTROLLED DEMO").last()).toBeVisible(); });
test("explicit readback states are preserved", async ({ page }) => { for (const route of ["tenders", "tender-builder", "tender-room", "bid-builder", "evaluation-room", "inspection-room", "payments", "proof-audit"]) { await page.goto(`/app/${route}?state=empty`); await expect(page.locator('[data-state="empty"]')).toBeVisible(); await page.goto(`/app/${route}?state=error`); await expect(page.locator('[data-state="error"]')).toBeVisible(); } });
test("evaluation and inspection expose evidence-oriented controlled views", async ({ page }, testInfo) => { await page.goto("/app/evaluation-room"); await expect(page.getByText("Supplier conformity matrix")).toBeVisible(); await page.getByRole("button", { name: /6,000 cycles guaranteed/i }).click(); await expect(page.getByRole("dialog", { name: "Evaluation detail" })).toBeVisible(); if (testInfo.project.name.includes("1440")) await page.screenshot({ path: path.join(screenshotRoot, "evaluation-desktop.png"), fullPage: true }); if (testInfo.project.name.includes("430")) await page.screenshot({ path: path.join(screenshotRoot, "evaluation-mobile.png"), fullPage: true }); await page.goto("/app/inspection-room"); await expect(page.getByText("MATERIAL_DELIVERY_MISMATCH")).toBeVisible(); await expect(page.getByText("Payment is blocked")).toBeVisible(); if (testInfo.project.name.includes("1440")) await page.screenshot({ path: path.join(screenshotRoot, "inspection-desktop.png"), fullPage: true }); if (testInfo.project.name.includes("430")) await page.screenshot({ path: path.join(screenshotRoot, "inspection-mobile.png"), fullPage: true }); });
test("payments keeps gross values and controlled state visible", async ({ page }, testInfo) => { await page.goto("/app/payments"); await expect(page.getByText("Settlement Ledger")).toBeVisible(); await expect(page.getByText("Payment blocked pending permitted resolution")).toBeVisible(); if (testInfo.project.name.includes("1440")) await page.screenshot({ path: path.join(screenshotRoot, "payments-desktop.png"), fullPage: true }); if (testInfo.project.name.includes("430")) await page.screenshot({ path: path.join(screenshotRoot, "payments-mobile.png"), fullPage: true }); });
test("mobile navigation is keyboard reachable", async ({ page }, testInfo) => { test.skip(!testInfo.project.name.includes("mobile"), "Mobile navigation control is intentionally hidden on wide layouts."); await page.goto("/app/command-center"); await page.getByRole("button", { name: "Open navigation" }).focus(); await page.keyboard.press("Enter"); await expect(page.getByRole("navigation", { name: "Operate navigation" })).toBeVisible(); await noPageOverflow(page); });
test("bid builder validates a typed action without broadcasting demo data", async ({ page }) => { await page.goto("/app/bid-builder"); await page.getByLabel("Bid ID").fill("BID-TEST-001"); await page.getByRole("button", { name: "Validate bid action" }).click(); await expect(page.getByText("Bid submitted")).not.toBeVisible(); await expect(page.getByText("Validate bid action")).toBeVisible(); });
test("LIVE workflow forms are functional while controlled demo stays isolated", async ({ page }) => {
  await page.goto("/app/tender-builder");
  await page.getByLabel("Tender title").fill("Browser-tested tender");
  await page.getByLabel("Category").fill("Energy storage");
  await page.getByLabel("Buyer description").fill("A real form payload with explicit policies and deadlines.");
  await page.getByLabel("Budget ceiling in wei").fill("1000000000000000");
  await page.getByRole("button", { name: "Validate controlled draft" }).click();
  await expect(page.getByText("Controlled demo draft validated")).toBeVisible();
  await page.goto("/app/delivery-workspace");
  await page.getByLabel("Award ID").fill("AWARD-DEMO-1");
  await page.getByLabel("Delivery reference").fill("GRN-DEMO-1");
  await page.getByLabel("Delivered items").fill("one audited unit");
  await page.getByLabel("Serial identifiers").fill("SN-DEMO-1");
  await page.getByRole("button", { name: "Validate controlled delivery" }).click();
  await expect(page.getByText("Controlled demo delivery validated")).toBeVisible();
  await page.getByLabel("Evidence ID").fill("EVIDENCE-DEMO-1");
  await page.getByLabel("Authority").fill("Demo authority");
  await page.getByLabel("Source URL").fill("https://example.test/demo");
  await page.getByLabel("Evidence type").fill("receipt");
  await page.setInputFiles('input[type="file"]', { name: "receipt.bin", mimeType: "application/octet-stream", buffer: Buffer.from([0, 1, 2, 255]) });
  await page.getByRole("button", { name: "Attach evidence" }).click();
  await expect(page.getByText("Controlled demo evidence validated")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Controlled demo evidence" })).toContainText("No LIVE transaction was prepared or broadcast.");
});
test("LIVE mode reports unavailable Studionet RPC without switching to V1 or demo data", async ({ page }) => {
  let requestedStudionet = false;
  await page.route("**/_genlayer/studionet", (route) => { requestedStudionet = true; return route.abort(); });
  await page.goto("/app/command-center");
  await page.getByLabel("Workspace mode").selectOption("LIVE");
  await expect(page.getByText("Canonical state is unavailable.").or(page.getByText("Canonical LIVE readback"))).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Good morning, Northstar.")).not.toBeVisible();
  await expect(page.getByText(/V1 is operating in read-only safety mode/)).toHaveCount(0);
  expect(requestedStudionet).toBe(true);
});
test("production-shaped pages have no browser errors or page overflow", async ({ page }) => { const errors = await noConsoleErrors(page); for (const route of ["/", ...routes.map((route) => `/app/${route}`)]) { await page.goto(route); await noPageOverflow(page); } expect(errors).toEqual([]); });
test("reviewer screenshots cover command center and proof audit", async ({ page }, testInfo) => { if (!testInfo.project.name.includes("1440") && !testInfo.project.name.includes("430")) test.skip(); await page.goto("/app/command-center"); await page.screenshot({ path: path.join(screenshotRoot, `command-center-${testInfo.project.name.includes("1440") ? "desktop" : "mobile"}.png`), fullPage: true }); await page.goto("/app/proof-audit"); if (testInfo.project.name.includes("1440")) await page.screenshot({ path: path.join(screenshotRoot, "proof-audit-desktop.png"), fullPage: true }); });
