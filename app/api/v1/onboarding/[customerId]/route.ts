import { fail, ok } from "@/lib/api/response";
import { safeLogAuditEvent } from "@/lib/audit/logger";
import { getAuthContext, hasPermissionInContext } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { profileUpdateSchema } from "@/lib/validations/onboarding";

type RouteContext = { params: Promise<{ customerId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { customerId } = await context.params;
  const auth = await getAuthContext(request);
  if (!auth) return fail("Unauthenticated", 401);
  const canRead =
    hasPermissionInContext(auth, "customer:read") || hasPermissionInContext(auth, "customer:write");
  if (!canRead) return fail("Forbidden", 403);

  const supabase = await createServerSupabaseClient();

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select(
      "id, tenant_id, external_customer_ref, full_name, email, phone, country_code, type, kyc_status, risk_tier, onboarding_status, created_at"
    )
    .eq("id", customerId)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();

  if (customerError || !customer) return fail("Customer not found", 404);

  const [{ data: kyc }, { data: aml }, { data: documents }] = await Promise.all([
    supabase
      .from("customer_kyc_details")
      .select("*")
      .eq("customer_id", customerId)
      .eq("tenant_id", auth.tenantId)
      .maybeSingle(),
    supabase
      .from("customer_aml_details")
      .select("*")
      .eq("customer_id", customerId)
      .eq("tenant_id", auth.tenantId)
      .maybeSingle(),
    supabase
      .from("customer_documents")
      .select("id, document_type, storage_path, file_name, status, created_at")
      .eq("customer_id", customerId)
      .eq("tenant_id", auth.tenantId)
      .order("created_at", { ascending: false })
  ]);

  return ok({
    customer: {
      id: customer.id,
      tenantId: customer.tenant_id,
      externalCustomerRef: customer.external_customer_ref,
      fullName: customer.full_name,
      email: customer.email,
      phone: customer.phone,
      countryCode: customer.country_code,
      type: customer.type,
      kycStatus: customer.kyc_status,
      riskTier: customer.risk_tier,
      onboardingStatus: customer.onboarding_status,
      createdAt: customer.created_at
    },
    kyc: kyc
      ? {
          id: kyc.id,
          idType: kyc.id_type,
          idNumber: kyc.id_number,
          idCountry: kyc.id_country,
          dateOfBirth: kyc.date_of_birth,
          nationality: kyc.nationality,
          addressLine1: kyc.address_line1,
          addressLine2: kyc.address_line2,
          city: kyc.city,
          postalCode: kyc.postal_code,
          country: kyc.country,
          verifiedAt: kyc.verified_at
        }
      : null,
    aml: aml
      ? {
          id: aml.id,
          sourceOfFunds: aml.source_of_funds,
          expectedMonthlyVolumeMinor: aml.expected_monthly_volume_minor,
          purposeOfAccount: aml.purpose_of_account,
          pepDeclaration: aml.pep_declaration,
          sanctionedCountryExposure: aml.sanctioned_country_exposure,
          reviewedAt: aml.reviewed_at
        }
      : null,
    documents: (documents ?? []).map((d) => ({
      id: d.id,
      documentType: d.document_type,
      storagePath: d.storage_path,
      fileName: d.file_name,
      status: d.status,
      createdAt: d.created_at
    }))
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { customerId } = await context.params;
  const auth = await getAuthContext(request);
  if (!auth) return fail("Unauthenticated", 401);
  if (!hasPermissionInContext(auth, "customer:write")) return fail("Forbidden", 403);

  const body = await request.json();
  const parsed = profileUpdateSchema.safeParse({ ...body, customerId, tenantId: auth.tenantId });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);

  const supabase = await createServerSupabaseClient();

  const { data: existing } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();
  if (!existing) return fail("Customer not found", 404);

  const update: Record<string, unknown> = {};
  if (parsed.data.fullName !== undefined) update.full_name = parsed.data.fullName;
  if (parsed.data.email !== undefined) update.email = parsed.data.email;
  if (parsed.data.phone !== undefined) update.phone = parsed.data.phone;
  if (parsed.data.countryCode !== undefined) update.country_code = parsed.data.countryCode;
  if (parsed.data.type !== undefined) update.type = parsed.data.type;
  if (parsed.data.riskTier !== undefined) update.risk_tier = parsed.data.riskTier;

  const { data, error } = await supabase
    .from("customers")
    .update(update)
    .eq("id", customerId)
    .eq("tenant_id", auth.tenantId)
    .select("id, full_name, email, phone, country_code, type, risk_tier")
    .single();

  if (error) return fail(error.message, 409);

  await safeLogAuditEvent({
    tenantId: auth.tenantId,
    actorId: auth.userId,
    action: "onboarding.profile_updated",
    resourceType: "customer",
    resourceId: customerId,
    metadata: { source: "api" }
  });

  return ok({ customer: data });
}
