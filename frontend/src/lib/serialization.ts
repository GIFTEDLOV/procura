import { z } from "zod";
import { frontendInterfaceManifest, manifestMethod } from "./interfaceManifest";

/**
 * The contract compares its datetime fields as strings. Every value sent by
 * the frontend is therefore normalized to fixed-width UTC ISO-8601 with
 * milliseconds before it is compared, hashed, or encoded:
 * YYYY-MM-DDTHH:mm:ss.sssZ.
 */
export const contractTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
export const contractTimestampSchema = z.string().regex(contractTimestampPattern, "timestamp must be canonical UTC ISO-8601");
export const hashSchema = z.string().regex(/^[0-9a-f]{64}$/, "SHA-256 must be 64 lowercase hexadecimal characters");
export const U256_MAX = (1n << 256n) - 1n;

export type U256Input = bigint | number | string;

function fail(field: string, message: string): never {
  throw new Error(`${field}: ${message}`);
}

export function parseU256(value: U256Input, field = "u256"): bigint {
  if (typeof value === "number" && (!Number.isSafeInteger(value) || value < 0)) fail(field, "must be a non-negative safe integer; use a decimal string or bigint for large values");
  if (typeof value === "string" && !/^(0|[1-9][0-9]*)$/.test(value)) fail(field, "must be a base-10 unsigned integer");
  let parsed: bigint;
  try { parsed = typeof value === "bigint" ? value : BigInt(value); } catch { fail(field, "must be a base-10 unsigned integer"); }
  if (parsed < 0n) fail(field, "cannot be negative");
  if (parsed > U256_MAX) fail(field, "exceeds the contract u256 maximum");
  return parsed;
}

function dateFromInput(value: string, field: string): Date {
  if (typeof value !== "string" || !value.trim()) fail(field, "is required");
  // datetime-local has no offset by design. The browser's local timezone is
  // applied by Date, and the result is immediately converted to UTC.
  const acceptsDateTimeLocal = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value);
  const acceptsOffsetDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value);
  if (!acceptsDateTimeLocal && !acceptsOffsetDateTime) fail(field, "must be an ISO-8601 datetime or datetime-local value");
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(value);
  if (!parts) fail(field, "is not a real datetime");
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = parts;
  const year = Number(yearText); const month = Number(monthText); const day = Number(dayText); const hour = Number(hourText); const minute = Number(minuteText); const second = Number(secondText ?? "0");
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (!daysInMonth || day < 1 || day > daysInMonth || hour > 23 || minute > 59 || second > 59) fail(field, "is not a real calendar datetime");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) fail(field, "is not a real datetime");
  if (acceptsDateTimeLocal) {
    const [datePart, timePart] = value.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute, second = 0] = timePart.split(":").map(Number);
    if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute || date.getSeconds() !== second) {
      fail(field, "is not a real calendar datetime");
    }
  }
  return date;
}

export function normalizeContractTimestamp(value: string, field = "timestamp"): string {
  const date = dateFromInput(value, field);
  const normalized = date.toISOString();
  // Reject impossible calendar values that JavaScript otherwise rolls into a
  // different date (for example 2026-02-30).
  if (contractTimestampPattern.test(value) && normalized !== value) fail(field, "is not a real canonical datetime");
  return normalized;
}

export function nowContractTimestamp(): string {
  return new Date().toISOString();
}

export function toDateTimeLocalValue(timestamp = nowContractTimestamp()): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) throw new Error("cannot display an invalid timestamp");
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function assertDeadlineOrder(bidDeadline: string, evaluationDeadline: string, deliveryDeadline: string): void {
  if (!(bidDeadline < evaluationDeadline && evaluationDeadline < deliveryDeadline)) throw new Error("deadlines must be ordered bid < evaluation < delivery using canonical UTC timestamps");
}

export function assertAtOrBefore(value: string, deadline: string, field: string): void {
  if (value > deadline) throw new Error(`${field} must not be after the applicable deadline`);
}

type CanonicalValue = null | boolean | string | number | bigint | CanonicalValue[] | { [key: string]: CanonicalValue };

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new Error("canonical serialization only permits safe integer numbers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    const keys = Object.keys(object).sort();
    return `{${keys.map((key) => {
      if (object[key] === undefined) throw new Error(`canonical serialization does not permit undefined field ${key}`);
      return `${JSON.stringify(key)}:${canonicalJson(object[key])}`;
    }).join(",")}}`;
  }
  throw new Error("canonical serialization does not permit functions or symbols");
}

/**
 * Canonical commitment preimage format, version 1:
 * {schemaVersion,method,arguments:[{name,value}, ...]}
 * The argument array follows contracts/schema.v2.evidence.json order; object keys are
 * lexicographically sorted; bigint/u256 values are decimal strings; JSON is
 * compact UTF-8 with no whitespace. The hash field itself is excluded.
 */
export function canonicalArgumentSerialization(method: string, kwargs: Record<string, unknown>, excludedFields: readonly string[] = []): string {
  const manifest = manifestMethod(method);
  const argumentsInOrder = manifest.arguments.filter((name) => !excludedFields.includes(name)).map((name) => ({ name, value: kwargs[name] as CanonicalValue }));
  return canonicalJson({ schemaVersion: frontendInterfaceManifest.schemaVersion, method, arguments: argumentsInOrder });
}

export async function sha256HexBytes(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Web Crypto SHA-256 is unavailable");
  const digest = await subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(value: string): Promise<string> {
  return sha256HexBytes(new TextEncoder().encode(value));
}

export async function sha256File(file: Blob): Promise<{ contentSha256: string; contentByteLength: bigint }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length === 0) throw new Error("evidence file cannot be empty");
  return { contentSha256: await sha256HexBytes(bytes), contentByteLength: BigInt(bytes.byteLength) };
}

/**
 * Hash only the currently selected evidence file. A later selection invalidates
 * the token, so a slower read of an older file cannot overwrite the latest
 * file's digest or byte length in the LIVE form.
 */
export async function sha256FileForSelection(file: Blob, selectionToken: number, currentSelection: () => number): Promise<{ contentSha256: string; contentByteLength: bigint } | null> {
  const result = await sha256File(file);
  return currentSelection() === selectionToken ? result : null;
}

export async function commitmentHash(method: string, kwargs: Record<string, unknown>, excludedField: string): Promise<string> {
  return sha256Hex(canonicalArgumentSerialization(method, kwargs, [excludedField]));
}

const u256ValueSchema = z.union([
  z.bigint().nonnegative(),
  z.string().regex(/^(0|[1-9][0-9]*)$/),
  z.number().int().nonnegative().refine(Number.isSafeInteger, "must be a safe integer"),
]);

export const bidArgsSchema = z.object({
  bidId: z.string().min(1),
  tenderId: z.string().min(1),
  price: u256ValueSchema,
  currency: z.string().min(1),
  deliveryCommitment: z.string().min(1),
  requirementResponses: z.string().min(1),
  submittedAt: contractTimestampSchema,
  bidHash: hashSchema,
});

export function serializeBid(values: z.input<typeof bidArgsSchema>): unknown[] {
  const parsed = bidArgsSchema.parse(values);
  return [parsed.bidId, parsed.tenderId, parseU256(parsed.price, "price"), parsed.currency, parsed.deliveryCommitment, parsed.requirementResponses, parsed.submittedAt, parsed.bidHash];
}

export type CreateTenderForm = {
  tenderId: string; title: string; description: string; category: string; currencyLabel: string; budgetCeiling: U256Input;
  bidDeadline: string; evaluationDeadline: string; deliveryDeadline: string; equivalencePolicy: string; evaluationPolicy: string; paymentPolicy: string; supplierBondPolicy: string;
};

export async function buildCreateTenderArgs(input: CreateTenderForm): Promise<Record<string, unknown>> {
  const requiredText: Array<[string, string]> = [
    ["tender_id", input.tenderId], ["title", input.title], ["description", input.description], ["category", input.category], ["currency_label", input.currencyLabel],
    ["equivalence_policy", input.equivalencePolicy], ["evaluation_policy", input.evaluationPolicy], ["payment_policy", input.paymentPolicy], ["supplier_bond_policy", input.supplierBondPolicy],
  ];
  for (const [field, value] of requiredText) if (!value.trim()) fail(field, "is required");
  const paymentPolicy = input.paymentPolicy.trim();
  const gracePeriod = /^NON_DELIVERY_REFUND_AFTER_DEADLINE:(\d+)$/.exec(paymentPolicy)?.[1];
  if (paymentPolicy !== "FULL" && (!gracePeriod || Number(gracePeriod) > 31_536_000)) {
    fail("payment_policy", "is outside the V2 policy grammar");
  }
  const bidDeadline = normalizeContractTimestamp(input.bidDeadline, "bid_deadline");
  const evaluationDeadline = normalizeContractTimestamp(input.evaluationDeadline, "evaluation_deadline");
  const deliveryDeadline = normalizeContractTimestamp(input.deliveryDeadline, "delivery_deadline");
  assertDeadlineOrder(bidDeadline, evaluationDeadline, deliveryDeadline);
  const kwargs: Record<string, unknown> = {
    tender_id: input.tenderId.trim(), title: input.title.trim(), description: input.description.trim(), category: input.category.trim(), currency_label: input.currencyLabel.trim(), budget_ceiling: parseU256(input.budgetCeiling, "budget_ceiling"),
    bid_deadline: bidDeadline, evaluation_deadline: evaluationDeadline, delivery_deadline: deliveryDeadline, equivalence_policy: input.equivalencePolicy.trim(), evaluation_policy: input.evaluationPolicy.trim(), payment_policy: paymentPolicy, supplier_bond_policy: input.supplierBondPolicy.trim(),
  };
  kwargs.tender_hash = await commitmentHash("create_tender", kwargs, "tender_hash");
  return kwargs;
}

export type SubmitBidForm = {
  bidId: string; tenderId: string; price: U256Input; currency: string; deliveryCommitment: string; requirementResponses: string; submittedAt: string;
  tenderCurrency: string; tenderBudgetCeiling: U256Input; tenderBidDeadline: string;
};

export async function buildSubmitBidArgs(input: SubmitBidForm): Promise<Record<string, unknown>> {
  if (!input.bidId.trim() || !input.tenderId.trim() || !input.deliveryCommitment.trim() || !input.requirementResponses.trim()) throw new Error("bid identity and commitments are required");
  const price = parseU256(input.price, "price");
  const budget = parseU256(input.tenderBudgetCeiling, "tender budget ceiling");
  if (price > budget) throw new Error("bid price exceeds the canonical tender budget ceiling");
  const currency = input.currency.trim();
  if (!currency || currency !== input.tenderCurrency) throw new Error("bid currency must match the canonical tender currency");
  const submittedAt = normalizeContractTimestamp(input.submittedAt, "submitted_at");
  const bidDeadline = normalizeContractTimestamp(input.tenderBidDeadline, "bid_deadline");
  assertAtOrBefore(submittedAt, bidDeadline, "submitted_at");
  const kwargs: Record<string, unknown> = {
    bid_id: input.bidId.trim(), tender_id: input.tenderId.trim(), price, currency, delivery_commitment: input.deliveryCommitment.trim(), requirement_responses: input.requirementResponses.trim(), submitted_at: submittedAt,
  };
  kwargs.bid_hash = await commitmentHash("submit_bid", kwargs, "bid_hash");
  return kwargs;
}

export type CreateDeliveryForm = {
  deliveryId: string; awardId: string; deliveryReference: string; deliveredItems: string; quantity: U256Input; serialIdentifiers: string; submittedAt: string; awardDeliveryDeadline: string;
};

export async function buildCreateDeliveryArgs(input: CreateDeliveryForm): Promise<Record<string, unknown>> {
  if (!input.deliveryId.trim() || !input.awardId.trim() || !input.deliveryReference.trim() || !input.deliveredItems.trim() || !input.serialIdentifiers.trim()) throw new Error("delivery identifiers and description are required");
  const quantity = parseU256(input.quantity, "quantity");
  if (quantity === 0n) throw new Error("quantity must be positive");
  const submittedAt = normalizeContractTimestamp(input.submittedAt, "submitted_at");
  const deadline = normalizeContractTimestamp(input.awardDeliveryDeadline, "delivery_deadline");
  assertAtOrBefore(submittedAt, deadline, "submitted_at");
  return { delivery_id: input.deliveryId.trim(), award_id: input.awardId.trim(), delivery_reference: input.deliveryReference.trim(), delivered_items: input.deliveredItems.trim(), quantity, serial_identifiers: input.serialIdentifiers.trim(), submitted_at: submittedAt };
}

export type EvidenceForm = {
  evidenceId: string; entityId: string; authority: string; sourceUrl: string; contentSha256: string; contentByteLength: U256Input; observedAt: string; publishedAt: string; evidenceType: string; entitySubmittedAt: string;
};

export function buildEvidenceArgs(method: "add_bid_evidence" | "add_delivery_evidence", input: EvidenceForm): Record<string, unknown> {
  if (!input.evidenceId.trim() || !input.entityId.trim() || !input.authority.trim() || !input.evidenceType.trim()) throw new Error("evidence identity, authority, and type are required");
  if (!/^https?:\/\/[^\s]+$/.test(input.sourceUrl)) throw new Error("source_url must be an http(s) URL");
  const contentByteLength = parseU256(input.contentByteLength, "content_byte_length");
  if (contentByteLength === 0n || contentByteLength > 10_000_000n) throw new Error("content_byte_length must be between 1 and 10000000 bytes");
  const contentSha256 = hashSchema.parse(input.contentSha256);
  const observedAt = normalizeContractTimestamp(input.observedAt, "observed_at");
  const publishedAt = normalizeContractTimestamp(input.publishedAt, "published_at");
  const entitySubmittedAt = normalizeContractTimestamp(input.entitySubmittedAt, "entity submitted_at");
  if (publishedAt > observedAt) throw new Error("published_at cannot be after observed_at");
  if (observedAt > entitySubmittedAt) throw new Error("observed_at cannot be after the submitted entity timestamp");
  const entityKey = method === "add_bid_evidence" ? "bid_id" : "delivery_id";
  return { [entityKey]: input.entityId.trim(), evidence_id: input.evidenceId.trim(), authority: input.authority.trim(), source_url: input.sourceUrl.trim(), content_sha256: contentSha256, content_byte_length: contentByteLength, observed_at: observedAt, published_at: publishedAt, evidence_type: input.evidenceType.trim() };
}

export function buildAddBidEvidenceArgs(input: EvidenceForm): Record<string, unknown> {
  return buildEvidenceArgs("add_bid_evidence", input);
}

export function buildAddDeliveryEvidenceArgs(input: EvidenceForm): Record<string, unknown> {
  return buildEvidenceArgs("add_delivery_evidence", input);
}

type RuntimeKind = "string" | "u256" | "timestamp" | "hash" | "url";
const workflowRuntimeKinds: Record<string, Record<string, RuntimeKind>> = {
  create_tender: { tender_id: "string", title: "string", description: "string", category: "string", currency_label: "string", budget_ceiling: "u256", bid_deadline: "timestamp", evaluation_deadline: "timestamp", delivery_deadline: "timestamp", equivalence_policy: "string", evaluation_policy: "string", payment_policy: "string", supplier_bond_policy: "string", tender_hash: "hash" },
  submit_bid: { bid_id: "string", tender_id: "string", price: "u256", currency: "string", delivery_commitment: "string", requirement_responses: "string", submitted_at: "timestamp", bid_hash: "hash" },
  create_delivery: { delivery_id: "string", award_id: "string", delivery_reference: "string", delivered_items: "string", quantity: "u256", serial_identifiers: "string", submitted_at: "timestamp" },
  add_bid_evidence: { bid_id: "string", evidence_id: "string", authority: "string", source_url: "url", content_sha256: "hash", content_byte_length: "u256", observed_at: "timestamp", published_at: "timestamp", evidence_type: "string" },
  add_delivery_evidence: { delivery_id: "string", evidence_id: "string", authority: "string", source_url: "url", content_sha256: "hash", content_byte_length: "u256", observed_at: "timestamp", published_at: "timestamp", evidence_type: "string" },
};

export const sharedWorkflowMethods = Object.keys(workflowRuntimeKinds) as Array<keyof typeof workflowRuntimeKinds>;

/** Runtime ABI checks for the five write workflows. Names and order remain sourced from the deployed typed schema. */
export function validateSharedWorkflowArgs(method: string, kwargs: Record<string, unknown>): void {
  const kinds = workflowRuntimeKinds[method];
  if (!kinds) return;
  const manifest = manifestMethod(method);
  const manifestNames = [...manifest.arguments];
  const expectedNames = Object.keys(kinds);
  if (manifestNames.length !== expectedNames.length || manifestNames.some((name, index) => name !== expectedNames[index])) throw new Error(`${method} runtime validator does not match contracts/schema.v2.evidence.json`);
  for (const name of manifestNames) {
    const value = kwargs[name];
    const kind = kinds[name];
    if (kind === "u256") parseU256(value as U256Input, name);
    else if (kind === "hash") hashSchema.parse(value);
    else if (kind === "timestamp") contractTimestampSchema.parse(value);
    else if (kind === "url") {
      if (typeof value !== "string" || !/^https?:\/\/[^\s]+$/.test(value)) throw new Error(`${name} must be an http(s) URL`);
    } else if (typeof value !== "string") throw new Error(`${name} must be a string`);
  }
  if (method === "create_tender") assertDeadlineOrder(String(kwargs.bid_deadline), String(kwargs.evaluation_deadline), String(kwargs.delivery_deadline));
}
