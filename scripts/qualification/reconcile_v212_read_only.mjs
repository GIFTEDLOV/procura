import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "../../frontend/node_modules/genlayer-stable/dist/index.js";
import { studionet } from "../../frontend/node_modules/genlayer-stable/dist/chains/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RPC = "https://studio.genlayer.com/api";
const CONTRACT = "0xE8b7FCD95FA54B442e3ed114D6Cb1a016774b929";
const DUPLICATE_CONTRACT = "0x3801344A8963F7067f55dA584c0Df156e70326A9";
const BUYER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const SUPPLIER = "0x33653E6e86807e41682D3346CDf648D6653384B1";
const HISTORICAL_CONTRACTS = [
  "0x88634c7868B0659b46C5bd93E4038222697a0170",
  "0xBF23aFAE5188b00491F2E72d956Ef60702430cD0",
  "0x06F2b53C158C6e9a794607d4dB197654eFB3A9b1",
  "0x7BDA44c2654ea7595a54A0D15dba29692830eE8d",
  "0x3F000D007c4c5Be44FD3B075f13Bca996DD8daec",
  "0xEb8222DDc151b06a472eF0F814B8E31c7aF6D537",
];
const EXPECTED_HISTORICAL_BALANCES = {
  "0x88634c7868B0659b46C5bd93E4038222697a0170": "0",
  "0xBF23aFAE5188b00491F2E72d956Ef60702430cD0": "1000000000000000",
  "0x06F2b53C158C6e9a794607d4dB197654eFB3A9b1": "2500000000000000000",
  "0x7BDA44c2654ea7595a54A0D15dba29692830eE8d": "100000000000000",
  "0x3F000D007c4c5Be44FD3B075f13Bca996DD8daec": "100000000000000",
  "0xEb8222DDc151b06a472eF0F814B8E31c7aF6D537": "100000000000000",
};
const SOURCE_PATH = path.join(ROOT, "contracts/Procura.py");
const OUTPUT_PATH = path.join(ROOT, "evidence/qualification/current/procura-v2-studionet-v2-1-2-reconciliation-2026-10-18.json");
const REQUIRED_METHODS = ["create_tender", "submit_bid", "add_bid_evidence", "create_delivery", "add_delivery_evidence"];

const client = createClient({ chain: studionet, endpoint: RPC });
const toJSON = (value) => JSON.parse(JSON.stringify(value, (_, item) => {
  if (typeof item === "bigint") return item.toString();
  if (item instanceof Uint8Array) return `0x${Buffer.from(item).toString("hex")}`;
  return item;
}));

async function rpc(method, params) {
  return client.request({ method, params });
}

async function transactionList(address, { includeConsensus = false } = {}) {
  const response = await rpc("sim_getTransactionsForAddress", [address]);
  if (!Array.isArray(response)) throw new Error(`sim_getTransactionsForAddress returned a non-list for ${address}`);
  return response.map((tx) => {
    const rawCalldata = Buffer.from(tx.data?.calldata ?? "", "base64").toString("utf8");
    const method = REQUIRED_METHODS.concat([
      "add_requirement", "freeze_tender", "fund_tender", "begin_bid_evaluation", "adjudicate_requirement",
      "finalize_bid_evaluation", "award_bid", "accept_award", "create_delivery", "deploy_contract",
    ]).find((name) => rawCalldata.includes(name)) ?? (rawCalldata.includes("contract_code") ? "deploy_contract" : null);
    const consensus = tx.consensus_data ?? {};
    const votes = consensus.votes ?? {};
    const agrees = Object.values(votes).filter((vote) => vote === "agree").length;
    const disagrees = Object.values(votes).filter((vote) => vote === "disagree").length;
    const consensusResult = disagrees >= 3 ? "MAJORITY_DISAGREE" : agrees >= 3 ? "MAJORITY_AGREE" : null;
    const summary = {
      submissionHash: tx.hash ?? null,
      genlayerTxId: tx.tx_id ?? tx.hash ?? null,
      from: tx.from_address ?? null,
      to: tx.to_address ?? null,
      nonce: tx.nonce === undefined ? null : String(tx.nonce),
      method,
      consensusStatus: tx.status ?? null,
      consensusResult,
      resultText: typeof tx.result === "string" && tx.result.length ? tx.result : null,
      valueWei: tx.value === undefined ? null : String(tx.value),
      createdAt: tx.created_at ?? tx.created_timestamp ?? null,
    };
    if (!includeConsensus) return summary;
    return {
      ...summary,
      executionOutcome: {
        transaction: tx.tx_execution_result ?? null,
        leaders: (consensus.leader_receipt ?? []).map((item) => ({
          execution: item.execution_result ?? null,
          errorCode: item.genvm_result?.error_code ?? null,
          errorDescription: item.genvm_result?.error_description ?? null,
        })),
        validatorVotes: votes,
        validators: (consensus.validators ?? []).map((item) => ({
          address: item.address ?? null,
          vote: item.vote ?? null,
          execution: item.execution_result ?? null,
          errorCode: item.genvm_result?.error_code ?? null,
        })),
      },
      evmReceipt: null,
    };
  });
}

async function account(address) {
  const [balance, latest, pending, transactions] = await Promise.all([
    client.getBalance({ address }),
    rpc("eth_getTransactionCount", [address, "latest"]),
    rpc("eth_getTransactionCount", [address, "pending"]),
    transactionList(address),
  ]);
  return {
    address,
    balanceWei: balance.toString(),
    nonceLatest: String(BigInt(latest)),
    noncePending: String(BigInt(pending)),
    pendingNonceCount: String(BigInt(pending) - BigInt(latest)),
    transactionCount: transactions.length,
    recentTransactions: transactions.slice(0, 20).map(({ submissionHash, from, to, nonce, method, consensusStatus, consensusResult, resultText, valueWei, createdAt }) => ({
      submissionHash, from, to, nonce, method, consensusStatus, consensusResult, resultText, valueWei, createdAt,
    })),
  };
}

async function main() {
  if (client.chain.id !== 61999 || client.chain.name !== "Genlayer Studio Network") throw new Error("Stable SDK is not configured for Studionet");
  const chainId = await rpc("eth_chainId", []);
  if (Number(BigInt(chainId)) !== 61999) throw new Error(`RPC chain ID mismatch: ${chainId}`);
  const source = await fs.readFile(SOURCE_PATH);
  const sourceSha256 = crypto.createHash("sha256").update(source).digest("hex");
  const deployedSource = await client.getContractCode(CONTRACT);
  const deployedSha256 = crypto.createHash("sha256").update(deployedSource).digest("hex");
  if (deployedSha256 !== sourceSha256) throw new Error("Deployed contract source differs from current candidate");
  const runtimeSchema = await client.getContractSchema(CONTRACT);
  const localSchema = JSON.parse(await fs.readFile(path.join(ROOT, "contracts/schema.v2.evidence.json"), "utf8"));
  const methods = Object.fromEntries(REQUIRED_METHODS.map((name) => [name, {
    runtime: runtimeSchema.methods[name]?.params ?? null,
    shared: localSchema.methods.find((item) => item.name === name) ?? null,
  }]));
  const tenders = await client.readContract({ address: CONTRACT, functionName: "get_tender_ids", args: [] });
  const cases = {};
  for (const tenderId of tenders) {
    const record = { tender: null, requirements: [], bids: [], bidEvidence: {}, adjudications: {} };
    record.tender = toJSON(await client.readContract({ address: CONTRACT, functionName: "get_tender", args: [tenderId] }));
    record.requirements = toJSON(await client.readContract({ address: CONTRACT, functionName: "get_requirements", args: [tenderId] }));
    record.bids = toJSON(await client.readContract({ address: CONTRACT, functionName: "get_bids", args: [tenderId] }));
    for (const bid of record.bids) {
      record.bidEvidence[bid.bid_id] = toJSON(await client.readContract({ address: CONTRACT, functionName: "get_evidence", args: ["BID", bid.bid_id] }));
      for (const requirement of record.requirements) {
        try {
          record.adjudications[`${bid.bid_id}:${requirement.requirement_id}`] = toJSON(await client.readContract({
            address: CONTRACT,
            functionName: "get_adjudication",
            args: [bid.bid_id, requirement.requirement_id],
          }));
        } catch {
          record.adjudications[`${bid.bid_id}:${requirement.requirement_id}`] = null;
        }
      }
    }
    cases[tenderId] = record;
  }
  const auditEvents = toJSON(await client.readContract({ address: CONTRACT, functionName: "get_audit_events", args: [] }));
  const txs = await transactionList(CONTRACT, { includeConsensus: true });
  for (const tx of txs) {
    if (!tx.submissionHash) continue;
    try {
      const canonical = await client.getTransaction({ hash: tx.submissionHash });
      tx.consensusStatus = canonical.statusName ?? canonical.status_name ?? tx.consensusStatus;
      tx.consensusResult = canonical.resultName ?? canonical.result_name ?? tx.consensusResult;
      tx.executionOutcome.transaction = canonical.txExecutionResultName ?? canonical.tx_execution_result_name ?? canonical.txExecutionResult ?? canonical.tx_execution_result ?? null;
      const canonicalConsensus = canonical.consensus_data ?? canonical.consensusData ?? {};
      const leader = canonicalConsensus.leader_receipt?.[0] ?? canonicalConsensus.leader_receipt;
      if (leader) tx.executionOutcome.leaders = [{
        execution: leader.execution_result ?? leader.executionResult ?? null,
        errorCode: leader.genvm_result?.error_code ?? leader.genvmResult?.error_code ?? null,
        errorDescription: leader.genvm_result?.error_description ?? leader.genvmResult?.error_description ?? null,
      }];
      if (canonicalConsensus.votes) tx.executionOutcome.validatorVotes = canonicalConsensus.votes;
      if (Array.isArray(canonicalConsensus.validators)) tx.executionOutcome.validators = canonicalConsensus.validators.map((item) => ({
        address: item.address ?? item.validator_address ?? null,
        vote: item.vote ?? null,
        execution: item.execution_result ?? item.executionResult ?? null,
        errorCode: item.genvm_result?.error_code ?? item.genvmResult?.error_code ?? null,
      }));
      if (typeof canonical.result === "string" && canonical.result.length) tx.executionOutcome.resultText = canonical.result;
      const receipt = await rpc("eth_getTransactionReceipt", [tx.submissionHash]);
      tx.evmReceipt = receipt ? toJSON(receipt) : null;
    } catch {
      tx.evmReceipt = null;
    }
  }
  const contract2Transactions = await transactionList(DUPLICATE_CONTRACT, { includeConsensus: true });
  const historicalEscrow = {};
  for (const address of HISTORICAL_CONTRACTS) historicalEscrow[address] = (await client.getBalance({ address })).toString();
  const historicalEscrowUnchanged = HISTORICAL_CONTRACTS.every((address) => historicalEscrow[address] === EXPECTED_HISTORICAL_BALANCES[address]);
  const accounting = toJSON(await client.readContract({ address: CONTRACT, functionName: "get_accounting", args: [] }));
  const report = {
    recordedAt: new Date().toISOString(),
    mode: "READ_ONLY_CANONICAL_RECONCILIATION",
    writesPerformed: false,
    network: { name: client.chain.name, chainId: 61999, rpc: RPC, explorer: "https://explorer-studio.genlayer.com" },
    contract: {
      address: CONTRACT,
      sourceSha256,
      deployedSourceSha256: deployedSha256,
      schemaVersion: (await client.readContract({ address: CONTRACT, functionName: "get_protocol_info", args: [] })).schema_version,
      methodCount: Object.keys(runtimeSchema.methods).length,
      requiredMethodSchemaParity: methods,
      balanceWei: (await client.getBalance({ address: CONTRACT })).toString(),
      accounting,
      tenderIds: tenders,
      cases,
      auditEvents,
      recentContractTransactions: txs,
    },
    signerAccounts: {
      buyer: await account(BUYER),
      supplier: await account(SUPPLIER),
    },
    duplicateDeployment: {
      address: DUPLICATE_CONTRACT,
      balanceWei: (await client.getBalance({ address: DUPLICATE_CONTRACT })).toString(),
      transactions: contract2Transactions,
    },
    historicalContractBalancesWei: historicalEscrow,
    historicalEscrowUnchanged,
  };
  if (!historicalEscrowUnchanged) throw new Error("A historical contract balance differs from the prior read-only checkpoint; reconcile before any write");
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  const temp = `${OUTPUT_PATH}.tmp`;
  const handle = await fs.open(temp, "w");
  try {
    await handle.writeFile(`${JSON.stringify(toJSON(report), null, 2)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(temp, OUTPUT_PATH);
  console.log(JSON.stringify({
    output: path.relative(ROOT, OUTPUT_PATH),
    sourceSha256,
    tenderCount: tenders.length,
    transactionCount: txs.length,
    accounting,
    buyer: { balanceWei: report.signerAccounts.buyer.balanceWei, nonceLatest: report.signerAccounts.buyer.nonceLatest, noncePending: report.signerAccounts.buyer.noncePending },
    supplier: { balanceWei: report.signerAccounts.supplier.balanceWei, nonceLatest: report.signerAccounts.supplier.nonceLatest, noncePending: report.signerAccounts.supplier.noncePending },
  }, null, 2));
}

main().catch((error) => {
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});
