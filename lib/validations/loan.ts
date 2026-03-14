import { z } from "zod";

export const loanApplicationSchema = z.object({
  tenantId: z.string().uuid(),
  customerId: z.string().uuid(),
  principalMinor: z.number().int().positive(),
  termMonths: z.number().int().min(1).max(360),
  annualRateBps: z.number().int().min(1).max(10000),
  purpose: z.string().min(3).max(200)
});

export type LoanApplicationInput = z.infer<typeof loanApplicationSchema>;
