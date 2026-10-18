import { describe, expect, it } from "vitest";
import { LIVE_CHAIN_ID, LIVE_CONTRACT, LIVE_CONTRACT_SHA256, LIVE_RPC, LIVE_V1_WRITE_METHODS, STUDIONET_RPC, STUDIONET_RPC_PROXY_PATH, V1_LIVE_READ_ONLY_MESSAGE, legacyV1WriteBlockReason, liveRpcEndpoint, liveV1WriteBlockReason } from "./liveConfig";

describe("V2.1.2 verified LIVE configuration and frozen V1 protection", () => {
  it("pins the verified Studionet deployment", () => {
    expect(LIVE_CHAIN_ID).toBe(61999);
    expect(STUDIONET_RPC).toBe("https://studio.genlayer.com/api");
    expect(STUDIONET_RPC_PROXY_PATH).toBe("/_genlayer/studionet");
    expect(LIVE_RPC).toBe(liveRpcEndpoint(window.location.origin));
    expect(liveRpcEndpoint("https://procura-kappa-two.vercel.app")).toBe("https://procura-kappa-two.vercel.app/_genlayer/studionet");
    expect(LIVE_CONTRACT).toBe("0xE8b7FCD95FA54B442e3ed114D6Cb1a016774b929");
    expect(LIVE_CONTRACT_SHA256).toBe("a74ae78774ea37d06af2b509d5c728d18c8f9a640a539a2f3575a17e1a28fdac");
  });
  it("keeps old V1 writes disabled for legacy targets without disabling the pinned V2 contract", () => {
    for (const method of LIVE_V1_WRITE_METHODS) {
      expect(legacyV1WriteBlockReason(method)).toBe(V1_LIVE_READ_ONLY_MESSAGE);
      expect(liveV1WriteBlockReason(method)).toBeNull();
      expect(liveV1WriteBlockReason(method, "0x0000000000000000000000000000000000000001")).toBe(V1_LIVE_READ_ONLY_MESSAGE);
    }
    expect(liveV1WriteBlockReason("unknown_method")).toBeNull();
  });
});
