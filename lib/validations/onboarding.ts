import { z } from "zod";

export const onboardingSchema = z.object({
  tenantId: z.string().uuid(),
  externalCustomerRef: z.string().min(3).max(80),
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  countryCode: z.string().length(2),
  riskTier: z.enum(["low", "medium", "high"])
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
