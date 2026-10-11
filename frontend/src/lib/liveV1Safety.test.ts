import { describe, expect, it, vi } from "vitest";
import { executeLiveWrite } from "./liveAdapter";
import { BUYER_ROLE_ADDRESS, LIVE_CHAIN_ID, LIVE_V1_WRITE_METHODS, V1_LIVE_READ_ONLY_MESSAGE } from "./liveConfig";

describe("V1 guarded application write runner", () => {
  it("fails closed for every deployed V1 write before SDK activity", async () => {
    expect(LIVE_V1_WRITE_METHODS).toHaveLength(25);
    const client = {
      chain: { id: LIVE_CHAIN_ID },
      simulateWriteContract: vi.fn(),
      estimateTransactionFees: vi.fn(),
      writeContract: vi.fn(),
      waitForFinalization: vi.fn(),
    } as unknown as Parameters<typeof executeLiveWrite>[0]["client"];
    const storage = { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() };

    for (const method of LIVE_V1_WRITE_METHODS) {
      const action = { method, args: [], kwargs: {}, requestId: `blocked-${method}`, value: 0n } as unknown as Parameters<typeof executeLiveWrite>[0]["action"];
      await expect(executeLiveWrite({ client, action, account: BUYER_ROLE_ADDRESS, storage, canonicalReadback: async () => ({}) })).rejects.toThrow(V1_LIVE_READ_ONLY_MESSAGE);
    }

    expect(client.simulateWriteContract).not.toHaveBeenCalled();
    expect(client.estimateTransactionFees).not.toHaveBeenCalled();
    expect(client.writeContract).not.toHaveBeenCalled();
    expect(client.waitForFinalization).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
