import { describe, expect, it } from "vitest";
import { legacyV1WriteBlockReason, liveV1WriteBlockReason, LIVE_V1_WRITE_METHODS, V1_LIVE_READ_ONLY_MESSAGE } from "./liveConfig";

describe("legacy V1 write protection and active V2 LIVE functionality", () => {
  it("continues rejecting every immutable unsafe V1 method", () => {
    expect(LIVE_V1_WRITE_METHODS).toHaveLength(25);
    for (const method of LIVE_V1_WRITE_METHODS) {
      expect(legacyV1WriteBlockReason(method)).toBe(V1_LIVE_READ_ONLY_MESSAGE);
    }
  });
  it("allows overlapping method names only at the pinned V2.1.2 target", () => {
    for (const method of ["create_tender","submit_bid","add_bid_evidence","create_delivery","add_delivery_evidence"]) {
      expect(liveV1WriteBlockReason(method)).toBeNull();
      expect(liveV1WriteBlockReason(method, "0x0000000000000000000000000000000000000001")).toBe(V1_LIVE_READ_ONLY_MESSAGE);
    }
  });
});
