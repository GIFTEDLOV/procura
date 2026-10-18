import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { demoData } from "../lib/demoData";
import type { RouteKey } from "../components/Shell";
import type { WalletState } from "../lib/wallet";
import { ProductScreens } from "./ProductScreens";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const roots: Array<{ root: Root; host: HTMLDivElement }> = [];
const wallet: WalletState = { provider: null, address: null, chainId: 61999, role: "disconnected", error: null };

async function renderLiveScreen(route: RouteKey) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  roots.push({ root, host });
  await act(async () => root.render(createElement(ProductScreens, {
    route,
    mode: "LIVE",
    demo: demoData,
    live: null,
    wallet,
    onNavigate: vi.fn(),
    onRefresh: vi.fn(),
    runAction: vi.fn(async () => undefined),
  })));
  return host;
}

afterEach(async () => {
  for (const { root, host } of roots.splice(0)) {
    await act(async () => root.unmount());
    host.remove();
  }
});

describe("qualified Studionet V2 live action controls", () => {
  it("enables create_tender in LIVE mode", async () => {
    const host = await renderLiveScreen("tender-builder");
    const button = [...host.querySelectorAll("button")].find((item) => item.textContent?.includes("Create LIVE tender"));
    expect(button).toBeTruthy();
    expect(button?.disabled).toBe(false);
    expect((host.querySelector('input[value="FULL"]') as HTMLInputElement | null)?.value).toBe("FULL");
    expect(host.textContent).not.toContain("V1 is operating in read-only safety mode");
  });

  it("enables submit_bid and add_bid_evidence in LIVE mode", async () => {
    const host = await renderLiveScreen("bid-builder");
    const labels = [...host.querySelectorAll("button")].map((item) => item.textContent ?? "");
    expect(labels.some((label) => label.includes("Submit LIVE bid"))).toBe(true);
    expect(labels.some((label) => label.includes("Attach evidence to contract"))).toBe(true);
    expect([...host.querySelectorAll("button")].filter((item) => item.textContent?.includes("Submit LIVE bid") || item.textContent?.includes("Attach evidence to contract")).every((item) => !item.disabled)).toBe(true);
  });

  it("enables create_delivery and add_delivery_evidence in LIVE mode", async () => {
    const host = await renderLiveScreen("delivery-workspace");
    const labels = [...host.querySelectorAll("button")].map((item) => item.textContent ?? "");
    expect(labels.some((label) => label.includes("Create LIVE delivery"))).toBe(true);
    expect(labels.some((label) => label.includes("Attach evidence to contract"))).toBe(true);
    expect([...host.querySelectorAll("button")].filter((item) => item.textContent?.includes("Create LIVE delivery") || item.textContent?.includes("Attach evidence to contract")).every((item) => !item.disabled)).toBe(true);
  });

  it("renders all 13 verified Studionet transaction links and the canonical evidence identity", async () => {
    const host = await renderLiveScreen("proof-audit");
    const links = [...host.querySelectorAll<HTMLAnchorElement>('a[href*="explorer-studio.genlayer.com/tx/"]')];
    expect(links).toHaveLength(13);
    expect(host.textContent).toContain("adjudicate_requirement / COMPLIANT");
    expect(host.textContent).toContain("add_delivery_evidence / DELIVERED");
    expect(host.textContent).toContain("0695982b068f8043a21b6d3ccfc10b5cb7aa5e945186a1e10fbe6f7113dd48cf");
    expect(host.textContent).toContain("2144");
    for (const link of links) {
      expect(link.href).toContain(link.querySelector("code")?.textContent ?? "invalid");
      expect(link.href).toMatch(/^https:\/\/explorer-studio\.genlayer\.com\/tx\/0x[0-9a-f]{64}$/);
    }
  });
});
