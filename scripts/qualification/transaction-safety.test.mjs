import assert from "node:assert/strict";
import test from "node:test";
import {
  assertFinalizationAuthorized,
  assertNoPriorDeliverySubmission,
  assertQualificationWriteAllowed,
  createGuardedSigningAccount,
  createReadOnlyClient,
  QUALIFICATION_WRITE_ALLOWLIST,
} from "./transaction-safety.mjs";
import { createClient } from "../../frontend/node_modules/genlayer-stable/dist/index.js";
import { studionet } from "../../frontend/node_modules/genlayer-stable/dist/chains/index.js";

const buyer = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const contract = "0xE8b7FCD95FA54B442e3ed114D6Cb1a016774b929";

test("the public write allowlist contains only the 13 authorized qualification calls", () => {
  assert.equal(QUALIFICATION_WRITE_ALLOWLIST.length, 13);
  for (const method of QUALIFICATION_WRITE_ALLOWLIST) assert.doesNotThrow(() => assertQualificationWriteAllowed(method));
  for (const method of ["deploy_contract", "deployContract", "finalizeTransaction", "transfer", "set_owner", ""]) {
    assert.throws(() => assertQualificationWriteAllowed(method), { code: "PROCURA_WRITE_NOT_ALLOWLISTED" });
  }
});

test("finalization requires READY_TO_FINALIZE and a remaining authorized slot", () => {
  const authorization = { allowConditionalFinalization: true, lifecycleFinalizationMaxCount: 13 };
  assert.doesNotThrow(() => assertFinalizationAuthorized("READY_TO_FINALIZE", authorization, 12));
  assert.throws(() => assertFinalizationAuthorized("ACCEPTED", authorization, 0), { code: "PROCURA_FINALIZATION_NOT_READY" });
  assert.throws(() => assertFinalizationAuthorized("READY_TO_FINALIZE", authorization, 13), { code: "PROCURA_FINALIZATION_NOT_AUTHORIZED" });
  assert.throws(() => assertFinalizationAuthorized("READY_TO_FINALIZE", { ...authorization, allowConditionalFinalization: false }, 0), { code: "PROCURA_FINALIZATION_NOT_AUTHORIZED" });
});

test("create_delivery deduplication uses canonical history when an absent delivery view cannot return null", () => {
  const awardId = "CASE:AWARD-1";
  const deliveryId = "CASE:DELIVERY-1";
  const encoded = (value) => Buffer.from(value).toString("base64");
  assert.equal(assertNoPriorDeliverySubmission([
    { hash: "0xaccept", data: { calldata: encoded('args CASE:AWARD-1 method accept_award') } },
  ], awardId, deliveryId), true);
  assert.throws(() => assertNoPriorDeliverySubmission([
    { hash: "0xprior", data: { calldata: encoded('args CASE:AWARD-1 method create_delivery') } },
  ], awardId, deliveryId), /refusing duplicate write/);
  assert.throws(() => assertNoPriorDeliverySubmission([
    { hash: "0xprior", data: { calldata: encoded('args CASE:DELIVERY-1 method create_delivery') } },
  ], awardId, deliveryId), /refusing duplicate write/);
  assert.throws(() => assertNoPriorDeliverySubmission(null, awardId, deliveryId), /history is unavailable/);
});

test("a rejected pre-sign authorization never invokes the wallet signer", async () => {
  let signatures = 0;
  const account = {
    address: buyer,
    async signTransaction() { signatures += 1; return "0xsigned"; },
  };
  const guarded = createGuardedSigningAccount(account, async () => {
    throw Object.assign(new Error("cap exceeded"), { code: "PROCURA_SPEND_CAP_PREFLIGHT" });
  });
  await assert.rejects(guarded.signTransaction({ gas: 21_000n, gasPrice: 1n, value: 0n }), { code: "PROCURA_SPEND_CAP_PREFLIGHT" });
  assert.equal(signatures, 0);
});

test("SDK fallback or retry cannot sign a second transaction for one qualification write", async () => {
  let signatures = 0;
  const account = { address: buyer, async signTransaction() { signatures += 1; return "0x01"; } };
  const guarded = createGuardedSigningAccount(account, async () => {}, async () => {});
  assert.equal(await guarded.signTransaction({ gas: 21_000n, gasPrice: 0n }), "0x01");
  await assert.rejects(guarded.signTransaction({ gas: 21_000n, gasPrice: 0n }), { code: "PROCURA_MULTIPLE_SIGNATURES_DENIED" });
  assert.equal(signatures, 1);
});

test("read-only client exposes no write, deploy, finalize or signing capability", async () => {
  let broadcasts = 0;
  let signatures = 0;
  const backing = {
    chain: { id: 61999 },
    account: { async signTransaction() { signatures += 1; } },
    async readContract() { return "read"; },
    async estimateTransactionGas() { return 21_000n; },
    async request({ method }) {
      if (["eth_sendTransaction", "eth_sendRawTransaction", "sim_fundAccount"].includes(method)) broadcasts += 1;
      return "0x1";
    },
    async writeContract() { broadcasts += 1; },
    async deployContract() { broadcasts += 1; },
    async finalizeTransaction() { broadcasts += 1; },
    async simulateWriteContract() { broadcasts += 1; },
  };
  const client = createReadOnlyClient(backing);
  assert.equal(client.writeContract, undefined);
  assert.equal(client.deployContract, undefined);
  assert.equal(client.finalizeTransaction, undefined);
  assert.equal(client.simulateWriteContract, undefined);
  assert.equal(client.account, undefined);
  assert.equal(await client.readContract({ address: contract }), "read");
  assert.equal(await client.estimateTransactionGas({ to: contract }), 21_000n);
  await assert.rejects(client.request({ method: "eth_sendRawTransaction", params: ["0x"] }), { code: "PROCURA_READ_ONLY_DENIED" });
  await assert.rejects(client.request({ method: "sim_fundAccount", params: [buyer] }), { code: "PROCURA_READ_ONLY_DENIED" });
  assert.equal(broadcasts, 0);
  assert.equal(signatures, 0);
});

test("stable Studionet simulation, gas estimation and reads use read RPCs without signing or broadcasting", async () => {
  let signatures = 0;
  const account = {
    address: buyer,
    async signTransaction() { signatures += 1; throw new Error("unexpected sign"); },
  };
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    requests.push(request);
    const result = request.method === "eth_estimateGas" ? "0x5208" : "0x";
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: request.id, result }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const client = createClient({ chain: studionet, endpoint: "https://studio.genlayer.com/api" });
    assert.equal(await client.estimateTransactionGas({ from: buyer, to: contract, data: "0x1234", value: 0n }), 21_000n);
    await client.simulateWriteContract({ account, address: contract, functionName: "create_tender", args: [], rawReturn: true });
    await client.readContract({ account, address: contract, functionName: "get_tender_ids", args: [], rawReturn: true });

    assert.deepEqual(requests.map(({ method }) => method), ["eth_estimateGas", "gen_call", "gen_call"]);
    assert.equal(requests[1].params[0].type, "write", "simulation must be marked as a simulation call");
    assert.equal(signatures, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
