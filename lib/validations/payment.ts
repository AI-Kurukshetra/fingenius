import { z } from "zod";

export const createPaymentTransferSchema = z.object({
  tenantId: z.string().uuid(),
  accountId: z.string().uuid(),
  amountMinor: z.number().int().positive(),
  currency: z.string().length(3),
  description: z.string().max(200).optional(),
  autoConfirm: z.boolean().optional().default(true)
});

export type CreatePaymentTransferInput = z.infer<typeof createPaymentTransferSchema>;

export const reconcilePaymentTransferSchema = z.object({
  transferId: z.string().uuid()
});

export type ReconcilePaymentTransferInput = z.infer<typeof reconcilePaymentTransferSchema>;
