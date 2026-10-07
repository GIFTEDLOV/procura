import rawProfile from "../../../evidence/studio-dev-fee-profile.json";
import type { MessageFeeAllocationInput } from "genlayer-js/types";
import { deriveExternalMessageCallKey, encodeExternalMessageFeeParams, MessageType } from "genlayer-js";
import type { Address, Hex } from "viem";

type ProfileMethod = {
  leaderTimeunitsAllocation: string;
  validatorTimeunitsAllocation: string;
  executionBudgetPerRound: string;
  totalMessageFees: string;
  appealRounds: number;
  rotationsPerRound: string;
  externalMessage?: {
    gasLimit: string;
    maxGasPrice: string;
    budget: string;
    data: Hex;
    onAcceptance: boolean;
  };
};

type StudioFeeProfile = {
  network: string;
  chainId: number;
  methods: Record<string, ProfileMethod>;
};

export const studioFeeProfile = rawProfile as StudioFeeProfile;

export type MessageMethod = "cancel_tender" | "settle_award" | "refund_buyer" | "release_milestone" | "resolve_dispute";

export function profileFor(method: string): ProfileMethod {
  const profile = studioFeeProfile.methods[method];
  if (!profile) throw new Error(`No Studio-dev fee profile exists for ${method}`);
  return profile;
}

export function messageAllocationFor(method: string, recipient: Address): MessageFeeAllocationInput[] {
  const profile = profileFor(method);
  if (!profile.externalMessage) return [];
  const message = profile.externalMessage;
  const callKey = deriveExternalMessageCallKey(message.data);
  const feeParams = encodeExternalMessageFeeParams({
    gasLimit: BigInt(message.gasLimit),
    maxGasPrice: BigInt(message.maxGasPrice),
  });
  const budget = BigInt(message.budget);
  if (budget <= 0n) throw new Error(`${method} external message budget must be positive`);
  return [{
    messageType: MessageType.External,
    onAcceptance: message.onAcceptance,
    parentIndex: 0n,
    recipient,
    callKey,
    budget,
    feeParams,
  }];
}

export function feeEstimateOptions(method: string, recipient?: Address) {
  const profile = profileFor(method);
  const messageAllocations = profile.externalMessage && recipient ? messageAllocationFor(method, recipient) : undefined;
  if (profile.externalMessage && !recipient) throw new Error(`${method} requires a canonical message recipient`);
  return {
    leaderTimeunitsAllocation: BigInt(profile.leaderTimeunitsAllocation),
    validatorTimeunitsAllocation: BigInt(profile.validatorTimeunitsAllocation),
    executionBudgetPerRound: BigInt(profile.executionBudgetPerRound),
    totalMessageFees: BigInt(profile.totalMessageFees),
    appealRounds: BigInt(profile.appealRounds),
    rotations: Array(Number(profile.rotationsPerRound)).fill(0n),
    messageAllocations,
  };
}
