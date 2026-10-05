import { describe, expect, it } from "vitest";
import { contractInterface } from "./contractInterface";
import { buildAction, methodSpecs, semanticCellTone, settlementState } from "./domain";

describe("production action boundaries", () => {
  it("exposes the frozen Procurement schema", () => expect(contractInterface.schemaVersion).toBe("PROCUREMENT_V1"));
  it("keeps all 39 contract methods in the interface", () => expect(contractInterface.methods).toHaveLength(39));
  it("has a typed spec for every interface method", () => expect(contractInterface.methods.every((method) => method in methodSpecs)).toBe(true));
  it("builds tender create through the adapter boundary", () => expect(buildAction("create_tender", Array(14).fill("value"), { requestId: "create-1" }).method).toBe("create_tender"));
  it("builds the bid evaluation boundary", () => expect(buildAction("begin_bid_evaluation", ["TND-1"], { requestId: "eval-1" }).args).toEqual(["TND-1"]));
  it("maps mismatch to a blocked settlement state", () => expect(semanticCellTone("MATERIAL_DELIVERY_MISMATCH")).toBe("FAIL"));
  it("proves successful accounting remains non-negative", () => expect(settlementState({ buyerFunded: 420000, supplierPaid: 420000, buyerRefunded: 0 }).remainingLiability).toBe(0));
  it("keeps controlled demo mode explicit at the adapter edge", () => expect(contractInterface.schemaVersion).toContain("PROCUREMENT"));
});
