import { fail, ok } from "@/lib/api/response";
import { getAuthContext, hasPermissionInContext } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * GET /api/v1/onboarding/queue
 * Returns customers in statuses that require compliance/admin review (kyc_submitted, aml_submitted, compliance_review).
 */
export async function GET(request: Request) {
  const auth = await getAuthContext(request);
  if (!auth) return fail("Unauthenticated", 401);
  const canRead =
    hasPermissionInContext(auth, "kyc:review") ||
    hasPermissionInContext(auth, "aml:review") ||
    hasPermissionInContext(auth, "compliance:manage") ||
    hasPermissionInContext(auth, "customer:read");
  if (!canRead) return fail("Forbidden", 403);

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.trim();

  const supabase = await createServerSupabaseClient();

  let query = supabase
    .from("customers")
    .select("id, external_customer_ref, full_name, email, onboarding_status, kyc_status, risk_tier, created_at")
    .eq("tenant_id", auth.tenantId)
    .in("onboarding_status", [
      "kyc_submitted",
      "aml_submitted",
      "aml_approved",
      "compliance_review"
    ])
    .order("created_at", { ascending: false })
    .limit(100);

  if (status) {
    query = query.eq("onboarding_status", status);
  }

  const { data, error } = await query;

  if (error) return fail(error.message, 500);

  return ok({
    items: (data ?? []).map((c) => ({
      id: c.id,
      externalCustomerRef: c.external_customer_ref,
      fullName: c.full_name,
      email: c.email,
      onboardingStatus: c.onboarding_status,
      kycStatus: c.kyc_status,
      riskTier: c.risk_tier,
      createdAt: c.created_at
    })),
    count: data?.length ?? 0
  });
}
