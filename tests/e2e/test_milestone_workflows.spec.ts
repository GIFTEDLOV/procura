import { expect, test } from "@playwright/test";
import path from "node:path";

const screenshotDir = path.resolve(process.cwd(), "..", "docs", "assets", "screenshots");

test("complete end-to-end user workflow across all 4 milestone pillars", async ({ page }) => {
  // 1. Landing Page
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Procurement you can prove." })).toBeVisible();
  await expect(page.getByText("Requirement", { exact: true })).toBeVisible();
  await expect(page.getByText("COMPLIANT", { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: path.join(screenshotDir, "e2e-live-1-landing.png"), fullPage: true });

  // Enter app
  await page.getByRole("button", { name: /Open Procura/i }).first().click();
  await expect(page).toHaveURL(/\/app\/command-center/);
  await expect(page.getByText("Good morning, Northstar.")).toBeVisible();
  await page.screenshot({ path: path.join(screenshotDir, "e2e-live-2-command-center.png"), fullPage: true });

  // 2. Pillar 1: Comparative Multi-Vendor AI Consensus
  await page.goto("/app/evaluation-room");
  await expect(page.getByText("Multi-Vendor Comparative AI Consensus")).toBeVisible();
  await expect(page.getByText("BID-APEX-02").first()).toBeVisible();
  const executeBtn = page.getByRole("button", { name: /Execute Comparative Consensus/i });
  await expect(executeBtn).toBeVisible();
  await executeBtn.click();
  await expect(page.getByText("GenLayer comparative consensus finalized with 100% agreement.")).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: path.join(screenshotDir, "e2e-live-3-comparative-consensus.png"), fullPage: true });

  // 3. Pillar 2: Sealed-Bid Commit/Reveal RFQ
  await page.goto("/app/bid-builder");
  await expect(page.getByText("Pillar 2 · Cryptographic RFQ")).toBeVisible();
  const commitBtn = page.getByRole("button", { name: /Broadcast Blinded Commitment/i });
  await expect(commitBtn).toBeVisible();
  await commitBtn.click();
  await expect(page.getByText("Blinded commitment hash successfully recorded on GenLayer Studionet.")).toBeVisible({ timeout: 10000 });
  
  // Switch to reveal tab
  await page.getByRole("button", { name: /2\. Reveal Phase/i }).click();
  const revealBtn = page.getByRole("button", { name: /Reveal & Verify Sealed Bid/i });
  await expect(revealBtn).toBeVisible();
  await revealBtn.click();
  await expect(page.getByText("Revealed bid parameters verified against commitment hash and opened for evaluation.")).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: path.join(screenshotDir, "e2e-live-4-sealed-bid-lab.png"), fullPage: true });

  // 4. Pillar 3: Multi-Tranche Milestone Escrow & Bond Slashing
  await page.goto("/app/delivery-workspace");
  await expect(page.getByText("Multi-Tranche Milestone Progress Tracker")).toBeVisible();
  const releaseTrancheBtn = page.getByRole("button", { name: "Release Tranche" }).first();
  await expect(releaseTrancheBtn).toBeVisible();
  await releaseTrancheBtn.click();
  await expect(page.getByText(/escrow tranche released to supplier/i)).toBeVisible({ timeout: 10000 });

  // Slash supplier bond
  const slashBondBtn = page.getByRole("button", { name: /Slash Bond Penalty/i });
  await expect(slashBondBtn).toBeVisible();
  await slashBondBtn.click();
  await expect(page.getByText("Liquidated damages penalty of 25% slashed from supplier bond.")).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: path.join(screenshotDir, "e2e-live-5-milestones-and-slashing.png"), fullPage: true });

  // 5. Pillar 4: Verifiable Proof & Audit Room
  await page.goto("/app/proof-audit");
  await expect(page.getByText("Auditor Verifiable Certificate Room")).toBeVisible();
  await expect(page.getByRole("button", { name: /Download Verifiable Certificate/i })).toBeVisible();
  await page.screenshot({ path: path.join(screenshotDir, "e2e-live-6-verifiable-audit.png"), fullPage: true });
});
