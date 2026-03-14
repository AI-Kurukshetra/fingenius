"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { safeLogAuditEvent } from "@/lib/audit/logger";
import { getAuthContext, hasPermissionInContext } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const createLoanSchema = z.object({
  customerId: z.string().uuid(),
  principalMinor: z.coerce.number().int().positive(),
  termMonths: z.coerce.number().int().min(1).max(360),
  annualRateBps: z.coerce.number().int().min(1).max(10000),
  purpose: z.string().min(3).max(200)
});

const decisionSchema = z.object({
  loanId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"])
});

const backToLoansWithError = (message: string): never => {
  redirect(`/loans?error=${encodeURIComponent(message)}`);
};

const backToLoansWithMessage = (message: string): never => {
  redirect(`/loans?message=${encodeURIComponent(message)}`);
};

export const createLoanApplicationAction = async (formData: FormData): Promise<void> => {
  const parsed = createLoanSchema.safeParse({
    customerId: String(formData.get("customerId") ?? "").trim(),
    principalMinor: formData.get("principalMinor"),
    termMonths: formData.get("termMonths"),
    annualRateBps: formData.get("annualRateBps"),
    purpose: String(formData.get("purpose") ?? "").trim()
  });

  const values = parsed.success
    ? parsed.data
    : backToLoansWithError(parsed.error.issues[0]?.message ?? "Invalid loan request");

  const context = await getAuthContext();
  const authContext = context ?? backToLoansWithError("Unauthenticated");

  const canCreate =
    hasPermissionInContext(authContext, "loan:write") ||
    hasPermissionInContext(authContext, "loan:approve");

  if (!canCreate) {
    backToLoansWithError("You do not have permission to submit loan applications.");
  }

  const supabase = await createServerSupabaseClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("tenant_id", authContext.tenantId)
    .eq("id", values.customerId)
    .maybeSingle();

  if (!customer?.id) {
    backToLoansWithError("Customer not found for this tenant.");
  }

  const { data: createdLoan, error } = await supabase
    .from("loan_applications")
    .insert({
      tenant_id: authContext.tenantId,
      customer_id: values.customerId,
      principal_minor: values.principalMinor,
      term_months: values.termMonths,
      annual_rate_bps: values.annualRateBps,
      purpose: values.purpose,
      status: "submitted"
    })
    .select("id")
    .single();

  if (error || !createdLoan?.id) {
    backToLoansWithError(error?.message ?? "Unable to create loan application");
  }
  const createdLoanId = createdLoan?.id ?? backToLoansWithError("Unable to create loan application");

  await safeLogAuditEvent({
    tenantId: authContext.tenantId,
    actorId: authContext.userId,
    action: "loan.application_submitted",
    resourceType: "loan_application",
    resourceId: createdLoanId,
    metadata: {
      customerId: values.customerId,
      principalMinor: values.principalMinor,
      termMonths: values.termMonths
    }
  });

  revalidatePath("/loans");
  backToLoansWithMessage("Loan application submitted.");
};

export const decideLoanApplicationAction = async (formData: FormData): Promise<void> => {
  const parsed = decisionSchema.safeParse({
    loanId: String(formData.get("loanId") ?? "").trim(),
    decision: String(formData.get("decision") ?? "")
  });

  const values = parsed.success
    ? parsed.data
    : backToLoansWithError(parsed.error.issues[0]?.message ?? "Invalid loan decision request");

  const context = await getAuthContext();
  const authContext = context ?? backToLoansWithError("Unauthenticated");

  if (!hasPermissionInContext(authContext, "loan:approve")) {
    backToLoansWithError("You do not have permission to decide loan applications.");
  }

  const supabase = await createServerSupabaseClient();
  const { data: updatedLoan, error } = await supabase
    .from("loan_applications")
    .update({ status: values.decision })
    .eq("tenant_id", authContext.tenantId)
    .eq("id", values.loanId)
    .select("id")
    .maybeSingle();

  if (error || !updatedLoan?.id) {
    backToLoansWithError(error?.message ?? "Unable to update loan status");
  }

  await safeLogAuditEvent({
    tenantId: authContext.tenantId,
    actorId: authContext.userId,
    action: "loan.application_decided",
    resourceType: "loan_application",
    resourceId: values.loanId,
    metadata: {
      decision: values.decision
    }
  });

  revalidatePath("/loans");
  backToLoansWithMessage(`Loan ${values.decision}.`);
};
