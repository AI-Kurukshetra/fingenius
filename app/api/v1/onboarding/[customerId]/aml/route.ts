import { fail, ok } from "@/lib/api/response";
import { safeLogAuditEvent } from "@/lib/audit/logger";
import { getAuthContext, hasPermissionInContext } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { amlDetailsSchema } from "@/lib/validations/onboarding";

type RouteContext = { params: Promise<{ customerId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { customerId } = await context.params;
  const auth = await getAuthContext(request);
  if (!auth) return fail("Unauthenticated", 401);
  const canRead =
    hasPermissionInContext(auth, "customer:read") ||
    hasPermissionInContext(auth, "customer:write") ||
    hasPermissionInContext(auth, "aml:review");
  if (!canRead) return fail("Forbidden", 403);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("customer_aml_details")
    .select("*")
    .eq("customer_id", customerId)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();

  if (error) return fail(error.message, 500);
  if (!data) return ok({ aml: null });

  return ok({
    aml: {
      id: data.id,
      sourceOfFunds: data.source_of_funds,
      expectedMonthlyVolumeMinor: data.expected_monthly_volume_minor,
      purposeOfAccount: data.purpose_of_account,
      pepDeclaration: data.pep_declaration,
      sanctionedCountryExposure: data.sanctioned_country_exposure,
      reviewedAt: data.reviewed_at
    }
  });
}

export async function PUT(request: Request, context: RouteContext) {
  const { customerId } = await context.params;
  const auth = await getAuthContext(request);
  if (!auth) return fail("Unauthenticated", 401);
  if (!hasPermissionInContext(auth, "customer:write")) return fail("Forbidden", 403);

  const body = await request.json();
  const parsed = amlDetailsSchema.safeParse({ ...body, customerId, tenantId: auth.tenantId });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid AML payload", 422);

  const supabase = await createServerSupabaseClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();
  if (!customer) return fail("Customer not found", 404);

  const row = {
    tenant_id: auth.tenantId,
    customer_id: customerId,
    source_of_funds: parsed.data.sourceOfFunds,
    expected_monthly_volume_minor: parsed.data.expectedMonthlyVolumeMinor ?? null,
    purpose_of_account: parsed.data.purposeOfAccount,
    pep_declaration: parsed.data.pepDeclaration,
    sanctioned_country_exposure: parsed.data.sanctionedCountryExposure
  };

  const { data, error } = await supabase
    .from("customer_aml_details")
    .upsert(row, { onConflict: "customer_id" })
    .select("id")
    .single();

  if (error) return fail(error.message, 409);

  await safeLogAuditEvent({
    tenantId: auth.tenantId,
    actorId: auth.userId,
    action: "onboarding.aml_updated",
    resourceType: "customer_aml_details",
    resourceId: data.id,
    metadata: { customerId }
  });

  return ok({ amlId: data.id });
}
