import { fail, ok } from "@/lib/api/response";
import { safeLogAuditEvent } from "@/lib/audit/logger";
import { getAuthContext, hasPermissionInContext } from "@/lib/auth/guards";
import { onboardingSchema } from "@/lib/validations/onboarding";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const context = await getAuthContext(request);

  if (!context) {
    return fail("Unauthenticated", 401);
  }

  const canRead =
    hasPermissionInContext(context, "customer:read") || hasPermissionInContext(context, "customer:write");

  if (!canRead) {
    return fail("Forbidden", 403);
  }

  const supabase = await createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim().toLowerCase() ?? "";

  let dbQuery = supabase
    .from("customers")
    .select("id, external_customer_ref, full_name, email, kyc_status, risk_tier, created_at")
    .eq("tenant_id", context.tenantId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (query) {
    dbQuery = dbQuery.or(
      `full_name.ilike.%${query}%,email.ilike.%${query}%,external_customer_ref.ilike.%${query}%`
    );
  }

  const { data, error } = await dbQuery;

  if (error) {
    return fail(error.message, 500);
  }

  return ok({
    items: data ?? [],
    count: data?.length ?? 0
  });
}

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = onboardingSchema.safeParse(payload);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid onboarding payload", 422);
  }

  const context = await getAuthContext(request);

  if (!context) {
    return fail("Unauthenticated", 401);
  }

  if (!hasPermissionInContext(context, "customer:write")) {
    return fail("Forbidden", 403);
  }

  if (parsed.data.tenantId !== context.tenantId) {
    return fail("Tenant scope violation", 403);
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("customers")
    .insert({
      tenant_id: context.tenantId,
      external_customer_ref: parsed.data.externalCustomerRef,
      full_name: parsed.data.fullName,
      email: parsed.data.email,
      country_code: parsed.data.countryCode,
      kyc_status: "pending",
      risk_tier: parsed.data.riskTier,
      onboarding_status: "profile_complete"
    })
    .select("id, external_customer_ref")
    .single();

  if (error) {
    return fail(error.message, 409);
  }

  await safeLogAuditEvent({
    tenantId: context.tenantId,
    actorId: context.userId,
    action: "customer.onboarded",
    resourceType: "customer",
    resourceId: data.id,
    metadata: {
      externalCustomerRef: parsed.data.externalCustomerRef,
      email: parsed.data.email,
      countryCode: parsed.data.countryCode,
      riskTier: parsed.data.riskTier,
      source: "api"
    }
  });

  return ok(
    {
      status: "accepted",
      customerRef: parsed.data.externalCustomerRef,
      customerId: data.id
    },
    201
  );
}
