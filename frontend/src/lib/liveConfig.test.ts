import { describe, expect, it } from "vitest";
import { LIVE_CONTRACT_SHA256, LIVE_V1_WRITE_METHODS, V1_LIVE_READ_ONLY_MESSAGE, liveV1WriteBlockReason } from "./liveConfig";

describe("V1 safety configuration", () => {
  it("preserves the frozen source provenance", () => {
    expect(LIVE_CONTRACT_SHA256).toBe("daad9b0c43be603e522afbf55623e7b8027d7de3b01708922360ae5a45972cde");
  });

  it("blocks every known V1 write and allows no unknown write by accident", () => {
    for (const method of LIVE_V1_WRITE_METHODS) expect(liveV1WriteBlockReason(method)).toBe(V1_LIVE_READ_ONLY_MESSAGE);
    expect(liveV1WriteBlockReason("unknown_method")).toBeNull();
  });
});
