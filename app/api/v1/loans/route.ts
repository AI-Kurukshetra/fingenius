import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { safeLogAuditEvent } from "@/lib/audit/logger";
import { getAuthContext, hasPermissionInContext } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loanApplicationSchema } from "@/lib/validations/loan";

const decisionSchema = z.object({
  loanId: z.string().uuid(),
  decision: z.enum(["approved", "rejected", "under_review", "disbursed"])
});

const canReadLoans = (permissions: string[]): boolean => {
  return (
    permissions.includes("loan:write") ||
    permissions.includes("loan:approve") ||
    permissions.includes("report:read")
  );
};

export async function GET(request: Request) {
  const context = await getAuthContext(request);

  if (!context) {
    return fail("Unauthenticated", 401);
  }

  if (!canReadLoans(context.permissions)) {
    return fail("Forbidden", 403);
  }

  const supabase = await createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.trim();

  let query = supabase
    .from("loan_applications")
    .select("id, customer_id, principal_minor, term_months, annual_rate_bps, purpose, status, created_at")
    .eq("tenant_id", context.tenantId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return fail(error.message, 500);
  }

  return ok({ items: data ?? [], count: data?.length ?? 0 });
}

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = loanApplicationSchema.safeParse(payload);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid loan payload", 422);
  }

  const context = await getAuthContext(request);

  if (!context) {
    return fail("Unauthenticated", 401);
  }

  const canCreate =
    hasPermissionInContext(context, "loan:write") || hasPermissionInContext(context, "loan:approve");

  if (!canCreate) {
    return fail("Forbidden", 403);
  }

  if (parsed.data.tenantId !== context.tenantId) {
    return fail("Tenant scope violation", 403);
  }

  const supabase = await createServerSupabaseClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("tenant_id", context.tenantId)
    .eq("id", parsed.data.customerId)
    .maybeSingle();

  if (!customer?.id) {
    return fail("Customer not found", 404);
  }

  const { data, error } = await supabase
    .from("loan_applications")
    .insert({
      tenant_id: context.tenantId,
      customer_id: parsed.data.customerId,
      principal_minor: parsed.data.principalMinor,
      term_months: parsed.data.termMonths,
      annual_rate_bps: parsed.data.annualRateBps,
      purpose: parsed.data.purpose,
      status: "under_review"
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    return fail(error?.message ?? "Unable to create loan application", 409);
  }

  await safeLogAuditEvent({
    tenantId: context.tenantId,
    actorId: context.userId,
    action: "loan.application_submitted",
    resourceType: "loan_application",
    resourceId: data.id,
    metadata: {
      customerId: parsed.data.customerId,
      principalMinor: parsed.data.principalMinor,
      source: "api"
    }
  });

  return ok(
    {
      status: "under_review",
      customerId: parsed.data.customerId,
      principalMinor: parsed.data.principalMinor,
      loanId: data.id
    },
    201
  );
}

export async function PATCH(request: Request) {
  const payload = await request.json();
  const parsed = decisionSchema.safeParse(payload);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid loan decision payload", 422);
  }

  const context = await getAuthContext(request);

  if (!context) {
    return fail("Unauthenticated", 401);
  }

  if (!hasPermissionInContext(context, "loan:approve")) {
    return fail("Forbidden", 403);
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("loan_applications")
    .update({ status: parsed.data.decision })
    .eq("tenant_id", context.tenantId)
    .eq("id", parsed.data.loanId)
    .select("id")
    .maybeSingle();

  if (error || !data?.id) {
    return fail(error?.message ?? "Unable to update loan decision", 409);
  }

  await safeLogAuditEvent({
    tenantId: context.tenantId,
    actorId: context.userId,
    action: "loan.application_decided",
    resourceType: "loan_application",
    resourceId: parsed.data.loanId,
    metadata: {
      decision: parsed.data.decision,
      source: "api"
    }
  });

  return ok({
    status: parsed.data.decision,
    loanId: parsed.data.loanId
  });
}
