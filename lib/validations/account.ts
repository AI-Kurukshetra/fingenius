import { z } from "zod";

export const createAccountSchema = z.object({
  tenantId: z.string().uuid(),
  customerId: z.string().uuid(),
  productCode: z.enum(["SAVINGS", "CURRENT", "LOAN"]),
  currency: z.string().length(3),
  initialDepositMinor: z.number().int().min(0)
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
