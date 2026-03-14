import { z } from "zod";

import { ONBOARDING_STATUSES } from "@/lib/onboarding/state-machine";

const onboardingStatusEnum = z.enum(ONBOARDING_STATUSES as unknown as [string, ...string[]]);

/** Initial customer create (existing flow). */
export const onboardingSchema = z.object({
  tenantId: z.string().uuid(),
  externalCustomerRef: z.string().min(3).max(80),
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  countryCode: z.string().length(2),
  riskTier: z.enum(["low", "medium", "high"])
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

/** Profile update (extended fields). */
export const profileUpdateSchema = z.object({
  tenantId: z.string().uuid(),
  customerId: z.string().uuid(),
  fullName: z.string().min(2).max(120).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional().nullable(),
  countryCode: z.string().length(2).optional().nullable(),
  type: z.enum(["individual", "business"]).optional(),
  riskTier: z.enum(["low", "medium", "high"]).optional()
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

/** KYC details. */
export const kycDetailsSchema = z.object({
  tenantId: z.string().uuid(),
  customerId: z.string().uuid(),
  idType: z.string().min(1).max(40),
  idNumber: z.string().min(1).max(80),
  idCountry: z.string().length(2),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  nationality: z.string().length(2).optional().nullable(),
  addressLine1: z.string().min(1).max(200),
  addressLine2: z.string().max(200).optional().nullable(),
  city: z.string().min(1).max(100),
  postalCode: z.string().max(20).optional().nullable(),
  country: z.string().length(2)
});

export type KycDetailsInput = z.infer<typeof kycDetailsSchema>;

/** AML onboarding details. */
export const amlDetailsSchema = z.object({
  tenantId: z.string().uuid(),
  customerId: z.string().uuid(),
  sourceOfFunds: z.string().min(1).max(500),
  expectedMonthlyVolumeMinor: z.number().int().min(0).optional().nullable(),
  purposeOfAccount: z.string().min(1).max(500),
  pepDeclaration: z.boolean(),
  sanctionedCountryExposure: z.boolean()
});

export type AmlDetailsInput = z.infer<typeof amlDetailsSchema>;

/** Document create/upload metadata. */
export const documentPlaceholderSchema = z.object({
  tenantId: z.string().uuid(),
  customerId: z.string().uuid(),
  documentType: z.enum(["id_proof", "address_proof", "income_proof", "contract", "statement", "other"])
});

export type DocumentPlaceholderInput = z.infer<typeof documentPlaceholderSchema>;

/** Status transition (e.g. profile_complete -> kyc_pending). */
export const transitionSchema = z.object({
  tenantId: z.string().uuid(),
  customerId: z.string().uuid(),
  nextStatus: onboardingStatusEnum
});

export type TransitionInput = z.infer<typeof transitionSchema>;

/** Compliance/admin review. */
const reviewActionEnum = z.enum([
  "kyc_approve",
  "kyc_reject",
  "aml_approve",
  "aml_reject",
  "compliance_approve",
  "compliance_reject",
  "request_changes"
]);

export const onboardingReviewSchema = z.object({
  tenantId: z.string().uuid(),
  customerId: z.string().uuid(),
  action: reviewActionEnum,
  comment: z.string().max(2000).optional()
});

export type OnboardingReviewInput = z.infer<typeof onboardingReviewSchema>;
