import crypto from "node:crypto";
import fs from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { keccak256 } from "../../frontend/node_modules/viem/_esm/utils/hash/keccak256.js";
import {
  assertFinalizationAuthorized,
  assertNoPriorDeliverySubmission,
  assertQualificationWriteAllowed,
  createGuardedSigningAccount,
  createReadOnlyClient,
} from "./transaction-safety.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RPC = "https://studio.genlayer.com/api";
const CHAIN_ID = 61999;
const CONSENSUS_MAIN = "0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575";
const ADDRESS_MANAGER_SELECTOR = "0x5492f302";
const EXPLORER = "https://explorer-studio.genlayer.com";
const BUYER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const SUPPLIER = "0x33653E6e86807e41682D3346CDf648D6653384B1";
const SOURCE_PATH = [
  path.join(ROOT, "contracts", "ProcuraV2Evidence.py"),
  path.join(ROOT, "contracts", "Procura.py"),
  path.join(ROOT, "contracts", "Procura_studionet_v2_1_2.py"),
].find(existsSync) ?? path.join(ROOT, "contracts", "ProcuraV2Evidence.py");
const SCHEMA_PATH = path.join(ROOT, "contracts", "schema.v2.evidence.json");
const ABI_PATH = path.join(ROOT, "contracts", "abi.v2.evidence.json");
const INTERFACE_PATH = path.join(ROOT, "contracts", "interface.v2.evidence.json");
const EVIDENCE_PATH = path.join(ROOT, "evidence", "qualification", "fixtures", "genlayer-js-1b7f50a3-package.json");
const EVIDENCE_URL = "https://raw.githubusercontent.com/genlayerlabs/genlayer-js/1b7f50a3a3f2963ea857941b0fb386081dd5c326/package.json";
const EVIDENCE_MIRROR_URL = "https://cdn.jsdelivr.net/gh/genlayerlabs/genlayer-js@1b7f50a3a3f2963ea857941b0fb386081dd5c326/package.json";
const EVIDENCE_AUTHORITY = "GenLayer Labs official GitHub repository";
const EVIDENCE_TYPE = "OFFICIAL_PACKAGE_MANIFEST";
const EVIDENCE_PUBLISHED_AT = "2026-06-10T14:45:30.000Z";
const EXPECTED_EVIDENCE_SHA256 = "0695982b068f8043a21b6d3ccfc10b5cb7aa5e945186a1e10fbe6f7113dd48cf";
const EVIDENCE_DIR = path.join(ROOT, "evidence", "qualification", "current");
const AUTHORIZATION_PATH = path.join(EVIDENCE_DIR, "procura-v2-studionet-v2-1-2-authorization.json");
const DEPLOYMENT_RECONCILIATION_PATH = path.join(EVIDENCE_DIR, "procura-v2-studionet-v2-1-2-deployment-reconciliation.json");
const resume = process.argv.includes("--resume");
const execute = process.argv.includes("--execute");
const reuseContractAddress = process.argv.find((arg) => arg.startsWith("--reuse-contract-address="))?.split("=")[1] ?? null;
const LOCK_PATH = path.join(EVIDENCE_DIR, "procura-v2-studionet-v2-1-2-attempt.lock");
const JOURNAL_PATH = path.join(EVIDENCE_DIR, "procura-v2-studionet-v2-1-2-live.json");
const APPROVED_SOURCE_SHA = "a74ae78774ea37d06af2b509d5c728d18c8f9a640a539a2f3575a17e1a28fdac";
const APPROVED_SCHEMA_SHA = "8c9aa8c79135e8a923a7de54e9ef3f680df7cd2894ac5ba7e8fd33dc89e2c074";
const APPROVED_ABI_SHA = "97015697a9252c5c2b86f4e72d76a926775eca14ec7add6c743ece0609edd800";
const APPROVED_INTERFACE_SHA = "370468a990b1323ba7091cba6cfa40d93f4ebfeb5aa8a909edd192caedb6b1dd";
const SPEND_CAP = 1_000_000_000_000_000n;
const ESCROW = 100_000_000_000_000n;
const OLD_CONTRACTS = [
  "0x88634c7868B0659b46C5bd93E4038222697a0170",
  "0xBF23aFAE5188b00491F2E72d956Ef60702430cD0",
  "0x06F2b53C158C6e9a794607d4dB197654eFB3A9b1",
  "0x7BDA44c2654ea7595a54A0D15dba29692830eE8d",
  "0x3F000D007c4c5Be44FD3B075f13Bca996DD8daec",
  "0xEb8222DDc151b06a472eF0F814B8E31c7aF6D537",
];

const USAGE = "Usage: node studionet_evidence_qualification.mjs <genlayer-js-dist> <keytar-js> [--resume] [--reuse-contract-address=<verified-address>] [--execute --approved-source-sha=<sha256> --approved-max-gen=1000000000000000]";
if (process.argv.slice(2).some((arg) => arg === "--help" || arg === "-h")) {
  console.log(`${USAGE}\nWithout --execute this command performs read-only preflight only. Public execution additionally requires the user-approved exact-scope authorization record at evidence/qualification/current/procura-v2-studionet-v2-1-2-authorization.json.`);
  process.exit(0);
}
const sdkPath = process.argv[2];
const keytarPath = process.argv[3];
if (!sdkPath || !keytarPath) throw new Error(USAGE);

const jsonSafe = (value) => {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array) return `0x${Buffer.from(value).toString("hex")}`;
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") {
    const output = {};
    for (const [key, item] of Object.entries(value)) output[key] = jsonSafe(item);
    return output;
  }
  return value;
};

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const stableJSON = (value) => JSON.stringify(jsonSafe(value), null, 2);
const now = () => new Date().toISOString();

async function persist(state) {
  await fs.mkdir(EVIDENCE_DIR, { recursive: true });
  const temp = `${JOURNAL_PATH}.tmp`;
  const handle = await fs.open(temp, "w");
  try {
    await handle.writeFile(stableJSON(state), "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(temp, JOURNAL_PATH);
}

async function readJSON(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function verifyQualificationArtifact() {
  const fixture = await fs.readFile(EVIDENCE_PATH);
  assert(sha256(fixture) === EXPECTED_EVIDENCE_SHA256, "qualification evidence fixture hash mismatch");
  const urls = [EVIDENCE_URL, EVIDENCE_MIRROR_URL];
  const fetched = await Promise.all(urls.map(async (url) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    assert(response.ok, `qualification evidence fetch failed (${response.status}) from ${new URL(url).hostname}`);
    return new Uint8Array(await response.arrayBuffer());
  }));
  for (const bytes of fetched) {
    assert(bytes.byteLength === fixture.byteLength, "independent evidence provider byte length mismatch");
    assert(sha256(bytes) === EXPECTED_EVIDENCE_SHA256, "independent evidence provider hash mismatch");
    assert(Buffer.from(bytes).equals(fixture), "independent evidence provider bytes differ from pinned fixture");
  }
  const manifest = JSON.parse(fixture.toString("utf8"));
  assert(manifest.name === "genlayer-js" && manifest.version === "1.1.8", "pinned artifact does not substantiate the frozen qualification requirement");
  return {
    sha256: EXPECTED_EVIDENCE_SHA256,
    byteLength: fixture.byteLength,
    sourceUrl: EVIDENCE_URL,
    mirrorHost: new URL(EVIDENCE_MIRROR_URL).hostname,
    authority: EVIDENCE_AUTHORITY,
    evidenceType: EVIDENCE_TYPE,
    publishedAt: EVIDENCE_PUBLISHED_AT,
    observedAt: now(),
    providersVerified: urls.map((url) => new URL(url).hostname),
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function txSummary(tx) {
  const resultName = tx?.result_name ?? tx?.resultName ?? (typeof tx?.result === "string" ? tx.result.toUpperCase() : ({ 0: "IDLE", 1: "AGREE", 2: "DISAGREE", 3: "TIMEOUT", 4: "DETERMINISTIC_VIOLATION", 5: "NO_MAJORITY", 6: "MAJORITY_AGREE", 7: "MAJORITY_DISAGREE" }[String(tx?.result)] ?? null));
  const executionCode = tx?.txExecutionResult ?? tx?.tx_execution_result ?? null;
  const executionName = tx?.txExecutionResultName ?? tx?.tx_execution_result_name ?? ({ 0: "NOT_VOTED", 1: "FINISHED_WITH_RETURN", 2: "FINISHED_WITH_ERROR" }[String(executionCode)] ?? null);
  const statuses = {
    0: "UNINITIALIZED", 1: "PENDING", 2: "PROPOSING", 3: "COMMITTING",
    4: "REVEALING", 5: "ACCEPTED", 6: "UNDETERMINED", 7: "FINALIZED",
    8: "CANCELED", 9: "APPEAL_REVEALING", 10: "APPEAL_COMMITTING",
    11: "READY_TO_FINALIZE", 12: "VALIDATORS_TIMEOUT", 13: "LEADER_TIMEOUT",
  };
  const statusName = tx?.statusName ?? tx?.status_name ?? (typeof tx?.status === "string" ? tx.status : statuses[String(tx?.status)] ?? null);
  return {
    hash: tx?.hash ?? tx?.tx_id ?? tx?.txId,
    submissionHash: tx?.hash ?? null,
    genlayerTxId: tx?.tx_id ?? tx?.txId ?? null,
    status: tx?.status,
    statusName,
    result: tx?.result,
    resultName,
    txExecutionResult: executionName ?? executionCode,
    txExecutionResultCode: executionCode,
    contractAddress: tx?.data?.contract_address ?? null,
    from: tx?.from_address ?? tx?.sender ?? null,
    to: tx?.to_address ?? tx?.recipient ?? null,
    value: tx?.value ?? null,
    createdAt: tx?.created_at ?? tx?.created_timestamp ?? null,
    timestamp: tx?.timestamp ?? tx?.current_timestamp ?? null,
    numOfRounds: tx?.num_of_rounds ?? null,
    lastRound: tx?.last_round ?? null,
    consensusData: tx?.consensus_data ? jsonSafe(tx.consensus_data) : null,
    nonce: tx?.nonce ?? null,
  };
}

function assertFinalMajorityAgree(tx, label) {
  const summary = txSummary(tx);
  assert(summary.statusName === "FINALIZED", `${label}: not finalized`);
  assert(summary.resultName === "MAJORITY_AGREE" || Number(summary.result) === 6, `${label}: not MAJORITY_AGREE (${summary.resultName})`);
  const execution = summary.txExecutionResult;
  if (execution !== null && execution !== undefined) {
    const normalized = typeof execution === "string" ? execution.toUpperCase() : Number(execution) === 1 ? "SUCCESS" : String(execution);
    assert(["SUCCESS", "SUCCEEDED", "FINISHED", "FINISHED_WITH_RETURN", "1"].includes(normalized), `${label}: transaction execution failed (${execution})`);
  }
  const validators = tx?.consensus_data?.validators ?? tx?.data?.consensus_data?.validators ?? [];
  const leader = tx?.consensus_data?.leader_receipt?.[0] ?? tx?.consensus_data?.leader_receipt;
  if (leader) assert(leader.execution_result === "SUCCESS" || leader.execution_result === "FINISHED_WITH_RETURN", `${label}: leader execution failed`);
  const validatorErrors = validators.filter((item) => {
    const result = item?.execution_result ?? item?.executionResult;
    const code = item?.genvm_result?.error_code ?? item?.genvmResult?.error_code;
    return result && result !== "SUCCESS" && result !== "FINISHED_WITH_RETURN" && code !== "CONSENSUS_VALIDATOR_QUORUM_REACHED";
  });
  assert(validatorErrors.length === 0, `${label}: unsuccessful validator execution`);
  const successfulValidators = validators.filter((item) => item?.execution_result === "SUCCESS" || item?.executionResult === "FINISHED_WITH_RETURN");
  if (validators.length) assert(successfulValidators.length >= 2, `${label}: insufficient successful validator executions`);
  summary.executionOutcome = {
    transaction: summary.txExecutionResult,
    leader: leader?.execution_result ?? leader?.executionResult ?? null,
    validatorsExecutedSuccessfully: successfulValidators.length,
    validatorCount: validators.length,
    validatorErrors: jsonSafe(validatorErrors),
  };
  assert(summary.executionOutcome.leader, `${label}: leader execution outcome unavailable`);
  return summary;
}

function executionObservation(tx) {
  const consensus = tx?.consensus_data ?? tx?.data?.consensus_data ?? {};
  const validators = consensus.validators ?? [];
  const leader = consensus.leader_receipt?.[0] ?? consensus.leader_receipt;
  return {
    transaction: tx?.txExecutionResultName ?? tx?.tx_execution_result_name ?? tx?.txExecutionResult ?? tx?.tx_execution_result ?? null,
    leader: leader?.execution_result ?? leader?.executionResult ?? null,
    validatorsExecutedSuccessfully: validators.filter((item) => ["SUCCESS", "FINISHED_WITH_RETURN"].includes(item?.execution_result ?? item?.executionResult)).length,
    validatorCount: validators.length,
    validatorOutcomes: validators.map((item) => ({
      result: item?.execution_result ?? item?.executionResult ?? null,
      error: item?.genvm_result?.error_code ?? item?.genvmResult?.error_code ?? null,
      vote: item?.vote ?? null,
    })),
  };
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function verifyStudionet(client) {
  assert(client.chain?.id === CHAIN_ID && client.chain?.name === "Genlayer Studio Network", "configured SDK chain is not GenLayer Studionet");
  assert(client.chain?.rpcUrls?.default?.http?.includes(RPC), "SDK Studionet configuration does not include the official Studio RPC");
  assert(client.chain?.consensusMainContract?.address?.toLowerCase() === CONSENSUS_MAIN.toLowerCase(), "SDK Studionet ConsensusMain configuration changed");
  const chainId = await client.request({ method: "eth_chainId" });
  assert(Number(BigInt(chainId)) === CHAIN_ID, `RPC chain mismatch: ${chainId}`);
  const managerResult = await client.request({ method: "eth_call", params: [{ to: CONSENSUS_MAIN, data: ADDRESS_MANAGER_SELECTOR }, "latest"] });
  assert(typeof managerResult === "string" && /^0x[0-9a-fA-F]{64}$/.test(managerResult), "Studionet ConsensusMain identity call returned malformed data");
  const addressManager = `0x${managerResult.slice(-40)}`;
  assert(!/^0x0{40}$/i.test(addressManager), "Studionet ConsensusMain returned a zero AddressManager");
  return { chain: client.chain.name, chainId: CHAIN_ID, rpc: RPC, consensusMain: CONSENSUS_MAIN, addressManager, explorer: EXPLORER };
}

async function nonceSnapshot(client, address) {
  const [latest, pending] = await Promise.all([
    client.request({ method: "eth_getTransactionCount", params: [address, "latest"] }),
    client.request({ method: "eth_getTransactionCount", params: [address, "pending"] }),
  ]);
  return { latest: String(BigInt(latest)), pending: String(BigInt(pending)) };
}

async function readFeeProfile(client) {
  const [sampleGas, gasPrice] = await Promise.all([
    client.estimateTransactionGas({ to: CONSENSUS_MAIN, data: "0x", value: 0n }),
    client.request({ method: "eth_gasPrice" }),
  ]);
  const gasPriceWei = BigInt(gasPrice);
  return {
    sampledAt: now(),
    estimateMethod: "genlayer-js@1.1.8 estimateTransactionGas + eth_gasPrice",
    emptyConsensusMainPayloadGas: sampleGas.toString(),
    gasPriceWei: gasPriceWei.toString(),
    emptyPayloadFeeWei: (sampleGas * gasPriceWei).toString(),
    note: "Empty-payload sample is not an estimate for deployment or qualification calldata; genlayer-js estimates each actual calldata during submission. Aggregate GEN debit remains capped separately.",
  };
}

async function findHashForNonce(client, address, nonce) {
  const transactions = await client.request({
    method: "sim_getTransactionsForAddress",
    params: [address],
  });
  assert(Array.isArray(transactions), "Studionet transaction lookup returned an invalid result");
  const target = BigInt(nonce);
  const matches = transactions.filter((tx) =>
    String(tx?.from ?? tx?.from_address ?? tx?.sender ?? "").toLowerCase() === address.toLowerCase()
    && tx?.nonce !== undefined
    && BigInt(tx.nonce) === target
    && /^0x[0-9a-fA-F]{64}$/.test(tx?.hash ?? "")
  );
  assert(matches.length <= 1, `multiple Studionet transactions match signer nonce ${target}`);
  return matches[0]?.hash ?? null;
}

async function findTransactionForNonce(client, address, nonce, expectedTarget) {
  const transactions = await client.request({ method: "sim_getTransactionsForAddress", params: [address] });
  assert(Array.isArray(transactions), "Studionet transaction lookup returned an invalid result");
  const target = BigInt(nonce);
  const matches = transactions.filter((tx) =>
    String(tx?.from ?? tx?.from_address ?? tx?.sender ?? "").toLowerCase() === address.toLowerCase()
    && tx?.nonce !== undefined
    && BigInt(tx.nonce) === target
    && /^0x[0-9a-fA-F]{64}$/.test(tx?.hash ?? "")
  );
  if (matches.length > 1) throw Object.assign(new Error(`multiple Studionet transactions match signer nonce ${target}`), { code: "PROCURA_AMBIGUOUS_NONCE" });
  if (!matches.length) return null;
  const tx = matches[0];
  const actualTarget = String(tx.to_address ?? tx.to ?? "").toLowerCase();
  if (actualTarget !== expectedTarget.toLowerCase()) {
    throw Object.assign(new Error(`nonce ${target} was used for unexpected target ${actualTarget}`), { code: "PROCURA_UNEXPECTED_NONCE_TARGET" });
  }
  return {
    submissionHash: tx.hash,
    evmTxHash: tx.hash,
    genlayerTxId: tx.tx_id ?? tx.txId ?? tx.hash,
    nonce: String(tx.nonce),
    from: tx.from_address ?? tx.from ?? address,
    to: tx.to_address ?? tx.to ?? null,
  };
}

async function waitForSubmittedTransaction(client, address, nonce, expectedTarget, expectedEvmHash, update) {
  let delay = 3000;
  while (true) {
    try {
      const recovered = await findTransactionForNonce(client, address, nonce, expectedTarget);
      if (recovered) {
        if (expectedEvmHash && recovered.evmTxHash.toLowerCase() !== expectedEvmHash.toLowerCase()) {
          throw Object.assign(new Error(`nonce ${nonce} submission hash differs from the locally signed transaction`), { code: "PROCURA_SUBMISSION_HASH_MISMATCH" });
        }
        await update({ ...recovered, recoveredAt: now(), recoveryError: null });
        return recovered;
      }
      await update({ lastRecoveryAt: now(), recoveryError: null });
    } catch (error) {
      if (["PROCURA_AMBIGUOUS_NONCE", "PROCURA_UNEXPECTED_NONCE_TARGET", "PROCURA_SUBMISSION_HASH_MISMATCH"].includes(error?.code)) throw error;
      await update({ lastRecoveryAt: now(), recoveryError: String(error?.message ?? error) });
    }
    await sleep(delay);
    delay = Math.min(delay * 2, 30_000);
  }
}

async function waitForEvmTransactionByHash(client, hash, expected, update) {
  assert(/^0x[0-9a-fA-F]{64}$/.test(hash ?? ""), "cannot recover EVM submission without a signed transaction hash");
  let delay = 3000;
  while (true) {
    try {
      const transaction = await client.request({ method: "eth_getTransactionByHash", params: [hash] });
      const receipt = await client.request({ method: "eth_getTransactionReceipt", params: [hash] });
      if (transaction || receipt) {
        const from = transaction?.from ?? receipt?.from;
        const to = transaction?.to ?? receipt?.to;
        const nonce = transaction?.nonce;
        if (from && from.toLowerCase() !== expected.from.toLowerCase()) throw Object.assign(new Error("recovered EVM sender differs from the authorized signer"), { code: "PROCURA_EVM_SENDER_MISMATCH" });
        if (to && to.toLowerCase() !== expected.to.toLowerCase()) throw Object.assign(new Error("recovered EVM target differs from the expected contract"), { code: "PROCURA_EVM_TARGET_MISMATCH" });
        if (nonce !== undefined && BigInt(nonce) !== BigInt(expected.nonce)) throw Object.assign(new Error("recovered EVM nonce differs from the reserved nonce"), { code: "PROCURA_EVM_NONCE_MISMATCH" });
        await update({ submissionHash: hash, evmTxHash: hash, evmTransaction: jsonSafe(transaction), evmReceipt: receipt ? jsonSafe(receipt) : null, recoveredAt: now(), recoveryError: null });
        return { submissionHash: hash, evmTxHash: hash, evmTransaction: transaction, evmReceipt: receipt };
      }
      await update({ lastRecoveryAt: now(), recoveryError: null });
    } catch (error) {
      if (["PROCURA_EVM_SENDER_MISMATCH", "PROCURA_EVM_TARGET_MISMATCH", "PROCURA_EVM_NONCE_MISMATCH"].includes(error?.code)) throw error;
      await update({ lastRecoveryAt: now(), recoveryError: String(error?.message ?? error) });
    }
    await sleep(delay);
    delay = Math.min(delay * 2, 30_000);
  }
}

async function waitForEvmReceipt(client, hash, update) {
  assert(/^0x[0-9a-fA-F]{64}$/.test(hash ?? ""), "cannot verify EVM receipt without a transaction hash");
  let delay = 3000;
  while (true) {
    let receipt = null;
    try {
      receipt = await client.request({ method: "eth_getTransactionReceipt", params: [hash] });
    } catch (error) {
      await update({ receiptTrackingError: String(error?.message ?? error), lastTrackedAt: now() });
    }
    if (receipt) {
      await update({ evmReceipt: jsonSafe(receipt), evmReceiptObservedAt: now(), receiptTrackingError: null });
      assert(receipt.status === "0x1", `EVM transaction ${hash} receipt status was ${receipt.status}`);
      return receipt;
    }
    await sleep(delay);
    delay = Math.min(delay + 3000, 30_000);
  }
}

async function waitForSubmittedHash(client, address, nonce, update) {
  let delay = 3000;
  while (true) {
    try {
      const hash = await findHashForNonce(client, address, nonce);
      await update({ lastRecoveryAt: now(), recoveryError: null, recoveredSubmissionHash: hash });
      if (hash) return hash;
    } catch (error) {
      await update({ lastRecoveryAt: now(), recoveryError: String(error?.message ?? error) });
    }
    await sleep(delay);
    delay = Math.min(delay * 2, 30_000);
  }
}

async function waitForFinalization(client, hash, update, onFinalizeReady = null) {
  let delay = 3000;
  let lastStatus = null;
  while (true) {
    try {
      const transaction = await client.getTransaction({ hash });
      assert(transaction, `transaction ${hash} is not indexed yet`);
      const summary = txSummary(transaction);
      await update({ consensusStatus: summary.statusName, lastTrackedAt: now(), trackingError: null, latestReceipt: summary });
      if (summary.statusName !== lastStatus) {
        console.log(`${hash}: ${summary.statusName ?? "status unavailable"}${summary.resultName ? ` (${summary.resultName})` : ""}`);
        lastStatus = summary.statusName;
      }
      if (summary.statusName === "FINALIZED") return transaction;
      if (summary.statusName === "READY_TO_FINALIZE" && onFinalizeReady) {
        await onFinalizeReady(transaction);
        lastStatus = null;
        continue;
      }
      if (["CANCELED", "VALIDATORS_TIMEOUT", "LEADER_TIMEOUT"].includes(summary.statusName)) return transaction;
    } catch (error) {
      if (["PROCURA_SPEND_CAP_PREFLIGHT", "PROCURA_FINALIZATION_FAILED"].includes(error?.code)) throw error;
      await update({ lastTrackedAt: now(), trackingError: String(error?.message ?? error) });
    }
    await sleep(delay);
    delay = Math.min(delay + 3000, 30_000);
  }
}

function validateArgumentValues(names, types, args, functionName) {
  assert(names.length === types.length && names.length === args.length, `${functionName}: signature arity mismatch`);
  for (let index = 0; index < names.length; index += 1) {
    const type = String(types[index]).toLowerCase();
    const value = args[index];
    if (type === "str" || type === "string") assert(typeof value === "string", `${functionName}.${names[index]} must be a string`);
    if (type === "bool" || type === "boolean") assert(typeof value === "boolean", `${functionName}.${names[index]} must be a boolean`);
    if (/^(u?int)(\d+)?$/.test(type)) assert(typeof value === "bigint" || Number.isSafeInteger(value), `${functionName}.${names[index]} must be an integer`);
    if (/(^|_)(hash|root|sha256)$/.test(names[index])) assert(typeof value === "string" && /^[0-9a-f]{64}$/.test(value), `${functionName}.${names[index]} must be 64 lowercase hexadecimal characters`);
    if (/(^|_)(at|deadline)$/.test(names[index])) {
      assert(typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value), `${functionName}.${names[index]} must be a UTC ISO timestamp`);
      assert(new Date(value).toISOString() === value, `${functionName}.${names[index]} is not a valid UTC timestamp`);
    }
  }
}

function methodSignature(runtimeSchema, name) {
  const method = runtimeSchema?.methods?.[name];
  assert(method, `runtime schema missing ${name}`);
  return {
    names: method.params.map(([parameter]) => parameter),
    types: method.params.map(([, type]) => String(type)),
  };
}

function runtimeTypeMatchesFrozen(runtimeType, frozenType) {
  const runtime = String(runtimeType).toLowerCase();
  const frozen = String(frozenType).toLowerCase();
  if (["str", "string"].includes(runtime)) return ["str", "string"].includes(frozen);
  if (["int", "integer"].includes(runtime)) return /^(?:u?int\d*|u\d+)$/.test(frozen);
  if (["bool", "boolean"].includes(runtime)) return ["bool", "boolean"].includes(frozen);
  return runtime === frozen;
}

function methodArgs(runtimeSchema, name, values, frozenSchema) {
  const { names, types } = methodSignature(runtimeSchema, name);
  const supplied = Object.keys(values);
  assert(JSON.stringify(supplied.sort()) === JSON.stringify([...names].sort()), `${name}: parameter set mismatch`);
  const frozen = frozenSchema.methods.find((method) => method.name === name);
  assert(frozen, `frozen schema missing ${name}`);
  assert(JSON.stringify(names) === JSON.stringify(frozen.arguments), `${name}: argument order differs from the frozen shared schema`);
  assert(types.every((type, index) => runtimeTypeMatchesFrozen(type, frozen.argumentTypes[index])), `${name}: runtime argument types are incompatible with the frozen shared schema`);
  const args = names.map((parameter) => values[parameter]);
  validateArgumentValues(names, types, args, name);
  return { names, types, args };
}

async function main() {
  let reusableDeployment = null;
  let executionAuthorization = null;
  if (execute) {
    assert(reuseContractAddress, "this candidate is already deployed; public execution must reuse a source-verified contract and cannot deploy again");
    assert(process.argv.includes(`--approved-max-gen=${SPEND_CAP}`), `public writes require explicit approval for the exact ${SPEND_CAP} wei GEN cap`);
    assert(process.argv.includes(`--approved-source-sha=${APPROVED_SOURCE_SHA}`), "public writes require approval for the exact candidate source SHA-256");
  }
  const qualificationEvidence = await verifyQualificationArtifact();
  const source = await fs.readFile(SOURCE_PATH, "utf8");
  const schemaText = await fs.readFile(SCHEMA_PATH, "utf8");
  const abiText = await fs.readFile(ABI_PATH, "utf8");
  const interfaceText = await fs.readFile(INTERFACE_PATH, "utf8");
  const sourceSha = sha256(source);
  const schemaSha = sha256(schemaText);
  const abiSha = sha256(abiText);
  const interfaceSha = sha256(interfaceText);
  assert(sourceSha === APPROVED_SOURCE_SHA, `candidate source SHA mismatch: ${sourceSha}`);
  assert(schemaSha === APPROVED_SCHEMA_SHA, `candidate schema SHA mismatch: ${schemaSha}`);
  assert(abiSha === APPROVED_ABI_SHA, `candidate ABI SHA mismatch: ${abiSha}`);
  assert(interfaceSha === APPROVED_INTERFACE_SHA, `candidate interface SHA mismatch: ${interfaceSha}`);
  const manifest = JSON.parse(schemaText);
  const manifestMethods = manifest.methods;
  const abi = JSON.parse(abiText);
  const interfaceManifest = JSON.parse(interfaceText);
  assert(manifest.candidateSourceSha256 === sourceSha, "schema source pointer mismatch");
  assert(abi.candidateSourceSha256 === sourceSha && abi.schemaVersion === manifest.schemaVersion, "ABI source or schema pointer mismatch");
  assert(interfaceManifest.candidateSourceSha256 === sourceSha && interfaceManifest.schemaVersion === manifest.schemaVersion, "interface source or schema pointer mismatch");
  const candidateManifest = JSON.parse(await fs.readFile(path.join(ROOT, "evidence", "procura-v2-evidence-candidate.json"), "utf8"));
  assert(candidateManifest.source.sha256 === sourceSha, "candidate manifest source hash mismatch");
  assert(candidateManifest.schema.sha256 === schemaSha && candidateManifest.abi.sha256 === abiSha && candidateManifest.interface.sha256 === interfaceSha, "candidate manifest schema, ABI, or interface hash mismatch");
  if (execute) {
    let authorization;
    try { authorization = await readJSON(AUTHORIZATION_PATH); }
    catch { throw new Error(`public execution requires the user-approved authorization record at ${path.relative(ROOT, AUTHORIZATION_PATH)}`); }
    assert(authorization.approved === true, "authorization record is not approved");
    executionAuthorization = authorization;
    assert(authorization.network === "studionet" && authorization.chainId === CHAIN_ID, "authorization network mismatch");
    assert(authorization.rpc === RPC && authorization.consensusMain?.toLowerCase() === CONSENSUS_MAIN.toLowerCase(), "authorization RPC or ConsensusMain mismatch");
    assert(authorization.sourceSha256 === sourceSha, "authorization source SHA mismatch");
    assert(authorization.buyer?.toLowerCase() === BUYER.toLowerCase() && authorization.supplier?.toLowerCase() === SUPPLIER.toLowerCase(), "authorization wallet mismatch");
    assert(Number(authorization.deploymentCount) === 0 && Number(authorization.qualificationTransactionCount) === 13, "authorization transaction count mismatch; only the 13-write qualification sequence may be authorized");
    assert(Number(authorization.lifecycleFinalizationMaxCount) === 13 && authorization.allowConditionalFinalization === true, "authorization does not cover up to 13 status-gated finalization actions");
    assert(BigInt(authorization.maximumGenDebitWei) === SPEND_CAP && BigInt(authorization.escrowWei) === ESCROW, "authorization GEN cap or escrow mismatch");
    assert(typeof authorization.userAuthorizationText === "string" && authorization.userAuthorizationText.trim().length > 0, "authorization does not record the user's explicit consent");
    assert(authorization.reuseContractAddress?.toLowerCase() === reuseContractAddress.toLowerCase(), "authorization reuse contract address mismatch");
    assert(reuseContractAddress.toLowerCase() === "0xe8b7fcd95fa54b442e3ed114d6cb1a016774b929", "only the first source-verified deployment is designated for reuse");
    const reconciliation = await readJSON(DEPLOYMENT_RECONCILIATION_PATH);
    assert(reconciliation.network === "studionet" && reconciliation.chainId === CHAIN_ID && reconciliation.rpc === RPC, "deployment reconciliation network mismatch");
    assert(reconciliation.sourceSha256 === sourceSha, "deployment reconciliation source hash mismatch");
    assert(reconciliation.recommendedReusableContract?.toLowerCase() === reuseContractAddress.toLowerCase(), "deployment reconciliation selected contract mismatch");
    reusableDeployment = reconciliation.deployments.find((item) => item.contractAddress?.toLowerCase() === reuseContractAddress.toLowerCase());
    assert(reusableDeployment && reusableDeployment.consensusStatus === "FINALIZED" && reusableDeployment.consensusResult === "MAJORITY_AGREE" && reusableDeployment.executionOutcome?.leader === "SUCCESS", "reused deployment has not been verified successful");
    assert(reusableDeployment.evmReceipt?.status === "0x1" && reusableDeployment.actualGenFeeWei === "0" && reusableDeployment.valueTransferredWei === "0", "reused deployment receipt or accounting is not reconciled");
  }

  const gl = await import(pathToFileURL(sdkPath).href);
  const keytar = (await import(pathToFileURL(keytarPath).href)).default;
  const credentials = await keytar.findCredentials("genlayer-cli");
  const credential = (name) => credentials.find((item) => item.account === `account:${name}`)?.password;
  const buyerKey = credential("deployer");
  const supplierKey = credential("firewall-only");
  assert(buyerKey && supplierKey, "required keychain accounts unavailable");
  const buyer = gl.createAccount(buyerKey);
  const supplier = gl.createAccount(supplierKey);
  assert(buyer.address.toLowerCase() === BUYER.toLowerCase(), `buyer address mismatch: ${buyer.address}`);
  assert(supplier.address.toLowerCase() === SUPPLIER.toLowerCase(), `supplier address mismatch: ${supplier.address}`);
  const buyerClient = gl.createClient({ chain: gl.chains.studionet, endpoint: RPC, account: buyer });
  const supplierClient = gl.createClient({ chain: gl.chains.studionet, endpoint: RPC, account: supplier });
  const buyerReadOnlyClient = createReadOnlyClient(buyerClient);
  const supplierReadOnlyClient = createReadOnlyClient(supplierClient);
  const preflightBuyerClient = execute ? buyerClient : buyerReadOnlyClient;
  const preflightSupplierClient = execute ? supplierClient : supplierReadOnlyClient;
  assert(preflightBuyerClient.chain.id === CHAIN_ID && preflightSupplierClient.chain.id === CHAIN_ID, "chain ID mismatch");
  const buyerNetwork = await verifyStudionet(preflightBuyerClient);
  const supplierNetwork = await verifyStudionet(preflightSupplierClient);
  assert(JSON.stringify(buyerNetwork) === JSON.stringify(supplierNetwork), "buyer and supplier clients resolve different Studionet identity");

  const buyerBefore = await preflightBuyerClient.getBalance({ address: buyer.address });
  const supplierBefore = await preflightBuyerClient.getBalance({ address: supplier.address });
  const buyerNonces = await nonceSnapshot(preflightBuyerClient, buyer.address);
  const supplierNonces = await nonceSnapshot(preflightSupplierClient, supplier.address);
  const feeProfile = await readFeeProfile(preflightBuyerClient);
  assert(buyerBefore > SPEND_CAP, "buyer balance does not cover the cap");
  const oldBalancesBefore = {};
  for (const address of OLD_CONTRACTS) oldBalancesBefore[address] = await preflightBuyerClient.getBalance({ address });
  const runtimeCodeSchema = await preflightBuyerClient.getContractSchemaForCode(source);
  const runtimeMethodNames = Object.keys(runtimeCodeSchema.methods).sort();
  const frozenMethodNames = manifest.methods.map((method) => method.name).sort();
  assert(JSON.stringify(runtimeMethodNames) === JSON.stringify(frozenMethodNames), "source schema method set mismatch");
  const five = ["create_tender", "submit_bid", "add_bid_evidence", "create_delivery", "add_delivery_evidence"];
  const frontendSchemaParity = Object.fromEntries(five.map((name) => [name, {
    runtime: methodSignature(runtimeCodeSchema, name),
    frozen: {
      arguments: manifest.methods.find((method) => method.name === name).arguments,
      argumentTypes: manifest.methods.find((method) => method.name === name).argumentTypes,
    },
  }]));
  for (const name of five) {
    assert(JSON.stringify(frontendSchemaParity[name].runtime.names) === JSON.stringify(frontendSchemaParity[name].frozen.arguments), `${name}: frontend schema argument-order mismatch`);
    assert(frontendSchemaParity[name].runtime.types.every((type, index) => runtimeTypeMatchesFrozen(type, frontendSchemaParity[name].frozen.argumentTypes[index])), `${name}: frontend schema type mismatch`);
  }

  if (!execute) {
    console.log(stableJSON({
      mode: "READ_ONLY_PREFLIGHT",
      broadcast: false,
      network: "studionet",
      rpc: RPC,
      chainId: CHAIN_ID,
      networkIdentity: buyerNetwork,
      buyer: buyer.address,
      supplier: supplier.address,
      buyerNonces,
      supplierNonces,
      buyerBalance: buyerBefore.toString(),
      supplierBalance: supplierBefore.toString(),
      deploymentCount: 0,
      recommendedReusableContract: "0xE8b7FCD95FA54B442e3ed114D6Cb1a016774b929",
      qualificationTransactionCount: 13,
      lifecycleFinalizationMaxCount: 13,
      maximumApprovedDebit: SPEND_CAP.toString(),
      authorizationFile: path.relative(ROOT, AUTHORIZATION_PATH),
      authorizationPresent: await fs.access(AUTHORIZATION_PATH).then(() => true).catch(() => false),
      feeProfile,
      supportedSdkFeeQuote: "SDK per-transaction gas estimation is supported, but the empty-payload sample is not a candidate quote; the actual calldata is estimated by the SDK immediately before each write",
      escrowRequired: ESCROW.toString(),
      historicalContracts: oldBalancesBefore,
      sourceSha256: sourceSha,
      schemaSha256: schemaSha,
      abiSha256: abiSha,
      interfaceSha256: interfaceSha,
      qualificationEvidence,
      reviewerMethodSchemaParity: frontendSchemaParity,
    }));
    return;
  }

  let state = {
    qualification: "RUNNING",
    startedAt: now(),
    network: "studionet",
    rpc: RPC,
    chainId: CHAIN_ID,
    networkIdentity: buyerNetwork,
    sdk: "genlayer-js@1.1.8",
    deployer: BUYER,
    sourcePath: path.relative(ROOT, SOURCE_PATH),
    sourceSha256: sourceSha,
    schemaPath: "contracts/schema.v2.evidence.json",
    schemaSha256: schemaSha,
    abiPath: "contracts/abi.v2.evidence.json",
    abiSha256: abiSha,
    interfacePath: "contracts/interface.v2.evidence.json",
    interfaceSha256: interfaceSha,
    deploymentRoute: "createClient({ chain: studionet, endpoint, account }).deployContract({ code, args: [] })",
    feePolicy: "genlayer-js@1.1.8 network-default route with SDK eth_estimateGas + eth_gasPrice before each actual call; actual fee and debit measured by wallet balance deltas; aggregate balance-delta cap is 0.001 GEN",
    deployment: null,
    case: null,
    lifecycleTransactions: [],
    transactions: [],
    balances: {
      buyerBefore: buyerBefore.toString(),
      supplierBefore: supplierBefore.toString(),
      actualGenSpent: "0",
      oldContractsBefore: oldBalancesBefore,
    },
    frontendSchemaParity,
    qualificationEvidence,
  };
  await fs.mkdir(EVIDENCE_DIR, { recursive: true });
  if (resume) {
    await fs.access(LOCK_PATH);
    state = await readJSON(JOURNAL_PATH);
    assert(state.network === "studionet" && state.chainId === CHAIN_ID, "resume journal network mismatch");
    assert(state.sourceSha256 === sourceSha && state.schemaSha256 === schemaSha, "resume journal candidate hash mismatch");
    assert(!String(state.qualification).startsWith("STOPPED_"), `journal is stopped at ${state.qualification}; reconcile before resuming`);
  } else {
    for (const pathToCheck of [LOCK_PATH, JOURNAL_PATH]) {
      try {
        await fs.access(pathToCheck);
        throw new Error(`previous qualification record exists: ${pathToCheck}; resume it instead of creating another deployment`);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    await fs.writeFile(LOCK_PATH, stableJSON({ deploymentAttempted: false, reusedExistingContract: Boolean(reuseContractAddress), existingSubmissionHash: reusableDeployment?.submissionHash ?? null, at: now(), network: "studionet", chainId: CHAIN_ID, deployer: BUYER, sourceSha256: sourceSha }) + "\n", { flag: "wx" });
    if (reusableDeployment) {
      state.deployment = {
        ...reusableDeployment,
        transaction: reusableDeployment.submissionHash,
        evmTxHash: reusableDeployment.submissionHash,
        balanceBefore: buyerBefore.toString(),
        actualDebit: reusableDeployment.actualDebitWei,
        actualGenFee: reusableDeployment.actualGenFeeWei,
        accountingAppliedAt: now(),
        reusedExistingContract: true,
      };
    }
    await persist(state);
  }

  let deploymentHash = state.deployment?.submissionHash ?? state.deployment?.transaction ?? null;
  if (!resume && !reuseContractAddress) {
    await verifyStudionet(buyerClient);
    const deploymentNonces = await nonceSnapshot(buyerClient, buyer.address);
    assert(deploymentNonces.latest === deploymentNonces.pending, `buyer has a pending transaction (${deploymentNonces.pending}); reconcile it before deployment`);
    const nonce = await buyerClient.getCurrentNonce({ address: buyer.address });
    const deploymentReservation = {
      network: "studionet", chainId: CHAIN_ID, contract: null, signer: buyer.address,
      nonce: String(nonce), method: "deploy_contract", argumentsHash: sha256(stableJSON({ code: source, args: [] })),
      arguments: [], valueTransferred: "0", phase: "BROADCAST_RESERVED", reservedAt: now(),
      balanceBefore: buyerBefore.toString(), sourceSha256: sourceSha,
    };
    state.deployment = { ...deploymentReservation };
    state.pendingWrite = { ...deploymentReservation, label: "deploy_contract" };
    await persist(state);
    try {
      deploymentHash = await buyerClient.deployContract({ code: source, args: [] });
    } catch (error) {
      state.qualification = "TRACKING_DEPLOYMENT_SUBMISSION_BY_NONCE";
      state.pendingWrite = { ...state.pendingWrite, phase: "OUTCOME_UNKNOWN", submissionError: String(error?.message ?? error) };
      await persist(state);
      deploymentHash = await waitForSubmittedHash(buyerClient, buyer.address, nonce, (patch) => {
        state.pendingWrite = { ...state.pendingWrite, ...patch };
        return persist(state);
      });
    }
    assert(/^0x[0-9a-fA-F]{64}$/.test(deploymentHash), `invalid deployment submission hash: ${deploymentHash}`);
    state.pendingWrite = { ...state.pendingWrite, submissionHash: deploymentHash, phase: "SUBMITTED", broadcastAt: now() };
    state.deployment = { ...state.deployment, transaction: deploymentHash, submissionHash: deploymentHash, evmTxHash: deploymentHash, broadcastAt: now() };
    await persist(state);
  } else if (!deploymentHash && state.pendingWrite?.label === "deploy_contract") {
    const pending = state.pendingWrite;
    deploymentHash = pending.submissionHash ?? await waitForSubmittedHash(buyerClient, pending.signer, pending.nonce, (patch) => {
      state.pendingWrite = { ...state.pendingWrite, ...patch };
      return persist(state);
    });
    state.deployment = { ...state.deployment, transaction: deploymentHash, submissionHash: deploymentHash, evmTxHash: deploymentHash, broadcastAt: state.deployment.broadcastAt ?? now() };
    state.pendingWrite = null;
    await persist(state);
  }
  assert(/^0x[0-9a-fA-F]{64}$/.test(deploymentHash ?? ""), "resume journal has no deployment submission hash");
  assert(/^0x[0-9a-fA-F]{64}$/.test(deploymentHash), `invalid deployment hash: ${deploymentHash}`);
  if (resume) {
    state.deployment = { ...state.deployment, transaction: deploymentHash, submissionHash: deploymentHash, evmTxHash: deploymentHash, sourceSha256: sourceSha };
    await persist(state);
  }

  const deploymentTx = await waitForFinalization(buyerClient, deploymentHash, (patch) => {
    state.deployment = { ...state.deployment, ...patch };
    if (patch.latestReceipt?.genlayerTxId) state.deployment.genlayerTxId = patch.latestReceipt.genlayerTxId;
    return persist(state);
  });
  const deploymentSummary = txSummary(deploymentTx);
  const buyerAfterDeployment = await buyerClient.getBalance({ address: buyer.address });
  const deploymentBalanceBefore = BigInt(state.deployment?.balanceBefore ?? buyerBefore);
  const deploymentDebit = state.deployment?.accountingAppliedAt
    ? BigInt(state.deployment.actualDebit ?? "0")
    : deploymentBalanceBefore > buyerAfterDeployment ? deploymentBalanceBefore - buyerAfterDeployment : 0n;
  if (!state.deployment?.accountingAppliedAt) {
    state.balances.actualGenSpent = (BigInt(state.balances.actualGenSpent ?? "0") + deploymentDebit).toString();
    state.balances.actualGenFees = (BigInt(state.balances.actualGenFees ?? "0") + deploymentDebit).toString();
  }
  state.balances.afterDeployment = state.balances.afterDeployment ?? buyerAfterDeployment.toString();
  state.deployment = {
    ...state.deployment,
    receipt: deploymentSummary,
    genlayerTxId: deploymentTx?.tx_id ?? deploymentTx?.txId ?? null,
    consensusStatus: deploymentSummary.statusName,
    executionOutcome: executionObservation(deploymentTx),
    actualGenExecutionResult: deploymentSummary.txExecutionResult,
    valueTransferred: "0",
    actualDebit: deploymentDebit.toString(),
    actualGenFee: deploymentDebit.toString(),
    accountingAppliedAt: state.deployment?.accountingAppliedAt ?? now(),
    ...(deploymentSummary.statusName === "FINALIZED" ? { finalizedAt: state.deployment?.finalizedAt ?? now() } : { terminalStatusObservedAt: now() }),
    completionCheckpoint: deploymentSummary.statusName === "FINALIZED" ? "deployment:finalized" : `deployment:terminal-${deploymentSummary.statusName ?? "unknown"}`,
  };
  await persist(state);
  const deploymentTotalSpent = BigInt(state.balances.actualGenSpent ?? "0");
  if (deploymentTotalSpent > SPEND_CAP) {
    state.qualification = "STOPPED_SPENDING_CAP_EXCEEDED";
    state.deployment.failure = `deployment exceeded cumulative GEN cap (${deploymentTotalSpent})`;
    await persist(state);
    throw new Error(state.deployment.failure);
  }
  let deploymentConsensus;
  try {
    deploymentConsensus = assertFinalMajorityAgree(deploymentTx, "deployment");
    state.deployment.executionOutcome = deploymentConsensus.executionOutcome;
    state.deployment.actualGenExecutionResult = deploymentConsensus.txExecutionResult;
  } catch (error) {
    state.qualification = deploymentSummary.statusName === "FINALIZED" ? "STOPPED_DEPLOYMENT_FINALIZED_FAILURE" : "STOPPED_DEPLOYMENT_TERMINAL_FAILURE";
    state.deployment.failure = String(error?.message ?? error);
    await persist(state);
    throw error;
  }
  await persist(state);
  const contractAddress = deploymentTx?.data?.contract_address
    ?? deploymentTx?.contract_address
    ?? deploymentTx?.txDataDecoded?.contract_address
    ?? reusableDeployment?.contractAddress
    ?? reuseContractAddress;
  let deployedSchema;
  let deployedCode;
  try {
    assert(typeof contractAddress === "string" && /^0x[0-9a-fA-F]{40}$/.test(contractAddress), "deployment returned no contract address");
    if (reuseContractAddress) assert(contractAddress.toLowerCase() === reuseContractAddress.toLowerCase(), "reused deployment resolved to an unexpected contract address");
    deployedCode = await buyerClient.getContractCode(contractAddress);
    assert(sha256(deployedCode) === sourceSha && deployedCode === source, "deployed source parity mismatch");
    deployedSchema = await buyerClient.getContractSchema(contractAddress);
    assert(JSON.stringify(Object.keys(deployedSchema.methods).sort()) === JSON.stringify(runtimeMethodNames), "deployed schema method set mismatch");
    for (const name of five) {
      const deployedSignature = methodSignature(deployedSchema, name);
      assert(JSON.stringify(deployedSignature.names) === JSON.stringify(frontendSchemaParity[name].frozen.arguments), `${name}: deployed schema argument-order mismatch`);
      assert(deployedSignature.types.every((type, index) => runtimeTypeMatchesFrozen(type, frontendSchemaParity[name].frozen.argumentTypes[index])), `${name}: deployed schema type mismatch`);
    }
  } catch (error) {
    state.qualification = "STOPPED_DEPLOYMENT_PARITY_FAILURE";
    state.deployment.failure = String(error?.message ?? error);
    await persist(state);
    throw error;
  }
  state.deployment = {
    ...state.deployment,
    contractAddress,
    receipt: deploymentSummary,
    sourceReadbackSha256: sha256(deployedCode),
    schemaMethodCount: Object.keys(deployedSchema.methods).length,
    completionCheckpoint: "deployment:source-schema-parity-verified",
  };
  state.pendingWrite = null;
  await persist(state);

  const buyerLive = { account: buyer, client: buyerClient };
  const supplierLive = { account: supplier, client: supplierClient };
  const caseId = state.case?.caseId ?? `PROCURA-STUDIONET-QUAL-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
  const bidId = state.case?.bidId ?? `${caseId}:BID-1`;
  const requirementId = state.case?.requirementId ?? `${caseId}:REQ-1`;
  const awardId = state.case?.awardId ?? `${caseId}:AWARD-1`;
  const deliveryId = state.case?.deliveryId ?? `${caseId}:DELIVERY-1`;
  const evidenceId = state.case?.evidenceId ?? `${bidId}:EVIDENCE-1`;
  const deliveryEvidenceId = state.case?.deliveryEvidenceId ?? `${deliveryId}:EVIDENCE-1`;
  if (!state.case) {
    const future = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    state.case = {
      caseId,
      bidId,
      requirementId,
      awardId,
      deliveryId,
      evidenceId,
      deliveryEvidenceId,
      escrow: ESCROW.toString(),
      evidenceObservedAt: qualificationEvidence.observedAt,
      bidSubmittedAt: null,
      bidDeadline: future(30),
      evaluationDeadline: future(31),
      deliveryDeadline: future(60),
      qualificationOnly: true,
      category: "QUALIFICATION",
    };
    await persist(state);
  }

  const read = (live, functionName, values = {}) => {
    const { args } = methodArgs(deployedSchema, functionName, values, manifest);
    return live.client.readContract({ address: contractAddress, functionName, args, account: live.account });
  };

  const recordReadback = async (record) => {
    switch (record.functionName) {
      case "create_tender": case "freeze_tender": case "fund_tender": case "begin_bid_evaluation":
        return read(buyerLive, "get_tender", { tender_id: caseId });
      case "add_requirement":
        return read(buyerLive, "get_requirements", { tender_id: caseId });
      case "submit_bid": case "finalize_bid_evaluation":
        return read(buyerLive, "get_bids", { tender_id: caseId });
      case "add_bid_evidence":
        return read(buyerLive, "get_evidence", { entity_type: "BID", entity_id: bidId });
      case "adjudicate_requirement":
        return read(buyerLive, "get_adjudication", { bid_id: bidId, requirement_id: requirementId });
      case "award_bid": case "accept_award":
        return read(buyerLive, "get_award", { award_id: awardId });
      case "create_delivery":
        return read(buyerLive, "get_delivery", { delivery_id: deliveryId });
      case "add_delivery_evidence":
        return read(buyerLive, "get_evidence", { entity_type: "DELIVERY", entity_id: deliveryId });
      default:
        throw new Error(`no canonical readback mapping for ${record.functionName}`);
    }
  };

  const assertCanonicalSuccess = (record, rawReadback) => {
    const value = jsonSafe(rawReadback);
    const expect = (condition, detail) => assert(condition, `${record.label}: canonical state does not confirm execution (${detail})`);
    if (record.functionName === "create_tender") expect(value?.tender_id === caseId && value?.state === "DRAFT" && value?.buyer?.toLowerCase?.() === BUYER.toLowerCase(), "tender identity, buyer, or DRAFT state");
    else if (record.functionName === "add_requirement") expect(Array.isArray(value) && value.some((item) => item.requirement_id === requirementId && item.expected_value === "1"), "frozen requirement absent");
    else if (record.functionName === "freeze_tender") expect(value?.state === "FROZEN", "tender not FROZEN");
    else if (record.functionName === "fund_tender") expect(value?.state === "FUNDED" && BigInt(value.total_funded) >= ESCROW, "tender funding absent");
    else if (record.functionName === "submit_bid") expect(Array.isArray(value) && value.some((item) => item.bid_id === bidId && item.supplier?.toLowerCase?.() === SUPPLIER.toLowerCase()), "supplier bid absent");
    else if (record.functionName === "add_bid_evidence") expect(Array.isArray(value) && value.some((item) => item.evidence_id === evidenceId && item.content_sha256 === qualificationEvidence.sha256 && Number(item.content_byte_length) === qualificationEvidence.byteLength), "authenticated bid evidence absent");
    else if (record.functionName === "begin_bid_evaluation") expect(value?.state === "EVALUATING", "tender not EVALUATING");
    else if (record.functionName === "adjudicate_requirement") expect(value?.canonical_verdict === "COMPLIANT" && value?.evidence_snapshot_root === qualificationEvidence.sha256, "adjudication is not compliant or evidence root differs");
    else if (record.functionName === "finalize_bid_evaluation") expect(Array.isArray(value) && value.some((item) => item.bid_id === bidId && item.state === "COMPLIANT"), "bid not canonically COMPLIANT");
    else if (record.functionName === "award_bid") expect(value?.award_id === awardId && value?.state === "AWARDED_PENDING_ACCEPTANCE", "award absent or in wrong state");
    else if (record.functionName === "accept_award") expect(value?.award_id === awardId && value?.state === "ACCEPTED", "award acceptance absent");
    else if (record.functionName === "create_delivery") expect(value?.delivery_id === deliveryId && value?.award_id === awardId && value?.state === "DELIVERED", "delivery absent or not delivered");
    else if (record.functionName === "add_delivery_evidence") expect(Array.isArray(value) && value.some((item) => item.evidence_id === deliveryEvidenceId && item.content_sha256 === qualificationEvidence.sha256 && Number(item.content_byte_length) === qualificationEvidence.byteLength), "delivery evidence absent");
    return value;
  };

  async function assertCanonicalPrecondition(functionName) {
    if (functionName === "create_tender") {
      const ids = await read(buyerLive, "get_tender_ids");
      assert(!ids.includes(caseId), `create_tender: case ${caseId} already exists; refusing duplicate write`);
      return;
    }
    const tender = await read(buyerLive, "get_tender", { tender_id: caseId });
    const requireState = (expected) => assert(tender?.state === expected, `${functionName}: canonical tender state must be ${expected}, got ${tender?.state}`);
    if (functionName === "add_requirement") {
      requireState("DRAFT");
      const requirements = await read(buyerLive, "get_requirements", { tender_id: caseId });
      assert(!requirements.some((item) => item.requirement_id === requirementId), "add_requirement: requirement id already exists; refusing duplicate write");
    }
    else if (functionName === "freeze_tender") {
      const requirements = await read(buyerLive, "get_requirements", { tender_id: caseId });
      requireState("DRAFT");
      assert(requirements.some((item) => item.requirement_id === requirementId && item.operator === ">=" && item.expected_value === "1"), "freeze_tender: the intended objective requirement is missing or changed");
    } else if (functionName === "fund_tender") requireState("FROZEN");
    else if (functionName === "submit_bid") {
      requireState("FUNDED");
      const requirements = await read(buyerLive, "get_requirements", { tender_id: caseId });
      const bids = await read(buyerLive, "get_bids", { tender_id: caseId });
      assert(requirements.some((item) => item.requirement_id === requirementId), "submit_bid: frozen requirement is missing");
      assert(!bids.some((item) => item.bid_id === bidId), "submit_bid: bid id already exists; refusing duplicate write");
    } else if (functionName === "add_bid_evidence") {
      const bids = await read(buyerLive, "get_bids", { tender_id: caseId });
      assert(bids.some((item) => item.bid_id === bidId), "add_bid_evidence: bid is missing");
      const evidence = await read(buyerLive, "get_evidence", { entity_type: "BID", entity_id: bidId });
      assert(!evidence.some((item) => item.evidence_id === evidenceId), "add_bid_evidence: evidence id already exists");
    } else if (functionName === "begin_bid_evaluation") {
      requireState("FUNDED");
      const bids = await read(buyerLive, "get_bids", { tender_id: caseId });
      assert(bids.some((item) => item.bid_id === bidId), "begin_bid_evaluation: bid is missing");
      const evidence = await read(buyerLive, "get_evidence", { entity_type: "BID", entity_id: bidId });
      assert(evidence.some((item) => item.evidence_id === evidenceId), "begin_bid_evaluation: bid evidence is missing");
    } else if (functionName === "adjudicate_requirement") {
      requireState("EVALUATING");
      const evidence = await read(buyerLive, "get_evidence", { entity_type: "BID", entity_id: bidId });
      assert(evidence.some((item) => item.evidence_id === evidenceId && item.content_sha256 === qualificationEvidence.sha256), "adjudication: genuine bid evidence is missing");
    } else if (functionName === "finalize_bid_evaluation") {
      const adjudication = await read(buyerLive, "get_adjudication", { bid_id: bidId, requirement_id: requirementId });
      assert(adjudication?.canonical_verdict === "COMPLIANT", "finalize_bid_evaluation: compliant adjudication is missing");
    } else if (functionName === "award_bid") {
      const bids = await read(buyerLive, "get_bids", { tender_id: caseId });
      assert(bids.some((item) => item.bid_id === bidId && item.state === "COMPLIANT"), "award_bid: bid is not canonically compliant");
    } else if (functionName === "accept_award") {
      const award = await read(buyerLive, "get_award", { award_id: awardId });
      assert(award?.state === "AWARDED_PENDING_ACCEPTANCE", "accept_award: pending award is missing");
    } else if (functionName === "create_delivery") {
      const award = await read(buyerLive, "get_award", { award_id: awardId });
      assert(award?.state === "ACCEPTED", "create_delivery: supplier acceptance is missing");
      // The deployed view raises a GenVM storage error when a delivery key is
      // absent, so it cannot distinguish absence from a failed read. Reconcile
      // the canonical contract transaction history instead and fail closed.
      const history = await buyerLive.client.request({ method: "sim_getTransactionsForAddress", params: [contractAddress] });
      assertNoPriorDeliverySubmission(history, awardId, deliveryId);
    } else if (functionName === "add_delivery_evidence") {
      const delivery = await read(buyerLive, "get_delivery", { delivery_id: deliveryId });
      assert(delivery?.state === "DELIVERED", "add_delivery_evidence: canonical delivery is missing");
      const evidence = await read(buyerLive, "get_evidence", { entity_type: "DELIVERY", entity_id: deliveryId });
      assert(!evidence.some((item) => item.evidence_id === deliveryEvidenceId), "add_delivery_evidence: evidence id already exists");
    }
  }

  async function finalizeRecord(record) {
    const signerClient = liveClientFor(record.sender);
    record.genlayerTxId ??= record.transaction ?? null;
    if (!record.submissionHash || !record.genlayerTxId || !record.canonicalSubmissionVerifiedAt) {
      const recovered = await waitForSubmittedTransaction(signerClient, record.sender, record.nonce, record.contract, record.signedEvmTxHash, (patch) => {
        Object.assign(record, patch);
        if (state.pendingWrite?.label === record.label) Object.assign(state.pendingWrite, patch);
        return persist(state);
      });
      record.submissionHash = recovered.submissionHash;
      record.evmTxHash = recovered.evmTxHash;
      record.genlayerTxId = recovered.genlayerTxId ?? record.genlayerTxId;
      record.transaction = record.genlayerTxId ?? record.submissionHash;
      record.canonicalSubmissionVerifiedAt = now();
      await persist(state);
    }
    assert(/^0x[0-9a-fA-F]{64}$/.test(record.submissionHash), `${record.label}: missing/invalid submission hash`);
    assert(/^0x[0-9a-fA-F]{64}$/.test(record.genlayerTxId ?? ""), `${record.label}: missing/invalid GenLayer transaction ID`);
    record.phase = "SUBMITTED";
    record.completionCheckpoint = `${record.label}:submitted`;
    state.pendingWrite = record;
    await persist(state);
    await waitForEvmReceipt(signerClient, record.evmTxHash ?? record.submissionHash, (patch) => {
      Object.assign(record, patch);
      if (state.pendingWrite?.label === record.label) Object.assign(state.pendingWrite, patch);
      return persist(state);
    });
    const tx = await waitForFinalization(signerClient, record.genlayerTxId, (patch) => {
      Object.assign(record, patch);
      if (patch.latestReceipt?.genlayerTxId) record.genlayerTxId = patch.latestReceipt.genlayerTxId;
      return persist(state);
    }, (readyTransaction) => finalizeReadyTransaction(
      signerClient,
      record.sender,
      readyTransaction?.tx_id ?? readyTransaction?.txId ?? record.genlayerTxId,
    ));
    record.genlayerTxId = tx?.tx_id ?? tx?.txId ?? record.genlayerTxId;
    record.submissionHash = tx?.hash ?? record.submissionHash;
    record.evmTxHash = record.submissionHash;
    record.nonce = String(tx?.nonce ?? record.nonce);
    record.consensusStatus = txSummary(tx).statusName;
    record.receipt = txSummary(tx);
    record.executionOutcome = executionObservation(tx);
    const after = await signerClient.getBalance({ address: record.sender });
    const before = BigInt(record.balanceBefore ?? "0");
    const debit = before > after ? before - after : 0n;
    const transfer = BigInt(record.value ?? "0");
    const actualFee = debit > transfer ? debit - transfer : 0n;
    const cumulativeSpent = BigInt(state.balances.actualGenSpent ?? "0") + (record.accountingAppliedAt ? 0n : debit);
    record.balanceAfter = after.toString();
    record.actualDebit = debit.toString();
    record.valueTransferred = transfer.toString();
    record.actualGenFee = actualFee.toString();
    if (!record.accountingAppliedAt) {
      state.balances.actualGenSpent = cumulativeSpent.toString();
      state.balances.actualGenFees = (BigInt(state.balances.actualGenFees ?? "0") + actualFee).toString();
      record.accountingAppliedAt = now();
    }
    if (record.consensusStatus === "FINALIZED") record.finalizedAt = record.finalizedAt ?? now();
    else record.terminalStatusObservedAt = now();
    record.completionCheckpoint = record.consensusStatus === "FINALIZED"
      ? `${record.label}:finalized`
      : `${record.label}:terminal-${record.consensusStatus ?? "unknown"}`;
    await persist(state);
    if (cumulativeSpent > SPEND_CAP) {
      state.qualification = "STOPPED_SPENDING_CAP_EXCEEDED";
      record.failure = `${record.label}: cumulative GEN cap exceeded (${cumulativeSpent})`;
      await persist(state);
      throw new Error(record.failure);
    }
    let consensus;
    try {
      consensus = assertFinalMajorityAgree(tx, record.label);
    } catch (error) {
      state.qualification = record.consensusStatus === "FINALIZED"
        ? `STOPPED_${record.label}_FINALIZED_FAILURE`
        : `STOPPED_${record.label}_TERMINAL_FAILURE`;
      record.failure = String(error?.message ?? error);
      await persist(state);
      throw error;
    }
    record.executionOutcome = consensus.executionOutcome;
    record.actualGenExecutionResult = consensus.txExecutionResult;
    await persist(state);
    const canonicalReadback = await recordReadback(record);
    try {
      record.canonicalReadback = assertCanonicalSuccess(record, canonicalReadback);
    } catch (error) {
      state.qualification = `STOPPED_${record.label}_CANONICAL_READBACK_FAILURE`;
      record.failure = String(error?.message ?? error);
      await persist(state);
      throw error;
    }
    record.completionCheckpoint = `${record.label}:canonical-readback-verified`;
    state.pendingWrite = null;
    await persist(state);
    return record.canonicalReadback;
  }

  const liveClientFor = (address) => address.toLowerCase() === BUYER.toLowerCase() ? buyerClient : supplierClient;

  async function finalizeReadyTransaction(client, signer, parentTxId) {
    const readiness = state.transactions.find((item) => item.genlayerTxId === parentTxId)?.consensusStatus
      ?? state.pendingWrite?.consensusStatus;
    state.lifecycleTransactions ??= [];
    let record = state.lifecycleTransactions.find((item) => item.parentGenlayerTxId === parentTxId);
    if (record) {
      assert(readiness === "READY_TO_FINALIZE" || record.readiness === "READY_TO_FINALIZE", "finalization is not READY_TO_FINALIZE");
      assert(executionAuthorization?.allowConditionalFinalization === true, "finalization is not authorized");
    } else {
      assertFinalizationAuthorized(readiness, executionAuthorization, state.lifecycleTransactions.length);
    }
    let newlyReserved = false;
    if (!record) {
      const nonces = await nonceSnapshot(client, signer);
      assert(nonces.latest === nonces.pending, `finalizeTransaction: signer has an unresolved pending nonce (${nonces.pending}); refusing a duplicate broadcast`);
      const nonce = await client.getCurrentNonce({ address: signer });
      record = {
        network: "studionet", chainId: CHAIN_ID, contract: CONSENSUS_MAIN,
        label: `finalize:${parentTxId}`, functionName: "finalizeTransaction", method: "finalizeTransaction",
        parentGenlayerTxId: parentTxId, sender: signer, signer, nonce: String(nonce),
        arguments: { txId: parentTxId }, argumentsHash: sha256(stableJSON({ txId: parentTxId })),
        value: "0", valueTransferred: "0", balanceBefore: (await client.getBalance({ address: signer })).toString(),
        readiness: "READY_TO_FINALIZE", phase: "BROADCAST_RESERVED", reservedAt: now(),
        completionCheckpoint: `finalize:${parentTxId}:reserved`,
      };
      state.lifecycleTransactions.push(record);
      newlyReserved = true;
    }
    state.pendingLifecycleAction = record;
    await persist(state);

    if (!record.submissionHash) {
      if (!newlyReserved) {
        record.phase = "RECOVERING_BY_NONCE";
        await persist(state);
        if (record.signedEvmTxHash) {
          await waitForEvmTransactionByHash(client, record.signedEvmTxHash, { from: signer, to: CONSENSUS_MAIN, nonce: record.nonce }, (patch) => {
            Object.assign(record, patch);
            return persist(state);
          });
          record.submissionHash = record.signedEvmTxHash;
        } else {
          record.submissionHash = await waitForSubmittedHash(client, signer, record.nonce, (patch) => {
            Object.assign(record, patch);
            return persist(state);
          });
        }
        record.evmTxHash = record.submissionHash;
        record.recoveredAt = now();
        await persist(state);
      } else {
      let signingAttempts = 0;
      const guardedAccount = createGuardedSigningAccount(client.account, async (transactionRequest) => {
        assert(signingAttempts === 0, "SDK attempted a second signed transaction for one qualification finalizer");
        if (transactionRequest.gas === undefined || transactionRequest.gasPrice === undefined) {
          const error = new Error("finalizeTransaction: exact gas and gas-price quote is unavailable; refusing to sign");
          error.code = "PROCURA_FEE_QUOTE_UNAVAILABLE";
          throw error;
        }
        const estimatedGas = BigInt(transactionRequest.gas);
        const gasPrice = BigInt(transactionRequest.gasPrice);
        const estimatedFeeWei = estimatedGas * gasPrice;
        const valueWei = BigInt(transactionRequest.value ?? 0n);
        const parentReservation = state.pendingWrite?.genlayerTxId === parentTxId
          ? BigInt(state.pendingWrite.feeQuote?.estimatedFeeWei ?? "0") + BigInt(state.pendingWrite.valueTransferred ?? "0")
          : 0n;
        const projectedDebitWei = BigInt(state.balances.actualGenSpent ?? "0") + parentReservation + estimatedFeeWei + valueWei;
        const quote = {
          estimatedGas: estimatedGas.toString(), gasPriceWei: gasPrice.toString(),
          estimatedFeeWei: estimatedFeeWei.toString(), valueTransferredWei: valueWei.toString(),
          pendingParentMaximumDebitWei: parentReservation.toString(),
          projectedMaximumDebitWei: projectedDebitWei.toString(), capWei: SPEND_CAP.toString(), observedAt: now(),
        };
        Object.assign(record, { feeQuote: quote, phase: "FEE_QUOTED_BEFORE_SIGNATURE" });
        state.pendingLifecycleAction = record;
        await persist(state);
        if (projectedDebitWei > SPEND_CAP) {
          const error = new Error(`finalizeTransaction: estimated cumulative debit ${projectedDebitWei} wei exceeds cap ${SPEND_CAP} wei; finalizer was not signed or sent`);
          error.code = "PROCURA_SPEND_CAP_PREFLIGHT";
          state.qualification = "STOPPED_ESTIMATED_SPEND_CAP";
          state.rejectedLifecycleActions = [...(state.rejectedLifecycleActions ?? []), { ...record, phase: "REJECTED_BEFORE_SIGNATURE", rejection: error.message }];
          state.lifecycleTransactions = state.lifecycleTransactions.filter((item) => item.parentGenlayerTxId !== parentTxId);
          state.pendingLifecycleAction = null;
          await persist(state);
          throw error;
        }
        signingAttempts += 1;
      }, async ({ serializedTransaction }) => {
        record.signedEvmTxHash = keccak256(serializedTransaction);
        record.phase = "SIGNED_AWAITING_BROADCAST";
        record.signedAt = now();
        state.pendingLifecycleAction = record;
        await persist(state);
      });

      let submissionHash;
      try {
        submissionHash = await client.finalizeTransaction({ txId: parentTxId, account: guardedAccount });
      } catch (error) {
        if (error?.code === "PROCURA_SPEND_CAP_PREFLIGHT") throw error;
        record.phase = "OUTCOME_UNKNOWN";
        record.submissionError = String(error?.message ?? error);
        await persist(state);
        if (!record.signedEvmTxHash) {
          state.qualification = "STOPPED_FINALIZATION_BEFORE_SIGNATURE";
          await persist(state);
          throw error;
        }
        await waitForEvmTransactionByHash(client, record.signedEvmTxHash, { from: signer, to: CONSENSUS_MAIN, nonce: record.nonce }, (patch) => {
          Object.assign(record, patch);
          return persist(state);
        });
        submissionHash = record.signedEvmTxHash;
      }
      assert(!record.signedEvmTxHash || submissionHash.toLowerCase() === record.signedEvmTxHash.toLowerCase(), "finalizeTransaction returned a hash different from the signed transaction");
      record.submissionHash = submissionHash;
      record.evmTxHash = submissionHash;
      record.phase = "SUBMITTED";
      record.broadcastAt = now();
      record.completionCheckpoint = `finalize:${parentTxId}:submitted`;
      await persist(state);
      }
    }

    let receipt = record.evmReceipt ?? null;
    let delay = 3000;
    while (!receipt) {
      try {
        receipt = await client.request({ method: "eth_getTransactionReceipt", params: [record.submissionHash] });
        if (receipt) {
          record.evmReceipt = jsonSafe(receipt);
          await persist(state);
        }
      } catch (error) {
        record.receiptTrackingError = String(error?.message ?? error);
        await persist(state);
      }
      if (!receipt) {
        await sleep(delay);
        delay = Math.min(delay + 3000, 30_000);
      }
    }
    if (receipt.status !== "0x1") {
      state.qualification = "STOPPED_LIFECYCLE_FINALIZATION_FAILED";
      record.failure = `finalizeTransaction EVM receipt status was ${receipt.status}`;
      record.completionCheckpoint = `finalize:${parentTxId}:evm-failed`;
      await persist(state);
      const error = new Error(record.failure);
      error.code = "PROCURA_FINALIZATION_FAILED";
      throw error;
    }
    if (!record.accountingAppliedAt) {
      const after = await client.getBalance({ address: signer });
      const before = BigInt(record.balanceBefore);
      const actualDebit = before > after ? before - after : 0n;
      const actualFee = actualDebit;
      state.balances.actualGenSpent = (BigInt(state.balances.actualGenSpent ?? "0") + actualDebit).toString();
      state.balances.actualGenFees = (BigInt(state.balances.actualGenFees ?? "0") + actualFee).toString();
      record.balanceAfter = after.toString();
      record.actualDebit = actualDebit.toString();
      record.actualGenFee = actualFee.toString();
      record.valueTransferred = "0";
      record.accountingAppliedAt = now();
      assert(BigInt(state.balances.actualGenSpent) <= SPEND_CAP, "actual finalization spending exceeded authorized cap");
    }
    record.finalizedAt = now();
    record.phase = "FINALIZER_EVM_CONFIRMED";
    record.completionCheckpoint = `finalize:${parentTxId}:evm-receipt-verified`;
    state.pendingLifecycleAction = null;
    await persist(state);
    return record;
  }

  async function reconcileIncompleteTransactions() {
    if (state.pendingWrite && state.pendingWrite.label !== "deploy_contract") {
      const pending = state.pendingWrite;
      let record = state.transactions.find((item) => item.label === pending.label);
      if (!record) {
        record = { ...pending };
        state.transactions.push(record);
      }
      if (!record.submissionHash && !record.transaction) {
        record.phase = "RECOVERING_BY_NONCE";
        await persist(state);
        record.submissionHash = await waitForSubmittedHash(liveClientFor(record.sender), record.sender, record.nonce, (patch) => {
          Object.assign(record, patch);
          Object.assign(state.pendingWrite, patch);
          return persist(state);
        });
        record.transaction = record.submissionHash;
      }
      await finalizeRecord(record);
    }
    for (const record of state.transactions) {
      if (record.finalizedAt && record.completionCheckpoint === `${record.label}:canonical-readback-verified`) continue;
      await finalizeRecord(record);
    }
  }

  await reconcileIncompleteTransactions();

  async function write(label, live, functionName, values, { value = 0n, readback } = {}) {
    assertQualificationWriteAllowed(functionName);
    const previous = state.transactions.find((item) => item.label === label);
    if (previous) {
      assert(previous.transaction, `${label} has a transaction reservation without a hash; reconcile it before retrying`);
      assert(previous.finalizedAt, `${label} already has a transaction hash but is not finalized; resume tracking the same transaction`);
      return previous.canonicalReadback;
    }
    assert(!state.pendingWrite, `${state.pendingWrite?.label ?? "a previous write"} is unresolved; refusing a duplicate broadcast`);
    assert(typeof live.account.signTransaction === "function", `${label}: cannot enforce the GEN cap before signing with this wallet type`);
    await verifyStudionet(live.client);
    const currentSource = await live.client.getContractCode(contractAddress);
    assert(sha256(currentSource) === sourceSha && currentSource === source, `${label}: deployed source changed before write`);
    const currentSchema = await live.client.getContractSchema(contractAddress);
    const { names, types, args } = methodArgs(currentSchema, functionName, values, manifest);
    const expectedRole = ["create_tender", "add_requirement", "freeze_tender", "fund_tender", "begin_bid_evaluation", "adjudicate_requirement", "finalize_bid_evaluation", "award_bid"].includes(functionName) ? BUYER : SUPPLIER;
    assert(live.account.address.toLowerCase() === expectedRole.toLowerCase(), `${label}: signer is not the required ${expectedRole === BUYER ? "buyer" : "supplier"} role`);
    await assertCanonicalPrecondition(functionName);
    const before = await live.client.getBalance({ address: live.account.address });
    const nonces = await nonceSnapshot(live.client, live.account.address);
    assert(nonces.latest === nonces.pending, `${label}: signer has an unresolved pending nonce (${nonces.pending}); refusing a duplicate broadcast`);
    const nonce = await live.client.getCurrentNonce({ address: live.account.address });
    const reservation = {
      network: "studionet", chainId: CHAIN_ID, contract: contractAddress,
      label, functionName, method: functionName, sender: live.account.address, signer: live.account.address,
      nonce: String(nonce), parameterNames: names, parameterTypes: types, args: jsonSafe(args),
      argumentsHash: sha256(stableJSON(args)), value: value.toString(), valueTransferred: value.toString(),
      balanceBefore: before.toString(), phase: "BROADCAST_RESERVED", reservedAt: now(),
      completionCheckpoint: `${label}:reserved`,
    };
    state.pendingWrite = reservation;
    await persist(state);
    let hash;
    let signingAttempts = 0;
    try {
      const guardedAccount = createGuardedSigningAccount(live.account, async (transactionRequest) => {
          assert(signingAttempts === 0, `${label}: SDK attempted a second signed transaction for one qualification write`);
          if (transactionRequest.gas === undefined || transactionRequest.gasPrice === undefined) {
            const error = new Error(`${label}: exact gas and gas-price quote is unavailable; refusing to sign`);
            error.code = "PROCURA_FEE_QUOTE_UNAVAILABLE";
            throw error;
          }
          const estimatedGas = BigInt(transactionRequest.gas);
          const gasPrice = BigInt(transactionRequest.gasPrice);
          const estimatedFeeWei = estimatedGas * gasPrice;
          const maximumWriteDebitWei = estimatedFeeWei + BigInt(transactionRequest.value ?? 0n);
          const alreadySpentWei = BigInt(state.balances.actualGenSpent ?? "0");
          const projectedDebitWei = alreadySpentWei + maximumWriteDebitWei;
          const quote = {
            estimatedGas: estimatedGas.toString(),
            gasPriceWei: gasPrice.toString(),
            estimatedFeeWei: estimatedFeeWei.toString(),
            valueTransferredWei: BigInt(transactionRequest.value ?? 0n).toString(),
            cumulativeActualDebitBeforeWei: alreadySpentWei.toString(),
            projectedMaximumDebitWei: projectedDebitWei.toString(),
            capWei: SPEND_CAP.toString(),
            observedAt: now(),
          };
          Object.assign(reservation, { feeQuote: quote, phase: "FEE_QUOTED_BEFORE_SIGNATURE" });
          state.pendingWrite = reservation;
          await persist(state);
          if (projectedDebitWei > SPEND_CAP) {
            const error = new Error(`${label}: estimated transaction debit ${projectedDebitWei} wei exceeds the authorized cumulative cap ${SPEND_CAP} wei; transaction was not signed or sent`);
            error.code = "PROCURA_SPEND_CAP_PREFLIGHT";
            state.qualification = "STOPPED_ESTIMATED_SPEND_CAP";
            state.rejectedWrites = [...(state.rejectedWrites ?? []), { ...reservation, phase: "REJECTED_BEFORE_SIGNATURE", rejection: error.message }];
            state.pendingWrite = null;
            await persist(state);
            throw error;
          }
          signingAttempts += 1;
      }, async ({ serializedTransaction }) => {
        reservation.signedEvmTxHash = keccak256(serializedTransaction);
        reservation.phase = "SIGNED_AWAITING_BROADCAST";
        reservation.signedAt = now();
        state.pendingWrite = reservation;
        await persist(state);
      });
      hash = await live.client.writeContract({ address: contractAddress, functionName, args, value, account: guardedAccount });
      reservation.genlayerTxId = hash;
      reservation.transaction = hash;
      reservation.phase = "GENLAYER_TX_ID_RECEIVED";
      reservation.sdkReturnedAt = now();
      state.pendingWrite = reservation;
      await persist(state);
    } catch (error) {
      if (error?.code === "PROCURA_SPEND_CAP_PREFLIGHT") throw error;
      if (!reservation.signedEvmTxHash) {
        state.qualification = `STOPPED_${label}_BEFORE_SIGNATURE`;
        reservation.phase = "STOPPED_BEFORE_SIGNATURE";
        reservation.failure = String(error?.message ?? error);
        state.pendingWrite = reservation;
        await persist(state);
        throw error;
      }
      state.qualification = `TRACKING_${label}_SUBMISSION_BY_NONCE`;
      state.pendingWrite = { ...reservation, phase: "OUTCOME_UNKNOWN", submissionError: String(error?.message ?? error) };
      state.error = String(error?.message ?? error);
      await persist(state);
      const recovered = await waitForSubmittedTransaction(live.client, live.account.address, nonce, contractAddress, reservation.signedEvmTxHash, (patch) => {
        Object.assign(state.pendingWrite, patch);
        return persist(state);
      });
      hash = recovered.genlayerTxId ?? recovered.evmTxHash;
    }
    assert(/^0x[0-9a-fA-F]{64}$/.test(hash), `${label}: invalid transaction hash`);
    const record = {
      ...reservation,
      phase: "SUBMISSION_IDENTIFIED",
      transaction: hash,
      genlayerTxId: reservation.genlayerTxId ?? hash,
      submissionHash: null,
      evmTxHash: reservation.signedEvmTxHash ?? null,
      broadcastAt: now(),
      completionCheckpoint: `${label}:submission-identified`,
    };
    state.pendingWrite = record;
    state.transactions.push(record);
    await persist(state);
    if (readback) record.readbackMethod = functionName;
    return finalizeRecord(record);
  }

  const tenderPackage = {
    tender_id: caseId,
    title: "Procura reviewer qualification: official SDK package metadata",
    description: "Qualification-only test. The supplier will identify and deliver one pinned public package manifest; no commercial purchase is represented.",
    category: "QUALIFICATION",
    currency_label: "GEN",
    budget_ceiling: ESCROW,
    bid_deadline: state.case.bidDeadline,
    evaluation_deadline: state.case.evaluationDeadline,
    delivery_deadline: state.case.deliveryDeadline,
    equivalence_policy: "NO_EQUIVALENCE",
    evaluation_policy: "OBJECTIVE_AND_SEMANTIC",
    payment_policy: "FULL",
    supplier_bond_policy: "NONE",
  };
  const tenderValues = { ...tenderPackage, tender_hash: sha256(stableJSON(tenderPackage)) };
  await write("create_tender", buyerLive, "create_tender", tenderValues, { readback: () => read(buyerLive, "get_tender", { tender_id: caseId }) });
  await write("add_requirement", buyerLive, "add_requirement", {
    tender_id: caseId,
    requirement_id: requirementId,
    title: "Official stable SDK major version",
    description: "The top-level package version in the pinned official genlayer-js package.json has a major version of at least 1.",
    requirement_type: "OBJECTIVE",
    mandatory: true,
    operator: ">=",
    expected_value: "1",
    unit: "semver_major:genlayer-js",
    equivalence_allowed: false,
    evidence_required: true,
    semantic_question: "Does the authenticated official package.json name genlayer-js and report a non-prerelease version with major version at least 1?",
    materiality: "HIGH",
  }, { readback: () => read(buyerLive, "get_requirements", { tender_id: caseId }) });
  await write("freeze_tender", buyerLive, "freeze_tender", { tender_id: caseId }, { readback: () => read(buyerLive, "get_tender", { tender_id: caseId }) });
  await write("fund_tender", buyerLive, "fund_tender", { tender_id: caseId }, { value: ESCROW, readback: () => read(buyerLive, "get_tender", { tender_id: caseId }) });
  if (!state.case.bidSubmittedAt) {
    state.case.bidSubmittedAt = new Date(Math.max(Date.now(), Date.parse(state.case.evidenceObservedAt) + 1)).toISOString();
    await persist(state);
  }
  const bidPackage = {
    bid_id: bidId,
    tender_id: caseId,
    price: ESCROW,
    currency: "GEN",
    delivery_commitment: "Deliver one copy of the pinned official genlayer-js package.json manifest.",
    requirement_responses: JSON.stringify({ [requirementId]: "1" }),
    submitted_at: state.case.bidSubmittedAt,
  };
  await write("submit_bid", supplierLive, "submit_bid", {
    ...bidPackage,
    bid_hash: sha256(stableJSON(bidPackage)),
  }, { readback: () => read(buyerLive, "get_bids", { tender_id: caseId }) });
  await write("add_bid_evidence", supplierLive, "add_bid_evidence", {
    bid_id: bidId,
    evidence_id: evidenceId,
    authority: EVIDENCE_AUTHORITY,
    source_url: EVIDENCE_URL,
    content_sha256: qualificationEvidence.sha256,
    content_byte_length: qualificationEvidence.byteLength,
    observed_at: state.case.evidenceObservedAt,
    published_at: EVIDENCE_PUBLISHED_AT,
    evidence_type: EVIDENCE_TYPE,
  }, { readback: () => read(buyerLive, "get_evidence", { entity_type: "BID", entity_id: bidId }) });
  await write("begin_bid_evaluation", buyerLive, "begin_bid_evaluation", { tender_id: caseId }, { readback: () => read(buyerLive, "get_tender", { tender_id: caseId }) });
  await write("adjudication", buyerLive, "adjudicate_requirement", { bid_id: bidId, requirement_id: requirementId, evidence_snapshot_root: qualificationEvidence.sha256 }, { readback: () => read(buyerLive, "get_adjudication", { bid_id: bidId, requirement_id: requirementId }) });
  const adjudication = state.transactions.find((item) => item.label === "adjudication")?.canonicalReadback;
  assert(adjudication?.canonical_verdict === "COMPLIANT", `live adjudication canonical verdict was ${adjudication?.canonical_verdict}`);
  await write("finalize_evaluation", buyerLive, "finalize_bid_evaluation", { tender_id: caseId }, { readback: () => read(buyerLive, "get_bids", { tender_id: caseId }) });
  const awardPackage = { tender_id: caseId, award_id: awardId, winning_bid_id: bidId, awarded_specification: "One copy of the pinned official genlayer-js package.json manifest at commit 1b7f50a3a3f2963ea857941b0fb386081dd5c326.", payment_milestones: ESCROW.toString(), delivery_deadline: state.case.deliveryDeadline };
  await write("award", buyerLive, "award_bid", { ...awardPackage, award_hash: sha256(stableJSON(awardPackage)) }, { readback: () => read(buyerLive, "get_award", { award_id: awardId }) });
  await write("supplier_acceptance", supplierLive, "accept_award", { award_id: awardId }, { readback: () => read(buyerLive, "get_award", { award_id: awardId }) });
  const deliveredAt = new Date().toISOString();
  await write("create_delivery", supplierLive, "create_delivery", { delivery_id: deliveryId, award_id: awardId, delivery_reference: "QUALIFICATION-PACKAGE-1", delivered_items: "One copy of the pinned official genlayer-js package.json manifest at commit 1b7f50a3a3f2963ea857941b0fb386081dd5c326.", quantity: 1, serial_identifiers: "GENLAYER-JS-COMMIT-1B7F50A3", submitted_at: deliveredAt }, { readback: () => read(buyerLive, "get_delivery", { delivery_id: deliveryId }) });
  await write("add_delivery_evidence", supplierLive, "add_delivery_evidence", { delivery_id: deliveryId, evidence_id: deliveryEvidenceId, authority: EVIDENCE_AUTHORITY, source_url: EVIDENCE_URL, content_sha256: qualificationEvidence.sha256, content_byte_length: qualificationEvidence.byteLength, observed_at: state.case.evidenceObservedAt, published_at: EVIDENCE_PUBLISHED_AT, evidence_type: EVIDENCE_TYPE }, { readback: () => read(buyerLive, "get_evidence", { entity_type: "DELIVERY", entity_id: deliveryId }) });

  const canonical = {
    protocol: await read(buyerLive, "get_protocol_info"),
    tender: await read(buyerLive, "get_tender", { tender_id: caseId }),
    requirements: await read(buyerLive, "get_requirements", { tender_id: caseId }),
    bids: await read(buyerLive, "get_bids", { tender_id: caseId }),
    bidEvidence: await read(buyerLive, "get_evidence", { entity_type: "BID", entity_id: bidId }),
    adjudication: await read(buyerLive, "get_adjudication", { bid_id: bidId, requirement_id: requirementId }),
    award: await read(buyerLive, "get_award", { award_id: awardId }),
    delivery: await read(buyerLive, "get_delivery", { delivery_id: deliveryId }),
    deliveryEvidence: await read(buyerLive, "get_evidence", { entity_type: "DELIVERY", entity_id: deliveryId }),
    accounting: await read(buyerLive, "get_accounting"),
  };
  state.canonicalReadback = jsonSafe(canonical);
  state.balances.buyerAfter = (await buyerClient.getBalance({ address: buyer.address })).toString();
  state.balances.supplierAfter = (await buyerClient.getBalance({ address: supplier.address })).toString();
  state.balances.oldContractsAfter = {};
  for (const address of OLD_CONTRACTS) state.balances.oldContractsAfter[address] = (await buyerClient.getBalance({ address })).toString();
  state.balances.oldContractsUnchanged = OLD_CONTRACTS.every((address) => state.balances.oldContractsBefore[address] === state.balances.oldContractsAfter[address]);
  assert(state.balances.oldContractsUnchanged, "older contract balances changed");
  assert(BigInt(state.balances.actualGenSpent) <= SPEND_CAP, "actual GEN spend cap exceeded");
  assert(state.transactions.length === 13, `unexpected live transaction count: ${state.transactions.length}`);
  state.qualification = "PASS";
  state.completedAt = now();
  await persist(state);
  console.log(stableJSON({ qualification: state.qualification, contractAddress, deploymentTx: deploymentHash, case: state.case, actualGenSpent: state.balances.actualGenSpent, actualGenFees: state.balances.actualGenFees, transactions: state.transactions.map((item) => ({ label: item.label, submissionHash: item.submissionHash, genlayerTxId: item.genlayerTxId, nonce: item.nonce, consensusStatus: item.consensusStatus, result: item.receipt?.resultName, executionOutcome: item.executionOutcome, canonicalReadback: item.canonicalReadback, actualGenFee: item.actualGenFee, valueTransferred: item.valueTransferred, completionCheckpoint: item.completionCheckpoint })), canonicalReadback: state.canonicalReadback, frontendSchemaParity: state.frontendSchemaParity }));
}

main().catch((error) => {
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});
