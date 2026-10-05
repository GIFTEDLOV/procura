import { z } from "zod";

export const hashSchema = z.string().regex(/^[0-9a-f]{64}$/, "SHA-256 must be 64 lowercase hex characters");
export const bidArgsSchema = z.object({
  bidId: z.string().min(1),
  tenderId: z.string().min(1),
  price: z.number().int().nonnegative(),
  currency: z.string().min(1),
  deliveryCommitment: z.string().min(1),
  requirementResponses: z.string().min(1),
  submittedAt: z.string().datetime({ offset: true }),
  bidHash: hashSchema
});

export function serializeBid(values: z.input<typeof bidArgsSchema>): unknown[] {
  const parsed = bidArgsSchema.parse(values);
  return [parsed.bidId, parsed.tenderId, parsed.price, parsed.currency, parsed.deliveryCommitment, parsed.requirementResponses, parsed.submittedAt, parsed.bidHash];
}
