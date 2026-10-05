import { describe, expect, it } from "vitest";
import { bidArgsSchema, serializeBid } from "./serialization";

describe("contract serialization", () => {
  it("matches the frozen bid argument order", () => {
    const values = { bidId: "BID-1", tenderId: "TND-1", price: 100, currency: "USDC", deliveryCommitment: "30 days", requirementResponses: "frozen", submittedAt: "2026-10-05T09:00:00+01:00", bidHash: "a".repeat(64) };
    expect(serializeBid(values)).toEqual(["BID-1", "TND-1", 100, "USDC", "30 days", "frozen", "2026-10-05T09:00:00+01:00", "a".repeat(64)]);
  });
  it("rejects prefixed hashes", () => {
    expect(() => bidArgsSchema.parse({ bidId: "BID-1", tenderId: "TND-1", price: 100, currency: "USDC", deliveryCommitment: "30 days", requirementResponses: "frozen", submittedAt: "2026-10-05T09:00:00+01:00", bidHash: `0x${"a".repeat(64)}` })).toThrow();
  });
});
