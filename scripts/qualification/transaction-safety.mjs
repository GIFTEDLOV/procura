export const QUALIFICATION_WRITE_ALLOWLIST = Object.freeze([
  "create_tender",
  "add_requirement",
  "freeze_tender",
  "fund_tender",
  "submit_bid",
  "add_bid_evidence",
  "begin_bid_evaluation",
  "adjudicate_requirement",
  "finalize_bid_evaluation",
  "award_bid",
  "accept_award",
  "create_delivery",
  "add_delivery_evidence",
]);

const allowedWrites = new Set(QUALIFICATION_WRITE_ALLOWLIST);
const readOnlyMethods = Object.freeze([
  "getBalance",
  "getCurrentNonce",
  "getContractCode",
  "getContractSchema",
  "getContractSchemaForCode",
  "getTransaction",
  "readContract",
  "estimateTransactionGas",
]);
const readOnlyRpcMethods = new Set([
  "eth_call",
  "eth_chainId",
  "eth_estimateGas",
  "eth_gasPrice",
  "eth_getBalance",
  "eth_getTransactionByHash",
  "eth_getTransactionCount",
  "eth_getTransactionReceipt",
  "gen_getContractCode",
  "gen_getContractSchema",
  "gen_getContractSchemaForCode",
  "gen_getTransaction",
  "gen_call",
  "sim_getTransactionsForAddress",
]);

export function createReadOnlyClient(client) {
  const safe = { chain: client.chain };
  for (const name of readOnlyMethods) {
    if (typeof client[name] === "function") safe[name] = client[name].bind(client);
  }
  safe.request = async ({ method, ...request }) => {
    if (!readOnlyRpcMethods.has(method)) {
      const error = new Error(`read-only RPC capability denied: ${method}`);
      error.code = "PROCURA_READ_ONLY_DENIED";
      throw error;
    }
    return client.request({ method, ...request });
  };
  return Object.freeze(safe);
}

export function assertQualificationWriteAllowed(method) {
  if (!allowedWrites.has(method)) {
    const error = new Error(`qualification write is not allowlisted: ${method}`);
    error.code = "PROCURA_WRITE_NOT_ALLOWLISTED";
    throw error;
  }
}

export function assertFinalizationAuthorized(statusName, authorization, count) {
  if (statusName !== "READY_TO_FINALIZE") {
    const error = new Error(`finalization is not valid for status ${statusName}`);
    error.code = "PROCURA_FINALIZATION_NOT_READY";
    throw error;
  }
  if (authorization?.allowConditionalFinalization !== true
    || !Number.isInteger(Number(authorization.lifecycleFinalizationMaxCount))
    || count >= Number(authorization.lifecycleFinalizationMaxCount)) {
    const error = new Error("conditional finalization is outside the authorized scope");
    error.code = "PROCURA_FINALIZATION_NOT_AUTHORIZED";
    throw error;
  }
}

export function assertNoPriorDeliverySubmission(transactions, awardId, deliveryId) {
  if (!Array.isArray(transactions)) {
    throw new Error("canonical transaction history is unavailable; refusing create_delivery");
  }
  const prior = transactions.filter((tx) => {
    const encoded = tx?.data?.calldata;
    if (typeof encoded !== "string") return false;
    const calldata = Buffer.from(encoded, "base64").toString("utf8");
    return calldata.includes(deliveryId)
      || (calldata.includes("create_delivery") && calldata.includes(awardId));
  });
  if (prior.length) {
    const hashes = prior.map((tx) => tx?.hash ?? tx?.tx_id ?? "unknown").join(", ");
    throw new Error(`canonical history already contains a delivery submission for this qualification (${hashes}); refusing duplicate write`);
  }
  return true;
}

export function createGuardedSigningAccount(account, authorizeBeforeSign, afterSign = null) {
  if (typeof account?.signTransaction !== "function") {
    throw new Error("a local signer with signTransaction is required for pre-sign safety checks");
  }
  const sign = account.signTransaction.bind(account);
  const guarded = Object.create(account);
  let signatureUsed = false;
  guarded.signTransaction = async (transactionRequest) => {
    if (signatureUsed) {
      const error = new Error("only one signed submission is allowed for a qualification operation");
      error.code = "PROCURA_MULTIPLE_SIGNATURES_DENIED";
      throw error;
    }
    await authorizeBeforeSign(transactionRequest);
    signatureUsed = true;
    const serializedTransaction = await sign(transactionRequest);
    if (afterSign) await afterSign({ transactionRequest, serializedTransaction });
    return serializedTransaction;
  };
  return guarded;
}
