import { z } from "zod";

export const postingSchema = z.object({
  accountId: z.string().uuid(),
  direction: z.enum(["debit", "credit"]),
  amountMinor: z.number().int().positive(),
  currency: z.string().length(3)
});

export const transactionSchema = z.object({
  tenantId: z.string().uuid(),
  reference: z.string().min(6).max(80),
  description: z.string().min(3).max(200),
  postings: z.array(postingSchema).min(2)
});

export type TransactionInput = z.infer<typeof transactionSchema>;
