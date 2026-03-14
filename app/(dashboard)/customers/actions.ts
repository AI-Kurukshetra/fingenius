"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { safeLogAuditEvent } from "@/lib/audit/logger";
import { getAuthContext, hasPermissionInContext } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const onboardingFormSchema = z.object({
  externalCustomerRef: z.string().min(3).max(80),
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  countryCode: z.string().length(2),
  riskTier: z.enum(["low", "medium", "high"])
});

const backToCustomersWithError = (message: string): never => {
  redirect(`/customers?error=${encodeURIComponent(message)}`);
};

const backToCustomersWithMessage = (message: string): never => {
  redirect(`/customers?message=${encodeURIComponent(message)}`);
};

export const createCustomerOnboardingAction = async (formData: FormData): Promise<void> => {
  const parsed = onboardingFormSchema.safeParse({
    externalCustomerRef: String(formData.get("externalCustomerRef") ?? "").trim(),
    fullName: String(formData.get("fullName") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    countryCode: String(formData.get("countryCode") ?? "").trim().toUpperCase(),
    riskTier: String(formData.get("riskTier") ?? "")
  });

  const values = parsed.success
    ? parsed.data
    : backToCustomersWithError(parsed.error.issues[0]?.message ?? "Invalid onboarding request");

  const context = await getAuthContext();
  const authContext = context ?? backToCustomersWithError("Unauthenticated");

  if (!hasPermissionInContext(authContext, "customer:write")) {
    backToCustomersWithError("You do not have permission to onboard customers.");
  }

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.from("customers").insert({
    tenant_id: authContext.tenantId,
    external_customer_ref: values.externalCustomerRef,
    full_name: values.fullName,
    email: values.email,
    kyc_status: "pending",
    risk_tier: values.riskTier
  });

  if (error) {
    if (error.code === "23505") {
      backToCustomersWithError("Customer reference already exists for this tenant.");
    }

    backToCustomersWithError(error.message);
  }

  await safeLogAuditEvent({
    tenantId: authContext.tenantId,
    actorId: authContext.userId,
    action: "customer.onboarded",
    resourceType: "customer",
    resourceId: values.externalCustomerRef,
    metadata: {
      email: values.email,
      riskTier: values.riskTier,
      countryCode: values.countryCode
    }
  });

  revalidatePath("/customers");
  backToCustomersWithMessage("Customer onboarding record created.");
};
