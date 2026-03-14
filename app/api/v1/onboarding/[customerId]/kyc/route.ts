import { fail, ok } from "@/lib/api/response";
import { safeLogAuditEvent } from "@/lib/audit/logger";
import { getAuthContext, hasPermissionInContext } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { kycDetailsSchema } from "@/lib/validations/onboarding";

type RouteContext = { params: Promise<{ customerId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { customerId } = await context.params;
  const auth = await getAuthContext(request);
  if (!auth) return fail("Unauthenticated", 401);
  const canRead =
    hasPermissionInContext(auth, "customer:read") || hasPermissionInContext(auth, "customer:write");
  if (!canRead) return fail("Forbidden", 403);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("customer_kyc_details")
    .select("*")
    .eq("customer_id", customerId)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();

  if (error) return fail(error.message, 500);
  if (!data) return ok({ kyc: null });

  return ok({
    kyc: {
      id: data.id,
      idType: data.id_type,
      idNumber: data.id_number,
      idCountry: data.id_country,
      dateOfBirth: data.date_of_birth,
      nationality: data.nationality,
      addressLine1: data.address_line1,
      addressLine2: data.address_line2,
      city: data.city,
      postalCode: data.postal_code,
      country: data.country,
      verifiedAt: data.verified_at
    }
  });
}

export async function PUT(request: Request, context: RouteContext) {
  const { customerId } = await context.params;
  const auth = await getAuthContext(request);
  if (!auth) return fail("Unauthenticated", 401);
  if (!hasPermissionInContext(auth, "customer:write")) return fail("Forbidden", 403);

  const body = await request.json();
  const parsed = kycDetailsSchema.safeParse({ ...body, customerId, tenantId: auth.tenantId });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid KYC payload", 422);

  const supabase = await createServerSupabaseClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("id, onboarding_status")
    .eq("id", customerId)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();
  if (!customer) return fail("Customer not found", 404);

  const row = {
    tenant_id: auth.tenantId,
    customer_id: customerId,
    id_type: parsed.data.idType,
    id_number: parsed.data.idNumber,
    id_country: parsed.data.idCountry,
    date_of_birth: parsed.data.dateOfBirth ?? null,
    nationality: parsed.data.nationality ?? null,
    address_line1: parsed.data.addressLine1,
    address_line2: parsed.data.addressLine2 ?? null,
    city: parsed.data.city,
    postal_code: parsed.data.postalCode ?? null,
    country: parsed.data.country
  };

  const { data, error } = await supabase
    .from("customer_kyc_details")
    .upsert(row, { onConflict: "customer_id" })
    .select("id")
    .single();

  if (error) return fail(error.message, 409);

  await safeLogAuditEvent({
    tenantId: auth.tenantId,
    actorId: auth.userId,
    action: "onboarding.kyc_updated",
    resourceType: "customer_kyc_details",
    resourceId: data.id,
    metadata: { customerId }
  });

  return ok({ kycId: data.id });
}
